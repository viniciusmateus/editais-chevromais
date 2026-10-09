/**
 * Copia o data/db.json para o PostgreSQL definido em DATABASE_URL (.env).
 *
 *   npm run migrate-pg            # recusa se o banco já tiver dados
 *   npm run migrate-pg -- --force # sobrescreve (a versão anterior vai para a linha de backup id=2)
 *
 * Não altera nem apaga o db.json.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { DATABASE_URL, encerrar, pgLerBruto, pgSalvarBruto } from './db'

if (!DATABASE_URL) {
  console.error('Defina DATABASE_URL no .env (veja .env.example).')
  process.exit(1)
}
const file = path.resolve(process.env.DATA_DIR ?? 'data', 'db.json')
const force = process.argv.includes('--force')

try {
  const doc: any = JSON.parse(await fs.readFile(file, 'utf8'))
  const atual: any = await pgLerBruto()
  if (atual && !force) {
    console.error(`O PostgreSQL já tem dados (rev ${atual.rev}, ${atual.editais?.length ?? 0} editais). Use --force para sobrescrever.`)
    process.exit(1)
  }
  await pgSalvarBruto(doc)
  const novo: any = await pgLerBruto()
  const conta = (d: any) => `${d.editais?.length ?? 0} editais, ${d.users?.length ?? 0} usuários, ${d.empresas?.length ?? 0} empresas, ${d.portais?.length ?? 0} portais, ${d.sessions?.length ?? 0} sessões`
  console.log(`Origem  (${file}): ${conta(doc)}`)
  console.log(`Destino (PostgreSQL): ${conta(novo)}`)
  const igual = JSON.stringify(doc) === JSON.stringify(novo) || JSON.stringify(JSON.parse(JSON.stringify(doc))) === JSON.stringify(novo)
  console.log(igual ? 'OK: conteúdo idêntico.' : 'ATENÇÃO: a ordem das chaves pode diferir (jsonb); confira as contagens acima.')
} catch (e) {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await encerrar()
}
