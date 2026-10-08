/**
 * db.ts — banco de dados do Editais Chevomais.
 *
 * Os dados ficam num arquivo JSON em disco (por padrão ./data/db.json): editais,
 * retificações, usuários e sessões. Sobrevivem a limpeza de cache, troca de navegador
 * e reinício do servidor, e são compartilhados por todos os usuários.
 *
 * - Senhas: scrypt com sal individual (nunca guardadas em texto).
 * - Sessões: o navegador recebe um token aleatório; aqui só fica o hash dele.
 * - Escrita atômica: grava em arquivo temporário e renomeia.
 * - Backup automático: a versão anterior fica em db.bak.json a cada gravação.
 * - Escritas serializadas: duas requisições simultâneas nunca se sobrescrevem.
 * - Cada alteração sobe `rev`; as telas abertas usam isso para se manterem sincronizadas.
 *
 * Variável de ambiente: DATA_DIR (pasta onde o db.json é guardado).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import {
  CAMPOS_PORTAL,
  CAMPOS_BASE,
  CATEGORIAS_INICIAIS,
  PORTAIS_INICIAIS,
  REGRAS_PADRAO,
  STATUS_INICIAIS,
  STATUS_FIXOS,
  MODALIDADES,
  RESULTADOS,
  camposFaltando,
  horaValida,
  isoValida,
  type LogEntry,
  type LogMudanca,
  type AppState,
  type AuthStatus,
  type CategoriaCfg,
  type Portal,
  type Regra,
  type RegrasCampos,
  type Edital,
  type EditalInput,
  type Modalidade,
  type Papel,
  type PublicUser,
  type StatusCfg,
  type StatusKey,
  type ImpugnacaoCfg,
  type EmpresaCfg,
  type PerfilCfg,
  type Permissoes,
  type CampoBase,
  type ImpugStatusCfg,
  type EditalImpugnacao,
  type Transicao,
  type ExigeTransicao,
  type Unchanged,
} from '../src/shared'

export interface UserRecord extends Omit<PublicUser, 'perms'> {
  salt: string
  hash: string
  criadoEm: number
}

interface SessionRecord {
  /** sha256 do token entregue ao navegador */
  id: string
  userId: number
  expires: number
}

interface DbFile {
  version: 2
  rev: number
  nextId: number
  nextUserId: number
  nextPortalId: number
  nextPerfilId: number
  perfis: PerfilCfg[]
  users: UserRecord[]
  sessions: SessionRecord[]
  editais: Edital[]
  portais: Portal[]
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  impugnacoes: ImpugnacaoCfg[]
  impugStatuses: ImpugStatusCfg[]
  empresas: EmpresaCfg[]
  /** 2 = perfis já ganharam o campo Empresa */
  perfisVersao: number
  transicoes: Transicao[]
  legacy?: { nome: string; cargo: string }
}

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const BAK_FILE = path.join(DATA_DIR, 'db.bak.json')
const TMP_FILE = path.join(DATA_DIR, 'db.json.tmp')

export const dbPath = DB_FILE

const SESSION_MS = 30 * 24 * 3600 * 1000
const MAX_SESSIONS_PER_USER = 20
const USER_RE = /^[a-z0-9._-]{3,32}$/
const COR_RE = /^#[0-9a-fA-F]{6}$/

// ---------- erros (a API converte em códigos HTTP) ----------
export class ValidationError extends Error {} // 400
export class AuthError extends Error {} // 401
export class ForbiddenError extends Error {} // 403
export class NotFoundError extends Error {} // 404
export class ConflictError extends Error {} // 409

const novasRegras = (): RegrasCampos => ({ ...REGRAS_PADRAO })
const emptyDb = (): DbFile => ({
  version: 2,
  rev: 0,
  nextId: 1,
  nextUserId: 1,
  nextPortalId: 1,
  nextPerfilId: 2,
  perfis: [perfilPadrao(1)],
  users: [],
  sessions: [],
  editais: [],
  portais: [],
  categorias: CATEGORIAS_INICIAIS.map((c) => ({ ...c })),
  statuses: STATUS_INICIAIS.map((s) => ({ ...s })),
  transicoes: [],
  impugnacoes: [],
  impugStatuses: [],
  empresas: [],
  perfisVersao: 2,
})

let cache: DbFile | null = null
let queue: Promise<unknown> = Promise.resolve()

// ---------- utilidades ----------
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
/** Perfil criado na primeira vez: pode excluir e editar todos os dados base (o administrador restringe depois). */
function perfilPadrao(id: number): PerfilCfg {
  return { id, nome: 'Padrão', excluir: true, campos: CAMPOS_BASE.map((c) => c.key) }
}

const lerCamposBase = (v: unknown): CampoBase[] => CAMPOS_BASE.map((c) => c.key).filter((k) => Array.isArray(v) && v.includes(k))

/** Permissões efetivas: administrador pode tudo; os demais, o que o perfil libera (sem perfil = nada). */
function permsDe(d: DbFile, u: UserRecord): Permissoes {
  if (u.papel === 'admin') return { excluir: true, campos: CAMPOS_BASE.map((c) => c.key) }
  const p = d.perfis.find((x) => x.id === u.perfil)
  return p ? { excluir: p.excluir, campos: p.campos } : { excluir: false, campos: [] }
}

const pub = (d: DbFile, u: UserRecord): PublicUser => ({
  id: u.id,
  usuario: u.usuario,
  nome: u.nome,
  cargo: u.cargo,
  papel: u.papel,
  portais: u.portais,
  perfil: u.perfil ?? null,
  perms: permsDe(d, u),
})
const who = (u: UserRecord) => u.nome || u.usuario

const REGRA_VALORES: Regra[] = ['oculto', 'opcional', 'obrigatorio']

/** Lê regras gravadas no banco ignorando o que for inválido. */
function cleanRegrasLenient(v: any): Partial<RegrasCampos> {
  const out: Partial<RegrasCampos> = {}
  for (const c of CAMPOS_PORTAL) {
    const r = v?.[c.key]
    if (REGRA_VALORES.includes(r) && !(r === 'obrigatorio' && 'semObrigatorio' in c)) out[c.key] = r
  }
  return out
}

function cleanRegras(v: any): RegrasCampos {
  if (!v || typeof v !== 'object') throw new ValidationError('Regras dos campos ausentes')
  const out = novasRegras()
  for (const c of CAMPOS_PORTAL) {
    const r = v[c.key] ?? REGRAS_PADRAO[c.key] // tela aberta antes de um campo novo existir: usa o padrão em vez de recusar
    if (!REGRA_VALORES.includes(r)) throw new ValidationError(`Regra inválida para o campo ${c.label}`)
    if (r === 'obrigatorio' && 'semObrigatorio' in c) throw new ValidationError(`O campo ${c.label} não pode ser obrigatório`)
    out[c.key] = r
  }
  return out
}

/** Lista de portais de um usuário: array de ids existentes ou null (todos). */
function cleanPortaisUser(d: DbFile, v: unknown): number[] | null {
  if (v === null || v === undefined) return null
  if (!Array.isArray(v)) throw new ValidationError('Lista de portais inválida')
  const ids = [...new Set(v.map(Number))]
  if (ids.some((i) => !d.portais.some((p) => p.id === i))) throw new ValidationError('Portal inválido na lista do usuário')
  return ids
}

/** Perfil de um usuário: id existente, ou null (administrador). Sem informar, um novo usuário recebe o primeiro perfil. */
function cleanPerfilUser(d: DbFile, v: unknown, papel: Papel): number | null {
  if (papel === 'admin') return null
  if (v === undefined) return d.perfis[0]?.id ?? null
  if (v === null) return null
  const id = Number(v)
  if (!d.perfis.some((p) => p.id === id)) throw new ValidationError('Perfil inválido')
  return id
}

