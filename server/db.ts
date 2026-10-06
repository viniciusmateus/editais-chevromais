/**
 * db.ts — banco de dados do Editais Chevomais.
 *
 * Os dados ficam num arquivo JSON em disco (por padrão ./data/db.json),
 * portanto sobrevivem a limpeza de cache, troca de navegador e reinício do servidor.
 *
 * - Escrita atômica: grava em arquivo temporário e renomeia.
 * - Backup automático: a versão anterior fica em db.bak.json a cada gravação.
 * - Escritas serializadas: duas requisições simultâneas nunca se sobrescrevem.
 *
 * Variável de ambiente: DATA_DIR (pasta onde o db.json é guardado).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import {
  DEFAULT_SETTINGS,
  STATUS_KEYS,
  CAMPOS,
  MODALIDADES,
  STATUS,
  type AppState,
  type AuditLog,
  type Categoria,
  type Edital,
  type EditalInput,
  type Modalidade,
  type Settings,
  type StatusKey,
} from '../src/shared'

interface DbFile extends AppState {
  version: 1
  nextId: number
  nextAuditId: number
}

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.resolve(process.cwd(), 'data')
const DB_FILE = path.join(DATA_DIR, 'db.json')
const BAK_FILE = path.join(DATA_DIR, 'db.bak.json')
const TMP_FILE = path.join(DATA_DIR, 'db.json.tmp')

export const dbPath = DB_FILE

const emptyDb = (): DbFile => ({ version: 1, settings: { ...DEFAULT_SETTINGS }, nextId: 1, nextAuditId: 1, editais: [], audit: [] })

let cache: DbFile | null = null
let queue: Promise<unknown> = Promise.resolve()

// ---------- erros de validação ----------
export class ValidationError extends Error {}
export class NotFoundError extends Error {}

// ---------- leitura / gravação ----------
function normalize(raw: any): DbFile {
  const base = emptyDb()
  if (!raw || typeof raw !== 'object') return base
  const editais: Edital[] = Array.isArray(raw.editais) ? raw.editais : []
  const audit: AuditLog[] = Array.isArray(raw.audit) ? raw.audit : []
  return {
    version: 1,
    settings: {
      nome: typeof raw.settings?.nome === 'string' ? raw.settings.nome : base.settings.nome,
      cargo: typeof raw.settings?.cargo === 'string' ? raw.settings.cargo : base.settings.cargo,
    },
    editais: editais.map((e) => ({ ...e, retifs: Array.isArray(e.retifs) ? e.retifs : [] })),
    nextId: Math.max(Number(raw.nextId) || 1, ...editais.map((e) => (Number(e.id) || 0) + 1)),
    audit,
    nextAuditId: Math.max(Number(raw.nextAuditId) || 1, ...audit.map((a) => (Number(a.id) || 0) + 1)),
  }
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
  await fs.writeFile(TMP_FILE, JSON.stringify(db, null, 2), 'utf8')
  await fs.copyFile(DB_FILE, BAK_FILE).catch(() => {}) // primeira gravação: ainda não existe
  await fs.rename(TMP_FILE, DB_FILE)
}

/** Executa uma alteração de forma serializada e grava em disco. */
function mutate<T>(fn: (db: DbFile) => T): Promise<T> {
  const run = queue.then(async () => {
    const db = await load()
    const result = fn(db)
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

const view = (db: DbFile): AppState => ({ settings: db.settings, editais: db.editais, audit: db.audit })

/** Registra uma linha de auditoria em nome do usuário logado (nome salvo em Configurações). */
function log(d: DbFile, acao: AuditLog['acao'], e: Edital, detalhe: string) {
  d.audit.push({
    id: d.nextAuditId++,
    ts: Date.now(),
    usuario: d.settings.nome || 'Usuário não identificado',
    acao,
    editalId: e.id,
    editalNum: e.num,
    detalhe,
  })
}

const show = (k: string, v: unknown): string => {
  if (k === 'status') return STATUS[v as StatusKey] ?? String(v)
  if (k === 'mod') return MODALIDADES[Number(v)] ?? String(v)
  if (k === 'valor') return `R$ ${Number(v).toLocaleString('pt-BR')}`
  if (k === 'data') return v ? String(v).split('-').reverse().join('/') : 'A definir'
  return v === '' || v == null ? '—' : String(v)
}

// ---------- validação ----------
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

function str(v: unknown, field: string, required: boolean, max = 2000): string {
  const s = typeof v === 'string' ? v.trim() : ''
  if (required && !s) throw new ValidationError(`Campo obrigatório: ${field}`)
  if (s.length > max) throw new ValidationError(`Campo muito longo: ${field}`)
  return s
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
  if (has('uasg')) out.uasg = str(body.uasg, 'UASG / Portal', true, 80)
  if (has('orgao')) out.orgao = str(body.orgao, 'Órgão comprador', true, 200)
  if (has('uf')) out.uf = str(body.uf, 'UF', true, 2).toUpperCase()
  if (has('objeto')) out.objeto = str(body.objeto, 'Objeto', true, 2000)
  if (has('valor')) {
    const v = Number(body.valor ?? 0)
    if (!Number.isFinite(v) || v < 0) throw new ValidationError('Valor inválido')
    out.valor = v
  }
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
  return out
}

const dayDiff = (from: string, to: string) =>
  Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000)

// ---------- API do banco ----------
export const db = {
  async getState(): Promise<AppState> {
    await queue.catch(() => {})
    return view(await load())
  },

  saveSettings(body: any): Promise<AppState> {
    const nome = str(body?.nome, 'Nome', true, 80)
    const cargo = str(body?.cargo, 'Cargo', false, 80)
    return mutate((d) => {
      d.settings = { nome, cargo } satisfies Settings
      return view(d)
    })
  },

  createEdital(body: any): Promise<AppState> {
    const v = parseEdital({ mod: 0, valor: 0, data: '', hora: '', status: 'PREP', ...body }, false) as EditalInput
    return mutate((d) => {
      const novo: Edital = { id: d.nextId++, retifs: [], ...v }
      d.editais.push(novo)
      log(d, 'CRIACAO', novo, `Edital criado: ${novo.orgao} (${novo.uf})`)
      return view(d)
    })
  },

  updateEdital(id: number, body: any): Promise<AppState> {
    const patch = parseEdital(body, true)
    return mutate((d) => {
      const e = d.editais.find((x) => x.id === id)
      if (!e) throw new NotFoundError('Edital não encontrado')
      const mudancas = (Object.keys(patch) as Array<keyof EditalInput>)
        .filter((k) => e[k] !== patch[k])
        .map((k) => `${CAMPOS[k] ?? k}: ${show(k, e[k])} → ${show(k, patch[k])}`)
      Object.assign(e, patch)
      if (mudancas.length) log(d, 'EDICAO', e, mudancas.join('; '))
      return view(d)
    })
  },

  addRetif(id: number, body: any): Promise<AppState> {
    const desc = str(body?.desc, 'Descrição', true, 1000)
    const data = str(body?.data, 'Data', false, 10)
    const hora = str(body?.hora, 'Horário', false, 5)
    if (data && !DATE_RE.test(data)) throw new ValidationError('Data inválida')
    if (hora && !TIME_RE.test(hora)) throw new ValidationError('Horário inválido')
    return mutate((d) => {
      const e = d.editais.find((x) => x.id === id)
      if (!e) throw new NotFoundError('Edital não encontrado')
      let dias = 0
      if (data && data !== e.data) {
        if (e.data) dias = Math.max(dayDiff(e.data, data), 0)
        e.data = data
      }
      if (hora) e.hora = hora
      e.retifs.push({ ts: Date.now(), desc, dias })
      e.status = 'RETIF'
      log(d, 'EDICAO', e, `Retificação registrada: ${desc}${dias > 0 ? ` (+${dias} dias)` : ''}`)
      return view(d)
    })
  },
}
