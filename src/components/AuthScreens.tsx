import { useState, type FormEvent } from 'react'
import { api } from '../lib/api'
import type { AuthStatus } from '../shared'

interface Props {
  mode: 'setup' | 'login'
  sugestao?: { nome: string; cargo: string }
  onDone: (s: AuthStatus) => void
}

const input =
  'w-full h-10 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary'
const label = 'font-label-sm text-label-sm uppercase tracking-wider text-outline'

export default function AuthScreen({ mode, sugestao, onDone }: Props) {
  const setup = mode === 'setup'
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [nome, setNome] = useState(sugestao?.nome ?? '')
  const [cargo, setCargo] = useState(sugestao?.cargo ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (setup && senha !== confirmar) return setErr('A confirmação não confere com a senha.')
    setErr(null)
    setBusy(true)
    try {
      const status = setup ? await api.setup({ usuario, senha, nome, cargo }) : await api.login({ usuario, senha })
      onDone(status)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Erro inesperado')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-xl shadow-md">
        <div className="flex items-center gap-space-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-primary font-bold text-on-primary">EC</div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm leading-none text-primary">Editais Chevomais</span>
            <span className="mt-0.5 font-label-sm text-label-sm uppercase tracking-wider text-outline">Gestão de Editais</span>
          </div>
        </div>

        <div>
          <h1 className="font-headline-sm text-headline-sm text-primary">{setup ? 'Primeiro acesso' : 'Entrar'}</h1>
          <p className="text-body-sm text-on-surface-variant">
            {setup
              ? 'Crie o usuário administrador. Depois, você cadastra os demais usuários dentro do painel.'
              : 'Entre com o seu usuário e senha.'}
          </p>
        </div>

        {setup && (
          <>
            <label className="flex flex-col gap-1">
              <span className={label}>Seu nome</span>
              <input required maxLength={80} className={input} value={nome} onChange={(e) => setNome(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={label}>Seu cargo</span>
              <input maxLength={80} className={input} value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1">
          <span className={label}>Usuário</span>
          <input
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            className={input}
            placeholder={setup ? 'ex.: maria.silva' : ''}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          {setup && <span className="text-[11px] text-outline">3 a 32 caracteres: letras minúsculas, números, ponto, hífen ou _</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className={label}>Senha</span>
          <input
            required
            type="password"
            autoComplete={setup ? 'new-password' : 'current-password'}
            className={input}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          {setup && <span className="text-[11px] text-outline">Mínimo de 6 caracteres</span>}
        </label>

        {setup && (
          <label className="flex flex-col gap-1">
            <span className={label}>Confirmar senha</span>
            <input required type="password" autoComplete="new-password" className={input} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
          </label>
        )}

        {err && <div className="rounded-lg bg-error-container/50 px-3 py-2 text-body-sm font-medium text-on-error-container">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-lg bg-primary font-label-md text-label-md text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {busy ? 'Aguarde…' : setup ? 'Criar administrador e entrar' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