function cleanPerfil(body: any): { nome: string; excluir: boolean; campos: CampoBase[] } {
  if (!Array.isArray(body?.campos)) throw new ValidationError('Informe os campos que o perfil pode editar')
  return { nome: str(body?.nome, 'Nome do perfil', true, 60), excluir: body?.excluir === true, campos: lerCamposBase(body.campos) }
}

/** Devolve a lista na ordem dos ids informados (que precisam ser exatamente os itens existentes). */
function reordenar<T extends { id: string }>(lista: T[], ids: unknown): T[] {
  if (!Array.isArray(ids) || ids.length !== lista.length || new Set(ids).size !== ids.length) throw new ValidationError('Ordem inválida')
  const out = ids.map((id) => lista.find((x) => x.id === id))
  if (out.some((x) => !x)) throw new ValidationError('Ordem inválida')
  return out as T[]
}

function cleanCor(v: unknown): string {
  if (typeof v !== 'string' || !COR_RE.test(v)) throw new ValidationError('Cor inválida')
  return v.toLowerCase()
}

function str(v: unknown, field: string, required: boolean, max = 2000): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (required && !s) throw new ValidationError(`Campo obrigatório: ${field}`)
  if (s.length > max) throw new ValidationError(`Campo muito longo: ${field}`)
  return s
}

const EXIGE_VALORES: ExigeTransicao[] = ['nada', 'motivo', 'valorGanho', 'valorHomologado', 'impugnacoes']
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Lê as ligações gravadas ignorando o que for inválido (status que não existe, par repetido, etc.). */
function lerTransicoes(raw: any, statuses: StatusCfg[]): Transicao[] {
  const out: Transicao[] = []
  for (const t of Array.isArray(raw) ? raw : []) {
    if (!t || !statuses.some((s) => s.id === t.de) || !statuses.some((s) => s.id === t.para) || t.de === t.para) continue
    if (out.some((x) => x.de === t.de && x.para === t.para)) continue
    out.push({
      de: t.de,
      para: t.para,
      rotulo: typeof t.rotulo === 'string' && t.rotulo.trim() ? t.rotulo.trim().slice(0, 40) : statuses.find((s) => s.id === t.para)!.nome,
      negativo: t.negativo === true,
      exige: EXIGE_VALORES.includes(t.exige) ? t.exige : 'nada',
      resultado: t.resultado === 'GANHAMOS' || t.resultado === 'PERDEMOS' ? t.resultado : '',
    })
  }
  return out
}

/** Impugnações gravadas no edital: só objetos válidos, sem repetir o mesmo id. */
function lerImpugsDoEdital(v: any): EditalImpugnacao[] {
  const out: EditalImpugnacao[] = []
  for (const i of Array.isArray(v) ? v : []) {
    if (i && typeof i.id === 'string' && i.id && !out.some((o) => o.id === i.id)) out.push({ id: i.id, status: typeof i.status === 'string' ? i.status : '' })
  }
  return out
}

/** Confere as impugnações informadas contra o cadastro (ids e status existentes). */
function conferirImpugs(d: DbFile, v: any): EditalImpugnacao[] {
  const lista = lerImpugsDoEdital(v)
  for (const i of lista) {
    if (!d.impugnacoes.some((x) => x.id === i.id)) throw new ValidationError('Impugnação inválida: escolha uma impugnação cadastrada')
    if (i.status && !d.impugStatuses.some((s) => s.id === i.status)) throw new ValidationError('Status de impugnação inválido')
  }
  return lista
}

/** "Impugnação A (Deferida), Impugnação B (sem resposta)" para o histórico. */
function textoImpugs(d: DbFile, l: EditalImpugnacao[]): string {
  if (!l.length) return '—'
  return l
    .map((i) => `${d.impugnacoes.find((x) => x.id === i.id)?.nome ?? i.id} (${i.status ? (d.impugStatuses.find((s) => s.id === i.status)?.nome ?? i.status) : 'sem resposta'})`)
    .join(', ')
}

/**
 * Bancos criados antes do fluxo ganham um fluxo inicial montado pelos nomes dos status:
 * Aguardando cadastro → Cadastrado → Ganho/Perdido → Homologado, e Descartado / Fracassado / Desclassificado como saídas negativas.
 * Se o banco não tem esses status, o fluxo começa vazio (mudança livre) e o administrador monta o dele.
 */
function fluxoInicial(statuses: StatusCfg[]): Transicao[] {
  const acha = (...nomes: string[]) => statuses.find((s) => nomes.includes(semAcento(s.nome)))
  const garante = (id: string, nome: string, cor: string, ...apelidos: string[]) => {
    const ex = acha(nome.toLowerCase(), ...apelidos)
    if (ex) return ex
    let novo = id
    for (let i = 2; statuses.some((s) => s.id === novo); i++) novo = `${id}-${i}`
    const s: StatusCfg = { id: novo, nome, cor }
    statuses.push(s)
    return s
  }
  const inicio = statuses.find((s) => s.id === 'PREP')
  const cadastrado = acha('cadastrado')
  if (!inicio || !cadastrado) return []
  const ganho = garante('GANHO', 'Ganho', '#16a34a', 'ganhamos', 'ganhou')
  const perdido = garante('PERDIDO', 'Perdido', '#dc2626', 'perdemos', 'perdeu')
  const homologado = acha('homologado')
  const descartado = acha('descartado')
  const fracassado = acha('fracassado')
  const desclassificado = acha('desclassificado')
  const t = (de: StatusCfg, para: StatusCfg | undefined, rotulo: string, extra: Partial<Transicao> = {}): Transicao[] =>
    para ? [{ de: de.id, para: para.id, rotulo, negativo: false, exige: 'nada', resultado: '', ...extra }] : []
  return [
    ...t(inicio, cadastrado, 'Cadastrar', { exige: 'impugnacoes' }),
    ...t(cadastrado, ganho, 'Ganhamos', { exige: 'valorGanho', resultado: 'GANHAMOS' }),
    ...t(cadastrado, perdido, 'Perdemos', { resultado: 'PERDEMOS' }),
    ...t(ganho, homologado, 'Homologar', { exige: 'valorHomologado' }),
    ...t(inicio, descartado, 'Descartar', { negativo: true, exige: 'motivo' }),
    ...t(cadastrado, descartado, 'Descartar', { negativo: true, exige: 'motivo' }),
    ...t(cadastrado, fracassado, 'Fracassou', { negativo: true, exige: 'motivo' }),
    ...t(cadastrado, desclassificado, 'Desclassificado', { negativo: true, exige: 'motivo' }),
  ]
}

