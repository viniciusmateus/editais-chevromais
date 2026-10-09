/**
 * Túnel SSH automático para o PostgreSQL da VPS.
 *
 * Com SSH_TUNNEL=usuario@host no .env, o servidor abre sozinho `ssh -L <porta do DATABASE_URL>:localhost:5432`
 * antes de aceitar requisições, e o reabre se cair. Se a porta local já responde (túnel aberto à mão,
 * Beekeeper, outro servidor rodando), reaproveita sem abrir outro.
 *
 *   SSH_TUNNEL=root@198.50.117.238
 *   SSH_TUNNEL_REMOTE_PORT=5432   (opcional)
 */
import './env'
import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'

const alvo = process.env.SSH_TUNNEL?.trim()
const remota = process.env.SSH_TUNNEL_REMOTE_PORT || '5432'

const respondendo = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect({ port, host: '127.0.0.1' })
    s.once('connect', () => (s.destroy(), resolve(true)))
    s.once('error', () => resolve(false))
    s.setTimeout(1500, () => (s.destroy(), resolve(false)))
  })

let filho: ChildProcess | null = null
let encerrando = false

function abrir(port: number): void {
  filho = spawn(
    'ssh',
    ['-N', '-L', `${port}:localhost:${remota}`, '-o', 'ServerAliveInterval=30', '-o', 'ExitOnForwardFailure=yes', '-o', 'StrictHostKeyChecking=accept-new', alvo!],
    { stdio: 'inherit', windowsHide: true },
  )
  filho.on('error', (e) => console.error(`[tunel] não foi possível executar o ssh: ${e.message}`))
  filho.on('exit', (code) => {
    filho = null
    if (encerrando) return
    console.warn(`[tunel] ssh encerrou (código ${code}); tentando de novo em 5 s…`)
    setTimeout(async () => {
      if (!encerrando && !(await respondendo(port))) abrir(port)
    }, 5000)
  })
}

/** Garante o túnel antes de o servidor começar a atender. Sem SSH_TUNNEL ou DATABASE_URL não faz nada. */
export async function garantirTunel(): Promise<void> {
  if (!alvo || !process.env.DATABASE_URL) return
  const port = Number(new URL(process.env.DATABASE_URL).port || 5432)
  if (await respondendo(port)) return console.log(`[tunel] porta ${port} já está aberta; reaproveitando.`)
  console.log(`[tunel] abrindo túnel SSH para ${alvo} (porta local ${port})…`)
  abrir(port)
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await respondendo(port)) return console.log('[tunel] túnel aberto.')
  }
  console.error('[tunel] o túnel não abriu em 20 s. Confira o acesso SSH à VPS (chave ou senha).')
}

const fechar = () => {
  encerrando = true
  filho?.kill()
}
process.on('exit', fechar)
for (const s of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(s, () => (fechar(), process.exit(0)))
