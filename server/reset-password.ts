/**
 * Redefine a senha de um usuário direto no data/db.json.
 * Use quando o administrador esquecer a senha.
 *
 *   npm run reset-password -- <usuario> <nova-senha>
 *
 * IMPORTANTE: pare o servidor antes (o servidor mantém o banco em memória e
 * sobrescreveria a alteração na próxima gravação).
 */
import { db, dbPath } from './db'

const [usuario, senha] = process.argv.slice(2)

if (!usuario || !senha) {
  console.log('Uso: npm run reset-password -- <usuario> <nova-senha>')
  console.log('Pare o servidor antes de rodar este comando.')
  process.exit(1)
}

try {
  const ok = await db.resetPasswordOffline(usuario, senha)
  if (!ok) {
    console.error(`Usuário "${usuario}" não encontrado em ${dbPath}.`)
    console.error('Usuários existentes:', (await db.listUsernames()).join(', ') || '(nenhum)')
    process.exit(1)
  }
  console.log(`Senha de "${usuario}" alterada. Todas as sessões dele foram encerradas.`)
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
}