// ---------- leitura / gravação ----------
function normalize(raw: any): DbFile {
  const base = emptyDb()
  if (!raw || typeof raw !== 'object') return base

  const editais: Edital[] = (Array.isArray(raw.editais) ? raw.editais : []).map((e: any) => {
    // campos que saíram do sistema (o antigo "valor estimado" e o "objeto") não são copiados: a limpeza do banco acontece na próxima gravação
    const { valor: _valorEstimado, objeto: _objeto, ...resto } = e
    const ganho = Number(e.valorGanho)
    return {
      ...resto,
      retifs: (Array.isArray(e.retifs) ? e.retifs : []).map((r: any) => ({ ...r, por: typeof r.por === 'string' ? r.por : '' })),
      v: Number(e.v) || 1,
      criadoPor: typeof e.criadoPor === 'string' ? e.criadoPor : '',
      atualizadoPor: typeof e.atualizadoPor === 'string' ? e.atualizadoPor : '',
      atualizadoEm: Number(e.atualizadoEm) || 0,
      portal: typeof e.portal === 'string' ? e.portal : '',
      cidade: typeof e.cidade === 'string' ? e.cidade : '',
      resultado: e.resultado === 'GANHAMOS' || e.resultado === 'PERDEMOS' ? e.resultado : '',
      log: Array.isArray(e.log) ? e.log : [],
      valorGanho: Number.isFinite(ganho) && ganho > 0 ? ganho : 0,
      impugnacoes: lerImpugsDoEdital(e.impugnacoes),
      empresa: typeof e.empresa === 'string' ? e.empresa : '',
      valorHomologado: Number.isFinite(Number(e.valorHomologado)) && Number(e.valorHomologado) > 0 ? Number(e.valorHomologado) : 0,
    }
  })
  const users: UserRecord[] = (Array.isArray(raw.users) ? raw.users : [])
    .filter((u: any) => u && typeof u.usuario === 'string' && typeof u.hash === 'string' && typeof u.salt === 'string')
    .map((u: any) => ({ ...u, portais: Array.isArray(u.portais) ? u.portais.map(Number).filter(Number.isInteger) : null }))
  const perfis: PerfilCfg[] = (Array.isArray(raw.perfis) ? raw.perfis : [])
    .filter((p: any) => p && Number.isInteger(p.id) && typeof p.nome === 'string' && p.nome)
    .map((p: any) => ({ id: p.id, nome: p.nome, excluir: p.excluir === true, campos: lerCamposBase(p.campos) }))
  if (Array.isArray(raw.perfis) && (Number(raw.perfisVersao) || 1) < 2) {
    for (const p of perfis) {
      if (!p.campos.includes('empresa') && CAMPOS_BASE.every((c) => c.key === 'empresa' || p.campos.includes(c.key))) p.campos = lerCamposBase([...p.campos, 'empresa'])
    }
  }
  let nextPerfilId = Math.max(Number(raw.nextPerfilId) || 1, ...perfis.map((p) => p.id + 1))
  if (!Array.isArray(raw.perfis)) {
    perfis.push(perfilPadrao(nextPerfilId))
    nextPerfilId++
  }
  // quem não tem um perfil válido recebe o primeiro (administradores não precisam)
  for (const u of users) {
    if (!perfis.some((p) => p.id === u.perfil)) u.perfil = u.papel === 'admin' ? null : (perfis[0]?.id ?? null)
  }
  const now = Date.now()
  const sessions: SessionRecord[] = (Array.isArray(raw.sessions) ? raw.sessions : []).filter(
    (s: any) => s && typeof s.id === 'string' && s.expires > now,
  )

  // categorias: as cadastradas; bancos antigos recebem Tintas e Pneus
  const categorias: CategoriaCfg[] = (Array.isArray(raw.categorias) ? raw.categorias : [])
    .filter((c: any) => c && typeof c.id === 'string' && c.id && typeof c.nome === 'string')
    .map((c: any) => ({ id: c.id, nome: c.nome, cor: COR_RE.test(c.cor) ? c.cor : '#64748b' }))
  if (!Array.isArray(raw.categorias)) categorias.push(...CATEGORIAS_INICIAIS.map((c) => ({ ...c })))
  // edital apontando para categoria inexistente: recria a categoria em vez de perder o vínculo
  for (const e of editais) {
    if (!categorias.some((c) => c.id === e.cat)) categorias.push({ id: String(e.cat), nome: String(e.cat), cor: '#64748b' })
  }

  // portais: os cadastrados; bancos antigos recebem a lista fixa + os nomes já usados nos editais
  let portais: Portal[] = (Array.isArray(raw.portais) ? raw.portais : [])
    .filter((p: any) => p && Number.isInteger(p.id) && typeof p.nome === 'string' && p.nome)
    .map((p: any) => ({ id: p.id, nome: p.nome, campos: { ...REGRAS_PADRAO, ...cleanRegrasLenient(p.campos) } }))
  let nextPortalId = Math.max(Number(raw.nextPortalId) || 1, ...portais.map((p) => p.id + 1))
  if (!Array.isArray(raw.portais)) {
    const nomes = [...PORTAIS_INICIAIS, ...editais.map((e) => e.portal)].filter(Boolean)
    portais = []
    for (const nome of nomes) {
      if (!portais.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) portais.push({ id: nextPortalId++, nome, campos: novasRegras() })
    }
  }

  // ids de portais que já não existem saem da lista dos usuários
  for (const u of users) if (u.portais) u.portais = u.portais.filter((id) => portais.some((p) => p.id === id))

  // status: os cadastrados; bancos antigos recebem os 5 originais
  const statuses: StatusCfg[] = (Array.isArray(raw.statuses) ? raw.statuses : [])
    .filter((s: any) => s && typeof s.id === 'string' && s.id && typeof s.nome === 'string')
    .map((s: any) => ({
      id: s.id,
      nome: s.nome,
      cor: COR_RE.test(s.cor) ? s.cor : '#64748b',
      ...(Number.isFinite(s.x) && Number.isFinite(s.y) ? { x: s.x, y: s.y } : {}),
    }))
  if (!Array.isArray(raw.statuses)) statuses.push(...STATUS_INICIAIS.map((s) => ({ ...s })))
  for (const id of [...STATUS_FIXOS, ...editais.map((e) => e.status)]) {
    if (!statuses.some((s) => s.id === id)) statuses.push(STATUS_INICIAIS.find((s) => s.id === id) ?? { id: String(id), nome: String(id), cor: '#64748b' })
  }

  const lerItens = (v: any) =>
    (Array.isArray(v) ? v : [])
      .filter((i: any) => i && typeof i.id === 'string' && i.id && typeof i.nome === 'string')
      .map((i: any) => ({ id: i.id, nome: i.nome, cor: COR_RE.test(i.cor) ? i.cor : '#64748b' }))
  const impugnacoes: ImpugnacaoCfg[] = lerItens(raw.impugnacoes)
  const impugStatuses: ImpugStatusCfg[] = lerItens(raw.impugStatuses)
  const empresas: EmpresaCfg[] = lerItens(raw.empresas)

  const transicoes = Array.isArray(raw.transicoes) ? lerTransicoes(raw.transicoes, statuses) : fluxoInicial(statuses)

  const out: DbFile = {
    version: 2,
    rev: Number(raw.rev) || 0,
    statuses,
    impugnacoes,
    impugStatuses,
    empresas,
    perfisVersao: 2,
    transicoes,
    nextPortalId,
    nextPerfilId,
    perfis,
    portais,
    categorias,
    nextId: Math.max(Number(raw.nextId) || 1, ...editais.map((e) => (Number(e.id) || 0) + 1)),
    nextUserId: Math.max(Number(raw.nextUserId) || 1, ...users.map((u) => (Number(u.id) || 0) + 1)),
    users,
    sessions,
    editais,
  }
  // banco da versão anterior (sem usuários): aproveita nome/cargo para sugerir o 1º administrador
  const old = raw.settings
  if (old && typeof old.nome === 'string' && old.nome && old.nome !== 'Seu Nome') {
    out.legacy = { nome: old.nome, cargo: typeof old.cargo === 'string' && old.cargo !== 'Seu Cargo' ? old.cargo : '' }
  }
  return out
}

