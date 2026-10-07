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
  STATUS_KEYS,
  MODALIDADES,
  STATUS,
  RESULTADOS,
  type LogEntry,
  type LogMudanca,
  type AppState,
  type AuthStatus,
  type Categoria,
  type Edital,
  type EditalInput,
  type Modalidade,
  type Papel,
  type PublicUser,
  type StatusKey,
  type Unchanged,
} from '../src/shared'

export interface UserRecord extends PublicUser {
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
  users: UserRecord[]
  sessions: SessionRecord[]
  editais: Edital[]
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

// ---------- erros (a API converte em códigos HTTP) ----------
export class ValidationError extends Error {} // 400
export class AuthError extends Error {} // 401
export class ForbiddenError extends Error {} // 403
export class NotFoundError extends Error {} // 404
export class ConflictError extends Error {} // 409

const emptyDb = (): DbFile => ({ version: 2, rev: 0, nextId: 1, nextUserId: 1, users: [], sessions: [], editais: [] })

let cache: DbFile | null = null
let queue: Promise<unknown> = Promise.resolve()

// ---------- utilidades ----------
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')
const pub = (u: UserRecord): PublicUser => ({ id: u.id, usuario: u.usuario, nome: u.nome, cargo: u.cargo, papel: u.papel })
const who = (u: UserRecord) => u.nome || u.usuario

function str(v: unknown, field: string, required: boolean, max = 2000): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (required && !s) throw new ValidationError(`Campo obrigatório: ${field}`)
  if (s.length > max) throw new ValidationError(`Campo muito longo: ${field}`)
  return s
}