async function load(): Promise<DbFile> {
  if (cache) return cache
  await fs.mkdir(DATA_DIR, { recursive: true })
  let limpar = false
  try {
    const text = await fs.readFile(DB_FILE, 'utf8')
    try {
      cache = normalize(JSON.parse(text))
      limpar = /"objeto"\s*:/.test(text)
    } catch {
      // arquivo corrompido: guarda uma cópia e começa de novo (nunca apaga o original)
      const saved = path.join(DATA_DIR, `db.corrompido-${Date.now()}.json`)
      await fs.writeFile(saved, text)
      console.warn(`[db] db.json inválido. Cópia salva em ${saved}. Iniciando banco vazio.`)
      cache = emptyDb()
    }
  } catch (e: any) {
    if (e.code !== 'ENOENT') throw e
    cache = emptyDb()
  }
  // limpeza: o campo "objeto" saiu do sistema; regrava o banco sem ele (a cópia anterior fica em db.bak.json)
  if (limpar) {
    await persist(cache)
    console.log('[db]  campo "objeto" removido do banco (cópia anterior em db.bak.json)')
  }
  return cache
}

async function persist(db: DbFile): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true })
  // modo 0600: só o dono do arquivo lê (contém hashes de senha)
  await fs.writeFile(TMP_FILE, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600 })
  await fs.copyFile(DB_FILE, BAK_FILE).catch(() => {}) // primeira gravação: ainda não existe
  await fs.rename(TMP_FILE, DB_FILE)
}

/** Executa uma alteração de forma serializada e grava em disco. `bump=false` não avisa as outras telas. */
function mutate<T>(fn: (db: DbFile) => T, bump = true): Promise<T> {
  const run = queue.then(async () => {
    const db = await load()
    const result = fn(db)
    if (bump) db.rev++
    try {
      await persist(db)
    } catch (e) {
      cache = null // memória pode estar à frente do disco: recarrega do arquivo na próxima chamada
      throw e
    }
    return result
  })
  queue = run.catch(() => {})
  return run
}

// ---------- senhas e sessões ----------
const scryptAsync = promisify(scrypt) as unknown as (pw: string, salt: Buffer, keylen: number) => Promise<Buffer>
const DUMMY_SALT = randomBytes(16)

async function hashPassword(pw: string, saltHex?: string): Promise<{ salt: string; hash: string }> {
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : randomBytes(16)
  const key = await scryptAsync(pw, salt, 64)
  return { salt: salt.toString('hex'), hash: key.toString('hex') }
}

async function verifyPassword(pw: string, u: UserRecord): Promise<boolean> {
  const { hash } = await hashPassword(pw, u.salt)
  const a = Buffer.from(hash, 'hex')
  const b = Buffer.from(u.hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function addSession(d: DbFile, userId: number): string {
  const now = Date.now()
  d.sessions = d.sessions.filter((s) => s.expires > now)
  const mine = d.sessions.filter((s) => s.userId === userId).sort((a, b) => a.expires - b.expires)
  if (mine.length >= MAX_SESSIONS_PER_USER) {
    const drop = new Set(mine.slice(0, mine.length - MAX_SESSIONS_PER_USER + 1).map((s) => s.id))
    d.sessions = d.sessions.filter((s) => !drop.has(s.id))
  }
  const token = randomBytes(32).toString('hex')
  d.sessions.push({ id: sha256(token), userId, expires: now + SESSION_MS })
  return token
}

// ---------- validação ----------
function cleanUsuario(v: unknown): string {
  const u = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (!USER_RE.test(u)) throw new ValidationError('Usuário inválido: use de 3 a 32 caracteres (letras minúsculas, números, ponto, hífen ou _)')
  return u
}

function cleanSenha(v: unknown, field = 'Senha'): string {
  const s = typeof v === 'string' ? v : ''
  if (s.length < 6) throw new ValidationError(`${field} deve ter pelo menos 6 caracteres`)
  if (s.length > 200) throw new ValidationError(`${field} muito longa`)
  return s
}

function cleanPapel(v: unknown): Papel {
  if (v !== 'admin' && v !== 'usuario') throw new ValidationError('Papel inválido')
  return v
}

/** Só valida o formato. Quais campos são obrigatórios depende do portal e é conferido dentro da gravação. */
function parseEdital(body: any, partial: boolean): Partial<EditalInput> {
  if (!body || typeof body !== 'object') throw new ValidationError('Corpo inválido')
  const out: Partial<EditalInput> = {}
  const has = (k: string) => !partial || body[k] !== undefined

  if (has('cat')) out.cat = str(body.cat, 'Categoria', true, 60)
  if (has('mod')) {
    const m = Number(body.mod ?? 0)
    if (![0, 1, 2].includes(m)) throw new ValidationError('Modalidade inválida')
    out.mod = m as Modalidade
  }
  if (has('num')) out.num = str(body.num, 'Nº do edital', false, 80)
  if (has('uasg')) out.uasg = str(body.uasg, 'UASG / Nº de identificação', false, 80) // texto livre: qualquer número ou formato
  if (has('orgao')) out.orgao = str(body.orgao, 'Órgão comprador', false, 200)
  if (has('cidade')) out.cidade = str(body.cidade, 'Cidade', false, 80)
  if (has('uf')) out.uf = str(body.uf, 'UF', false, 2).toUpperCase()
  if (has('valorGanho')) {
    const v = Number(body.valorGanho ?? 0)
    if (!Number.isFinite(v) || v < 0 || v > 1e12) throw new ValidationError('Valor ganho inválido')
    out.valorGanho = Math.round(v * 100) / 100 // centavos
  }
  if (has('impugnacoes')) {
    if (!Array.isArray(body.impugnacoes ?? [])) throw new ValidationError('Impugnações inválidas')
    out.impugnacoes = lerImpugsDoEdital(body.impugnacoes ?? [])
  }
  if (has('valorHomologado')) {
    const v = Number(body.valorHomologado ?? 0)
    if (!Number.isFinite(v) || v < 0 || v > 1e12) throw new ValidationError('Valor homologado inválido')
    out.valorHomologado = Math.round(v * 100) / 100
  }
  if (has('portal')) out.portal = str(body.portal, 'Portal', false, 60)
  if (has('empresa')) out.empresa = str(body.empresa, 'Empresa', false, 60)
  if (has('data')) {
    const d = str(body.data, 'Data', false, 10)
    if (d && !isoValida(d)) throw new ValidationError('Data inválida')
    out.data = d
  }
  if (has('hora')) {
    const h = str(body.hora, 'Horário', false, 5)
    if (h && !horaValida(h)) throw new ValidationError('Horário inválido (use 24 horas, HH:mm)')
    out.hora = h
  }
  if (has('status')) {
    out.status = str(body.status, 'Status', true, 60)
  }
  if (has('resultado')) {
    const r = body.resultado ?? ''
    if (r !== '' && r !== 'GANHAMOS' && r !== 'PERDEMOS') throw new ValidationError('Resultado inválido')
    out.resultado = r
  }
  return out
}

/** Regras do portal pelo nome; sem portal (ou portal que já não está cadastrado) valem as regras padrão. */
const regrasDo = (d: DbFile, nome: string): RegrasCampos => d.portais.find((p) => p.nome === nome)?.campos ?? REGRAS_PADRAO

/** Portais que o usuário pode usar (pelo nome); null = todos. */
function portaisPermitidos(d: DbFile, u: UserRecord): Set<string> | null {
  if (u.papel === 'admin' || u.portais === null) return null
  return new Set(d.portais.filter((p) => u.portais!.includes(p.id)).map((p) => p.nome))
}

/** Usuário restrito enxerga os editais dos portais dele e os sem portal. */
const enxerga = (perm: Set<string> | null, e: Pick<Edital, 'portal'>) => !perm || !e.portal || perm.has(e.portal)

/**
 * Confere categoria, status, portal e campos obrigatórios do edital já com as alterações aplicadas.
 * Valor ganho e resultado só existem na edição: ao criar, não são exigidos.
 */
function conferirEdital(d: DbFile, v: EditalInput, perm: Set<string> | null, portalAnterior?: string, criando = false): void {
  if (!d.categorias.some((c) => c.id === v.cat)) throw new ValidationError('Categoria inválida: escolha uma categoria cadastrada')
  if (v.empresa && !d.empresas.some((x) => x.id === v.empresa)) throw new ValidationError('Empresa inválida: escolha uma empresa cadastrada')
  if (!d.statuses.some((s) => s.id === v.status)) throw new ValidationError('Status inválido')
  if (v.portal && v.portal !== portalAnterior) {
    if (!d.portais.some((p) => p.nome === v.portal)) throw new ValidationError('Portal não cadastrado. Cadastre-o no painel Portais.')
    if (perm && !perm.has(v.portal)) throw new ForbiddenError('Você não tem acesso a este portal')
  }
  const falta = camposFaltando(regrasDo(d, v.portal), v, criando ? ['valorGanho'] : [])
  if (falta.length) throw new ValidationError(`Campo${falta.length > 1 ? 's' : ''} obrigatório${falta.length > 1 ? 's' : ''}: ${falta.join(', ')}`)
}

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)

// ---------- visões e autorização ----------
function view(d: DbFile, userId: number): AppState {
  const me = d.users.find((u) => u.id === userId)
  if (!me) throw new AuthError('Sessão inválida')
  return {
    rev: d.rev,
    me: pub(d, me),
    users: me.papel === 'admin' ? d.users.map((u) => pub(d, u)) : [],
    perfis: me.papel === 'admin' ? d.perfis : [],
    ...(() => {
      const perm = portaisPermitidos(d, me)
      return {
        editais: d.editais.filter((e) => enxerga(perm, e)),
        portais: perm ? d.portais.filter((p) => perm.has(p.nome)) : d.portais,
      }
    })(),
    categorias: d.categorias,
    statuses: d.statuses,
    transicoes: d.transicoes,
    impugnacoes: d.impugnacoes,
    impugStatuses: d.impugStatuses,
    empresas: d.empresas,
  }
}

/** Reconfirma, dentro da gravação, que o usuário ainda existe (e ainda é admin, se preciso). */
function actorIn(d: DbFile, user: UserRecord, needAdmin = false): UserRecord {
  const me = d.users.find((u) => u.id === user.id)
  if (!me) throw new AuthError('Sessão inválida')
  if (needAdmin && me.papel !== 'admin') throw new ForbiddenError('Apenas administradores podem fazer isso')
  return me
}

// ----- histórico fixo -----
const CAMPOS: Array<[keyof EditalInput, string]> = [
  ['cat', 'Categoria'], ['empresa', 'Empresa'], ['num', 'Nº do edital'], ['uasg', 'UASG / Nº de identificação'], ['portal', 'Portal'],
  ['orgao', 'Órgão comprador'], ['cidade', 'Cidade'], ['uf', 'UF'], ['mod', 'Modalidade'],
  ['data', 'Data limite'], ['hora', 'Horário'], ['status', 'Status'], ['resultado', 'Resultado'], ['valorGanho', 'Valor ganho'],
  ['valorHomologado', 'Valor homologado'],
]
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function mostra(d: DbFile, k: keyof EditalInput, v: any): string {
  if (k === 'mod') return MODALIDADES[v as Modalidade] ?? String(v)
  if (k === 'status') return d.statuses.find((s) => s.id === v)?.nome ?? String(v)
  if (k === 'resultado') return v ? RESULTADOS[v as 'GANHAMOS' | 'PERDEMOS'] : 'Em andamento'
  if (k === 'cat') return d.categorias.find((c) => c.id === v)?.nome ?? String(v)
  if (k === 'empresa') return v ? (d.empresas.find((x) => x.id === v)?.nome ?? String(v)) : '—'
  if (k === 'valorGanho' || k === 'valorHomologado') return v ? BRL.format(v) : '—'
  if (k === 'data') return v ? String(v).split('-').reverse().join('/') : 'A definir'
  if (k === 'hora') return v || '—'
  return v === '' || v == null ? '—' : String(v)
}
/** Compara o edital atual com o que vai ser gravado e lista só o que mudou. */
function diffEdital(d: DbFile, e: Edital, patch: Partial<EditalInput>): LogMudanca[] {
  const out: LogMudanca[] = []
  for (const [k, campo] of CAMPOS) {
    if (patch[k] === undefined || patch[k] === (e as any)[k]) continue
    out.push({ campo, de: mostra(d, k, (e as any)[k]), para: mostra(d, k, patch[k]) })
  }
  return out
}
function addLog(e: Edital, me: UserRecord, acao: LogEntry['acao'], mudancas: LogMudanca[], obs?: string) {
  const entry: LogEntry = { ts: Date.now(), por: who(me), acao, mudancas }
  if (obs) entry.obs = obs
  e.log.push(entry)
  if (e.log.length > 500) e.log.splice(0, e.log.length - 500)
}

const stamp = (e: Edital, me: UserRecord) => {
  e.v++
  e.atualizadoPor = who(me)
  e.atualizadoEm = Date.now()
}

// ---------- catálogos simples (impugnações e status de impugnação) ----------
type ChaveItens = 'impugnacoes' | 'impugStatuses' | 'empresas'

function criarItem(admin: UserRecord, k: ChaveItens, body: any): Promise<AppState> {
  const nome = str(body?.nome, 'Nome', true, 60)
  const cor = cleanCor(body?.cor)
  return mutate((d) => {
    const me = actorIn(d, admin, true)
    const lista = d[k]
    if (lista.some((i) => i.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe um item com esse nome')
    const base = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'ITEM'
    let id = base
    for (let n = 2; lista.some((i) => i.id === id); n++) id = `${base}-${n}`
    lista.push({ id, nome, cor })
    return view(d, me.id)
  })
}

function editarItem(admin: UserRecord, k: ChaveItens, id: string, body: any): Promise<AppState> {
  const nome = str(body?.nome, 'Nome', true, 60)
  const cor = cleanCor(body?.cor)
  return mutate((d) => {
    const me = actorIn(d, admin, true)
    const it = d[k].find((i) => i.id === id)
    if (!it) throw new NotFoundError('Item não encontrado')
    if (d[k].some((i) => i.id !== id && i.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe um item com esse nome')
    it.nome = nome
    it.cor = cor
    return view(d, me.id)
  })
}

function excluirItem(admin: UserRecord, k: ChaveItens, id: string): Promise<AppState> {
  return mutate((d) => {
    const me = actorIn(d, admin, true)
    if (!d[k].some((i) => i.id === id)) throw new NotFoundError('Item não encontrado')
    const usos = d.editais.filter((e) => (k === 'empresas' ? e.empresa === id : e.impugnacoes.some((i) => (k === 'impugnacoes' ? i.id : i.status) === id))).length
    if (usos) throw new ValidationError(`Este item é usado por ${usos} edital(is). Remova-o deles antes de excluir.`)
    d[k] = d[k].filter((i) => i.id !== id)
    return view(d, me.id)
  })
}

function ordenarItens(admin: UserRecord, k: ChaveItens, body: any): Promise<AppState> {
  return mutate((d) => {
    const me = actorIn(d, admin, true)
    d[k] = reordenar(d[k], body?.ids)
    return view(d, me.id)
  })
}

// ---------- API do banco ----------
export const db = {
  // ===== autenticação =====
  async authStatus(user: UserRecord | null): Promise<AuthStatus> {
    const d = await load()
    const needsSetup = d.users.length === 0
    return { needsSetup, user: user ? pub(d, user) : null, ...(needsSetup && d.legacy ? { sugestao: d.legacy } : {}) }
  },

  /** Cria o primeiro usuário (administrador). Só funciona enquanto não existe nenhum usuário. */
  async setup(body: any): Promise<{ token: string; user: PublicUser }> {
    const usuario = cleanUsuario(body?.usuario)
    const senha = cleanSenha(body?.senha)
    const nome = str(body?.nome, 'Nome', true, 80)
    const cargo = str(body?.cargo, 'Cargo', false, 80)
    const pw = await hashPassword(senha)
    return mutate((d) => {
      if (d.users.length) throw new ForbiddenError('O sistema já foi configurado. Entre com seu usuário.')
      const u: UserRecord = { id: d.nextUserId++, usuario, nome, cargo, papel: 'admin', portais: null, perfil: null, ...pw, criadoEm: Date.now() }
      d.users.push(u)
      return { token: addSession(d, u.id), user: pub(d, u) }
    })
  },

  async login(body: any): Promise<{ token: string; user: PublicUser }> {
    const usuario = typeof body?.usuario === 'string' ? body.usuario.trim().toLowerCase() : ''
    const senha = typeof body?.senha === 'string' ? body.senha.slice(0, 200) : ''
    const d = await load()
    const u = d.users.find((x) => x.usuario === usuario)
    // mesmo com usuário inexistente gasta o mesmo tempo (não revela quais logins existem)
    const ok = u ? await verifyPassword(senha, u) : (await hashPassword(senha, DUMMY_SALT.toString('hex')), false)
    if (!u || !ok) throw new AuthError('Usuário ou senha incorretos')
    return mutate((d2) => {
      const cur = d2.users.find((x) => x.id === u.id)
      if (!cur) throw new AuthError('Usuário ou senha incorretos')
      return { token: addSession(d2, cur.id), user: pub(d2, cur) }
    }, false)
  },

  logout(token: string): Promise<void> {
    const id = sha256(token)
    return mutate((d) => {
      d.sessions = d.sessions.filter((s) => s.id !== id)
    }, false)
  },

  async userFromToken(token: string | null): Promise<UserRecord | null> {
    if (!token) return null
    const d = await load()
    const id = sha256(token)
    const s = d.sessions.find((x) => x.id === id)
    if (!s || s.expires <= Date.now()) return null
    return d.users.find((u) => u.id === s.userId) ?? null
  },

  // ===== leitura =====
  /** Com `since` igual à revisão atual devolve só { unchanged: true } (consulta barata para sincronizar). */
  async getState(user: UserRecord, since?: number): Promise<AppState | Unchanged> {
    await queue.catch(() => {})
    const d = await load()
    if (since !== undefined && since === d.rev && d.users.some((u) => u.id === user.id)) return { unchanged: true, rev: d.rev }
    return view(d, user.id)
  },

  // ===== perfil =====
  updateMe(user: UserRecord, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome', true, 80)
    const cargo = str(body?.cargo, 'Cargo', false, 80)
    return mutate((d) => {
      const me = actorIn(d, user)
      me.nome = nome
      me.cargo = cargo
      return view(d, me.id)
    })
  },

  async changePassword(user: UserRecord, body: any, token: string): Promise<void> {
    const d0 = await load()
    const cur = d0.users.find((u) => u.id === user.id)
    if (!cur) throw new AuthError('Sessão inválida')
    // senha atual errada é erro de validação (400), não 401 — senão a tela deslogaria
    if (!(await verifyPassword(typeof body?.atual === 'string' ? body.atual : '', cur))) throw new ValidationError('Senha atual incorreta')
    const pw = await hashPassword(cleanSenha(body?.nova, 'Nova senha'))
    const keep = sha256(token)
    await mutate((d) => {
      const me = actorIn(d, user)
      Object.assign(me, pw)
      d.sessions = d.sessions.filter((s) => s.userId !== me.id || s.id === keep) // desconecta os outros aparelhos
    }, false)
  },

  // ===== administração de usuários =====
  async createUser(admin: UserRecord, body: any): Promise<AppState> {
    const usuario = cleanUsuario(body?.usuario)
    const senha = cleanSenha(body?.senha)
    const nome = str(body?.nome, 'Nome', true, 80)
    const cargo = str(body?.cargo, 'Cargo', false, 80)
    const papel = cleanPapel(body?.papel ?? 'usuario')
    const pw = await hashPassword(senha)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (d.users.some((u) => u.usuario === usuario)) throw new ValidationError('Já existe um usuário com esse login')
      d.users.push({ id: d.nextUserId++, usuario, nome, cargo, papel, portais: cleanPortaisUser(d, body?.portais), perfil: cleanPerfilUser(d, body?.perfil, papel), ...pw, criadoEm: Date.now() })
      return view(d, me.id)
    })
  },

  async updateUser(admin: UserRecord, id: number, body: any): Promise<AppState> {
    const nome = body?.nome !== undefined ? str(body.nome, 'Nome', true, 80) : undefined
    const cargo = body?.cargo !== undefined ? str(body.cargo, 'Cargo', false, 80) : undefined
    const papel = body?.papel !== undefined ? cleanPapel(body.papel) : undefined
    const senha = typeof body?.senha === 'string' && body.senha !== '' ? cleanSenha(body.senha, 'Nova senha') : undefined
    const pw = senha ? await hashPassword(senha) : undefined
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      const t = d.users.find((u) => u.id === id)
      if (!t) throw new NotFoundError('Usuário não encontrado')
      if (papel && t.papel === 'admin' && papel !== 'admin' && d.users.filter((u) => u.papel === 'admin').length === 1) {
        throw new ValidationError('É preciso manter pelo menos um administrador')
      }
      if (nome !== undefined) t.nome = nome
      if (cargo !== undefined) t.cargo = cargo
      if (papel) t.papel = papel
      if (body?.portais !== undefined) t.portais = cleanPortaisUser(d, body.portais)
      if (body?.perfil !== undefined || papel) t.perfil = cleanPerfilUser(d, body?.perfil === undefined ? t.perfil : body.perfil, t.papel)
      if (pw) {
        Object.assign(t, pw)
        d.sessions = d.sessions.filter((s) => s.userId !== t.id) // senha trocada pelo admin: derruba as sessões dele
      }
      return view(d, me.id)
    })
  },

  deleteUser(admin: UserRecord, id: number): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (id === me.id) throw new ValidationError('Você não pode excluir o seu próprio usuário')
      const t = d.users.find((u) => u.id === id)
      if (!t) throw new NotFoundError('Usuário não encontrado')
      d.users = d.users.filter((u) => u.id !== id)
      d.sessions = d.sessions.filter((s) => s.userId !== id)
      return view(d, me.id)
    })
  },

  // ===== editais (todos os usuários enxergam e alteram os mesmos dados) =====
  createEdital(user: UserRecord, body: any): Promise<AppState> {
    // todo edital novo começa no status inicial; valores e resultado vêm depois, pelo fluxo
    const v = parseEdital({ mod: 0, cidade: '', portal: '', data: '', hora: '', ...body, impugnacoes: body?.impugnacoes ?? [], status: 'PREP', valorGanho: 0, valorHomologado: 0, resultado: '' }, false) as EditalInput
    return mutate((d) => {
      const me = actorIn(d, user)
      conferirEdital(d, v, portaisPermitidos(d, me), undefined, true)
      v.impugnacoes = conferirImpugs(d, v.impugnacoes).map((i) => ({ id: i.id, status: '' })) // ao cadastrar ainda não há resposta
      const novo: Edital = { id: d.nextId++, retifs: [], log: [], v: 1, criadoPor: who(me), atualizadoPor: who(me), atualizadoEm: Date.now(), ...v }
      addLog(novo, me, 'criou', [])
      d.editais.push(novo)
      return view(d, me.id)
    })
  },

  /** `body.v` (opcional) é a versão que o usuário estava editando; se outro já alterou, devolve conflito (409). */
  updateEdital(user: UserRecord, id: number, body: any): Promise<AppState> {
    const patch = parseEdital(body, true)
    const expectedV = body?.v !== undefined ? Number(body.v) : undefined
    const motivo = str(body?.motivo, 'Motivo', false, 500)
    const valor = Math.round((Number(body?.valor) || 0) * 100) / 100
    if (!Number.isFinite(valor) || valor < 0 || valor > 1e12) throw new ValidationError('Valor inválido')
    return mutate((d) => {
      const me = actorIn(d, user)
      const e = d.editais.find((x) => x.id === id)
      if (!e || !enxerga(portaisPermitidos(d, me), e)) throw new NotFoundError('Edital não encontrado')
      // dados base: só os campos que o perfil do usuário libera (trocar o valor de um campo bloqueado é recusado)
      const perms = permsDe(d, me)
      for (const c of CAMPOS_BASE) {
        if (patch[c.key] !== undefined && patch[c.key] !== e[c.key] && !perms.campos.includes(c.key)) {
          throw new ForbiddenError(`Seu perfil não permite alterar: ${c.label}.`)
        }
      }
      if (expectedV !== undefined && expectedV !== e.v) {
        throw new ConflictError(
          `${e.atualizadoPor || 'Outro usuário'} alterou este edital enquanto você editava. Os dados na tela foram atualizados — revise e salve de novo para sobrescrever.`,
        )
      }
      // o formulário completo (que traz categoria e portal) é conferido contra as regras do portal; trocas rápidas (status, resultado) não
      if (patch.cat !== undefined || patch.portal !== undefined) conferirEdital(d, { ...e, ...patch } as EditalInput, portaisPermitidos(d, me), e.portal)
      else if (patch.status !== undefined && !d.statuses.some((s) => s.id === patch.status)) throw new ValidationError('Status inválido')
      // mudança de status: só vale se existir a ligação no fluxo, com o que ela exigir preenchido
      const trocouStatus = patch.status !== undefined && patch.status !== e.status
      if (trocouStatus && d.transicoes.length) {
        const t = d.transicoes.find((x) => x.de === e.status && x.para === patch.status)
        if (!t) {
          const nome = (id: string) => d.statuses.find((s) => s.id === id)?.nome ?? id
          throw new ValidationError(`O fluxo não permite mudar de "${nome(e.status)}" para "${nome(patch.status!)}".`)
        }
        if (t.exige === 'motivo' && !motivo) throw new ValidationError(`Informe o motivo (${t.rotulo}).`)
        if ((t.exige === 'valorGanho' || t.exige === 'valorHomologado') && !(valor > 0)) throw new ValidationError(`Informe o valor total (${t.rotulo}).`)
        if (t.exige === 'valorGanho' || t.exige === 'valorHomologado') patch[t.exige] = valor
        if (t.resultado) patch.resultado = t.resultado
        // impugnações: quem tem impugnação precisa responder o resultado de todas
        if (t.exige === 'impugnacoes' && e.impugnacoes.length) {
          const resp = body?.impugRespostas && typeof body.impugRespostas === 'object' ? body.impugRespostas : {}
          for (const i of e.impugnacoes) {
            if (!d.impugStatuses.some((s) => s.id === resp[i.id])) throw new ValidationError('Informe o resultado de todas as impugnações.')
          }
          patch.impugnacoes = e.impugnacoes.map((i) => ({ id: i.id, status: resp[i.id] as string }))
        }
      }
      if (patch.impugnacoes) patch.impugnacoes = conferirImpugs(d, patch.impugnacoes)
      const mudancas = diffEdital(d, e, patch)
      if (patch.impugnacoes) {
        const de = textoImpugs(d, e.impugnacoes)
        const para = textoImpugs(d, patch.impugnacoes)
        if (de !== para) mudancas.push({ campo: 'Impugnações', de, para })
      }
      Object.assign(e, patch)
      if (mudancas.length) addLog(e, me, 'alterou', mudancas, trocouStatus ? motivo : undefined)
      stamp(e, me)
      return view(d, me.id)
    })
  },

  deleteEditais(user: UserRecord, ids: number[]): Promise<AppState> {
    const set = new Set(ids.map(Number))
    return mutate((d) => {
      const me = actorIn(d, user)
      if (!permsDe(d, me).excluir) throw new ForbiddenError('Seu perfil não permite excluir editais.')
      const perm = portaisPermitidos(d, me)
      d.editais = d.editais.filter((e) => !(set.has(e.id) && enxerga(perm, e)))
      return view(d, me.id)
    })
  },

  addRetif(user: UserRecord, id: number, body: any): Promise<AppState> {
    const desc = str(body?.desc, 'Descrição', true, 1000)
    const data = str(body?.data, 'Data', false, 10)
    const hora = str(body?.hora, 'Horário', false, 5)
    if (data && !isoValida(data)) throw new ValidationError('Data inválida')
    if (hora && !horaValida(hora)) throw new ValidationError('Horário inválido (use 24 horas, HH:mm)')
    return mutate((d) => {
      const me = actorIn(d, user)
      const e = d.editais.find((x) => x.id === id)
      if (!e || !enxerga(portaisPermitidos(d, me), e)) throw new NotFoundError('Edital não encontrado')
      let dias = 0
      // com fluxo configurado a retificação não tira o edital do ponto em que ele está; sem fluxo, vira "Retificado"
      const livre = d.transicoes.length === 0
      const mudancas = diffEdital(d, e, { data: data || undefined, hora: hora || undefined, status: livre ? 'RETIF' : undefined })
      if (data && data !== e.data) {
        if (e.data) dias = Math.max(dayDiff(e.data, data), 0)
        e.data = data
      }
      if (hora) e.hora = hora
      e.retifs.push({ ts: Date.now(), desc, dias, por: who(me) })
      if (livre) e.status = 'RETIF'
      addLog(e, me, 'retificou', mudancas, desc)
      stamp(e, me)
      return view(d, me.id)
    })
  },

  // ===== portais (administrador) =====
  createPortal(admin: UserRecord, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome do portal', true, 60)
    const campos = cleanRegras(body?.campos)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (d.portais.some((p) => p.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe um portal com esse nome')
      d.portais.push({ id: d.nextPortalId++, nome, campos })
      return view(d, me.id)
    })
  },

  updatePortal(admin: UserRecord, id: number, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome do portal', true, 60)
    const campos = cleanRegras(body?.campos)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      const p = d.portais.find((x) => x.id === id)
      if (!p) throw new NotFoundError('Portal não encontrado')
      if (d.portais.some((x) => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe um portal com esse nome')
      if (nome !== p.nome) for (const e of d.editais) if (e.portal === p.nome) e.portal = nome // os editais acompanham o novo nome
      p.nome = nome
      p.campos = campos
      return view(d, me.id)
    })
  },

  /** Os editais que usavam o portal mantêm o nome dele no registro. */
  deletePortal(admin: UserRecord, id: number): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (!d.portais.some((p) => p.id === id)) throw new NotFoundError('Portal não encontrado')
      d.portais = d.portais.filter((p) => p.id !== id)
      for (const u of d.users) if (u.portais) u.portais = u.portais.filter((x) => x !== id)
      return view(d, me.id)
    })
  },

  // ===== categorias (administrador) =====
  createCategoria(admin: UserRecord, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome da categoria', true, 40)
    const cor = cleanCor(body?.cor)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (d.categorias.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe uma categoria com esse nome')
      const base = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'CAT'
      let id = base
      for (let i = 2; d.categorias.some((c) => c.id === id); i++) id = `${base}-${i}`
      d.categorias.push({ id, nome, cor })
      return view(d, me.id)
    })
  },

  updateCategoria(admin: UserRecord, id: string, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome da categoria', true, 40)
    const cor = cleanCor(body?.cor)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      const c = d.categorias.find((x) => x.id === id)
      if (!c) throw new NotFoundError('Categoria não encontrada')
      if (d.categorias.some((x) => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe uma categoria com esse nome')
      c.nome = nome
      c.cor = cor
      return view(d, me.id)
    })
  },

  deleteCategoria(admin: UserRecord, id: string): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (!d.categorias.some((c) => c.id === id)) throw new NotFoundError('Categoria não encontrada')
      if (d.categorias.length === 1) throw new ValidationError('É preciso manter pelo menos uma categoria')
      const usados = d.editais.filter((e) => e.cat === id).length
      if (usados) {
        throw new ValidationError(`Esta categoria é usada por ${usados} edital(is). Mude a categoria deles (ou exclua-os) antes de remover a categoria.`)
      }
      d.categorias = d.categorias.filter((c) => c.id !== id)
      return view(d, me.id)
    })
  },

  reordenarCategorias(admin: UserRecord, body: any): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      d.categorias = reordenar(d.categorias, body?.ids)
      return view(d, me.id)
    })
  },

  reordenarStatus(admin: UserRecord, body: any): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      d.statuses = reordenar(d.statuses, body?.ids)
      return view(d, me.id)
    })
  },

  // ===== status (administrador) =====
  createStatus(admin: UserRecord, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome do status', true, 40)
    const cor = cleanCor(body?.cor)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (d.statuses.some((s) => s.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe um status com esse nome')
      const base = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'STATUS'
      let id = base
      for (let i = 2; d.statuses.some((s) => s.id === id); i++) id = `${base}-${i}`
      d.statuses.push({ id, nome, cor })
      return view(d, me.id)
    })
  },

  updateStatus(admin: UserRecord, id: string, body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome do status', true, 40)
    const cor = cleanCor(body?.cor)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      const s = d.statuses.find((x) => x.id === id)
      if (!s) throw new NotFoundError('Status não encontrado')
      if (d.statuses.some((x) => x.id !== id && x.nome.toLowerCase() === nome.toLowerCase())) throw new ValidationError('Já existe um status com esse nome')
      s.nome = nome
      s.cor = cor
      return view(d, me.id)
    })
  },

  deleteStatus(admin: UserRecord, id: string): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (!d.statuses.some((s) => s.id === id)) throw new NotFoundError('Status não encontrado')
      if (STATUS_FIXOS.includes(id)) throw new ValidationError('Este status é usado pelo sistema (inicial de todo edital novo / aplicado nas retificações). Você pode renomeá-lo, mas não excluí-lo.')
      const usados = d.editais.filter((e) => e.status === id).length
      if (usados) throw new ValidationError(`Este status é usado por ${usados} edital(is). Mude o status deles antes de excluí-lo.`)
      d.statuses = d.statuses.filter((s) => s.id !== id)
      d.transicoes = d.transicoes.filter((t) => t.de !== id && t.para !== id)
      return view(d, me.id)
    })
  },

  // ===== perfis de permissão (administrador) =====
  createPerfil(admin: UserRecord, body: any): Promise<AppState> {
    const v = cleanPerfil(body)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (d.perfis.some((p) => p.nome.toLowerCase() === v.nome.toLowerCase())) throw new ValidationError('Já existe um perfil com esse nome')
      d.perfis.push({ id: d.nextPerfilId++, ...v })
      return view(d, me.id)
    })
  },

  updatePerfil(admin: UserRecord, id: number, body: any): Promise<AppState> {
    const v = cleanPerfil(body)
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      const p = d.perfis.find((x) => x.id === id)
      if (!p) throw new NotFoundError('Perfil não encontrado')
      if (d.perfis.some((x) => x.id !== id && x.nome.toLowerCase() === v.nome.toLowerCase())) throw new ValidationError('Já existe um perfil com esse nome')
      Object.assign(p, v)
      return view(d, me.id)
    })
  },

  deletePerfil(admin: UserRecord, id: number): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      if (!d.perfis.some((p) => p.id === id)) throw new NotFoundError('Perfil não encontrado')
      const usos = d.users.filter((u) => u.perfil === id).length
      if (usos) throw new ValidationError(`Este perfil é usado por ${usos} usuário(s). Mude o perfil deles antes de excluí-lo.`)
      d.perfis = d.perfis.filter((p) => p.id !== id)
      return view(d, me.id)
    })
  },

  // ===== impugnações e seus status (administrador) =====
  createImpugnacao: (admin: UserRecord, body: any) => criarItem(admin, 'impugnacoes', body),
  updateImpugnacao: (admin: UserRecord, id: string, body: any) => editarItem(admin, 'impugnacoes', id, body),
  deleteImpugnacao: (admin: UserRecord, id: string) => excluirItem(admin, 'impugnacoes', id),
  reordenarImpugnacoes: (admin: UserRecord, body: any) => ordenarItens(admin, 'impugnacoes', body),
  createEmpresa: (admin: UserRecord, body: any) => criarItem(admin, 'empresas', body),
  updateEmpresa: (admin: UserRecord, id: string, body: any) => editarItem(admin, 'empresas', id, body),
  deleteEmpresa: (admin: UserRecord, id: string) => excluirItem(admin, 'empresas', id),
  reordenarEmpresas: (admin: UserRecord, body: any) => ordenarItens(admin, 'empresas', body),
  createImpugStatus: (admin: UserRecord, body: any) => criarItem(admin, 'impugStatuses', body),
  updateImpugStatus: (admin: UserRecord, id: string, body: any) => editarItem(admin, 'impugStatuses', id, body),
  deleteImpugStatus: (admin: UserRecord, id: string) => excluirItem(admin, 'impugStatuses', id),
  reordenarImpugStatus: (admin: UserRecord, body: any) => ordenarItens(admin, 'impugStatuses', body),

  /** Grava de uma vez as ligações do fluxo e a posição de cada status no mapa. Só administradores. */
  salvarFluxo(admin: UserRecord, body: any): Promise<AppState> {
    if (!Array.isArray(body?.transicoes)) throw new ValidationError('Fluxo inválido')
    const pos = body?.posicoes && typeof body.posicoes === 'object' ? body.posicoes : {}
    return mutate((d) => {
      const me = actorIn(d, admin, true)
      const lidas = lerTransicoes(body.transicoes, d.statuses)
      if (lidas.length !== body.transicoes.length) throw new ValidationError('Há ligações inválidas ou repetidas no fluxo')
      d.transicoes = lidas
      for (const s of d.statuses) {
        const p = pos[s.id]
        if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) {
          s.x = Math.round(Math.min(Math.max(p.x, 0), 5000))
          s.y = Math.round(Math.min(Math.max(p.y, 0), 5000))
        }
      }
      return view(d, me.id)
    })
  },

  /** Apaga todos os editais. Só administradores. Usuários e senhas são mantidos. */
  clearAll(user: UserRecord): Promise<AppState> {
    return mutate((d) => {
      const me = actorIn(d, user, true)
      d.editais = []
      d.nextId = 1
      return view(d, me.id)
    })
  },

  // ===== uso offline (script reset-password) =====
  async resetPasswordOffline(usuario: string, senha: string): Promise<boolean> {
    const login = cleanUsuario(usuario)
    const pw = await hashPassword(cleanSenha(senha, 'Nova senha'))
    return mutate((d) => {
      const t = d.users.find((u) => u.usuario === login)
      if (!t) return false
      Object.assign(t, pw)
      d.sessions = d.sessions.filter((s) => s.userId !== t.id)
      return true
    })
  },

  async listUsernames(): Promise<string[]> {
    return (await load()).users.map((u) => u.usuario)
  },
}