// ---------- leitura / gravação ----------
function normalize(raw: any): DbFile {
  const base = emptyDb()
  if (!raw || typeof raw !== 'object') return base

  const editais: Edital[] = (Array.isArray(raw.editais) ? raw.editais : []).map((e: any) => {
    // o antigo "valor estimado" (campo `valor`) saiu do sistema: não é copiado para o banco novo
    const { valor: _valorEstimado, ...resto } = e
    const ganho = Number(e.valorGanho)
    return {
      ...resto,
      retifs: (Array.isArray(e.retifs) ? e.retifs : []).map((r: any) => ({ ...r, por: typeof r.por === 'string' ? r.por : '' })),
      v: Number(e.v) || 1,
      criadoPor: typeof e.criadoPor === 'string' ? e.criadoPor : '',
      atualizadoPor: typeof e.atualizadoPor === 'string' ? e.atualizadoPor : '',
      atualizadoEm: Number(e.atualizadoEm) || 0,
      portal: typeof e.portal === 'string' ? e.portal : '',
      resultado: e.resultado === 'GANHAMOS' || e.resultado === 'PERDEMOS' ? e.resultado : '',
      log: Array.isArray(e.log) ? e.log : [],
      valorGanho: Number.isFinite(ganho) && ganho > 0 ? ganho : 0,
    }
  })
  const users: UserRecord[] = (Array.isArray(raw.users) ? raw.users : []).filter(
    (u: any) => u && typeof u.usuario === 'string' && typeof u.hash === 'string' && typeof u.salt === 'string',
  )
  const now = Date.now()
  const sessions: SessionRecord[] = (Array.isArray(raw.sessions) ? raw.sessions : []).filter(
    (s: any) => s && typeof s.id === 'string' && s.expires > now,
  )

  const out: DbFile = {
    version: 2,
    rev: Number(raw.rev) || 0,
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
  try {
    const text = await fs.readFile(DB_FILE, 'utf8')
    try {
      cache = normalize(JSON.parse(text))
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

function parseEdital(body: any, partial: boolean): Partial<EditalInput> {
  if (!body || typeof body !== 'object') throw new ValidationError('Corpo inválido')
  const out: Partial<EditalInput> = {}
  const has = (k: string) => !partial || body[k] !== undefined

  if (has('cat')) {
    if (body.cat !== 'TINTAS' && body.cat !== 'PNEUS') throw new ValidationError('Categoria inválida')
    out.cat = body.cat as Categoria
  }
  if (has('mod')) {
    const m = Number(body.mod ?? 0)
    if (![0, 1, 2].includes(m)) throw new ValidationError('Modalidade inválida')
    out.mod = m as Modalidade
  }
  if (has('num')) out.num = str(body.num, 'Nº do edital', true, 80)
  if (has('uasg')) out.uasg = str(body.uasg, 'UASG / Nº de identificação', true, 80) // texto livre: qualquer número ou formato
  if (has('orgao')) out.orgao = str(body.orgao, 'Órgão comprador', true, 200)
  if (has('uf')) out.uf = str(body.uf, 'UF', true, 2).toUpperCase()
  if (has('objeto')) out.objeto = str(body.objeto, 'Objeto', true, 2000)
  if (has('valorGanho')) {
    const v = Number(body.valorGanho ?? 0)
    if (!Number.isFinite(v) || v < 0 || v > 1e12) throw new ValidationError('Valor ganho inválido')
    out.valorGanho = Math.round(v * 100) / 100 // centavos
  }
  if (has('portal')) out.portal = str(body.portal, 'Portal', false, 60)
  if (has('data')) {
    const d = str(body.data, 'Data', false, 10)
    if (d && !DATE_RE.test(d)) throw new ValidationError('Data inválida')
    out.data = d
  }
  if (has('hora')) {
    const h = str(body.hora, 'Horário', false, 5)
    if (h && !TIME_RE.test(h)) throw new ValidationError('Horário inválido')
    out.hora = h
  }
  if (has('status')) {
    if (!STATUS_KEYS.includes(body.status)) throw new ValidationError('Status inválido')
    out.status = body.status as StatusKey
  }
  if (has('resultado')) {
    const r = body.resultado ?? ''
    if (r !== '' && r !== 'GANHAMOS' && r !== 'PERDEMOS') throw new ValidationError('Resultado inválido')
    out.resultado = r
  }
  return out
}

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)

// ---------- visões e autorização ----------
function view(d: DbFile, userId: number): AppState {
  const me = d.users.find((u) => u.id === userId)
  if (!me) throw new AuthError('Sessão inválida')
  return { rev: d.rev, me: pub(me), users: me.papel === 'admin' ? d.users.map(pub) : [], editais: d.editais }
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
  ['cat', 'Categoria'], ['num', 'Nº do edital'], ['uasg', 'UASG / Nº de identificação'], ['portal', 'Portal'],
  ['orgao', 'Órgão comprador'], ['uf', 'UF'], ['objeto', 'Objeto'], ['mod', 'Modalidade'],
  ['data', 'Data limite'], ['hora', 'Horário'], ['status', 'Status'], ['resultado', 'Resultado'], ['valorGanho', 'Valor ganho'],
]
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function mostra(k: keyof EditalInput, v: any): string {
  if (k === 'mod') return MODALIDADES[v as Modalidade] ?? String(v)
  if (k === 'status') return STATUS[v as StatusKey] ?? String(v)
  if (k === 'resultado') return v ? RESULTADOS[v as 'GANHAMOS' | 'PERDEMOS'] : 'Em andamento'
  if (k === 'cat') return v === 'TINTAS' ? 'Tintas' : 'Pneus'
  if (k === 'valorGanho') return v ? BRL.format(v) : '—'
  if (k === 'data') return v ? String(v).split('-').reverse().join('/') : 'A definir'
  return v === '' || v == null ? '—' : String(v)
}
/** Compara o edital atual com o que vai ser gravado e lista só o que mudou. */
function diffEdital(e: Edital, patch: Partial<EditalInput>): LogMudanca[] {
  const out: LogMudanca[] = []
  for (const [k, campo] of CAMPOS) {
    if (patch[k] === undefined || patch[k] === (e as any)[k]) continue
    out.push({ campo, de: mostra(k, (e as any)[k]), para: mostra(k, patch[k]) })
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

// ---------- API do banco ----------
export const db = {
  // ===== autenticação =====
  async authStatus(user: UserRecord | null): Promise<AuthStatus> {
    const d = await load()
    const needsSetup = d.users.length === 0
    return { needsSetup, user: user ? pub(user) : null, ...(needsSetup && d.legacy ? { sugestao: d.legacy } : {}) }
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
      const u: UserRecord = { id: d.nextUserId++, usuario, nome, cargo, papel: 'admin', ...pw, criadoEm: Date.now() }
      d.users.push(u)
      return { token: addSession(d, u.id), user: pub(u) }
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
      return { token: addSession(d2, cur.id), user: pub(cur) }
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
      d.users.push({ id: d.nextUserId++, usuario, nome, cargo, papel, ...pw, criadoEm: Date.now() })
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
    const v = parseEdital({ mod: 0, valorGanho: 0, portal: '', data: '', hora: '', status: 'PREP', resultado: '', ...body }, false) as EditalInput
    return mutate((d) => {
      const me = actorIn(d, user)
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
    return mutate((d) => {
      const me = actorIn(d, user)
      const e = d.editais.find((x) => x.id === id)
      if (!e) throw new NotFoundError('Edital não encontrado')
      if (expectedV !== undefined && expectedV !== e.v) {
        throw new ConflictError(
          `${e.atualizadoPor || 'Outro usuário'} alterou este edital enquanto você editava. Os dados na tela foram atualizados — revise e salve de novo para sobrescrever.`,
        )
      }
      const mudancas = diffEdital(e, patch)
      Object.assign(e, patch)
      if (mudancas.length) addLog(e, me, 'alterou', mudancas)
      stamp(e, me)
      return view(d, me.id)
    })
  },

  deleteEditais(user: UserRecord, ids: number[]): Promise<AppState> {
    const set = new Set(ids.map(Number))
    return mutate((d) => {
      const me = actorIn(d, user)
      d.editais = d.editais.filter((e) => !set.has(e.id))
      return view(d, me.id)
    })
  },

  addRetif(user: UserRecord, id: number, body: any): Promise<AppState> {
    const desc = str(body?.desc, 'Descrição', true, 1000)
    const data = str(body?.data, 'Data', false, 10)
    const hora = str(body?.hora, 'Horário', false, 5)
    if (data && !DATE_RE.test(data)) throw new ValidationError('Data inválida')
    if (hora && !TIME_RE.test(hora)) throw new ValidationError('Horário inválido')
    return mutate((d) => {
      const me = actorIn(d, user)
      const e = d.editais.find((x) => x.id === id)
      if (!e) throw new NotFoundError('Edital não encontrado')
      let dias = 0
      const mudancas = diffEdital(e, { data: data || undefined, hora: hora || undefined, status: 'RETIF' })
      if (data && data !== e.data) {
        if (e.data) dias = Math.max(dayDiff(e.data, data), 0)
        e.data = data
      }
      if (hora) e.hora = hora
      e.retifs.push({ ts: Date.now(), desc, dias, por: who(me) })
      e.status = 'RETIF'
      addLog(e, me, 'retificou', mudancas, desc)
      stamp(e, me)
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
