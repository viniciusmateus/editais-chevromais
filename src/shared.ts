// Tipos e constantes compartilhados entre o front-end (src/) e a API (server/).

export type Categoria = 'TINTAS' | 'PNEUS'
export type StatusKey = 'PREP' | 'ANALISE' | 'DOCS' | 'RETIF' | 'IMPUG'
export type Modalidade = 0 | 1 | 2

export interface Retif {
  ts: number
  desc: string
  /** dias de prorrogação causados pela retificação (0 = data mantida) */
  dias: number
}

export interface Edital {
  id: number
  cat: Categoria
  mod: Modalidade
  num: string
  uasg: string
  orgao: string
  uf: string
  objeto: string
  valor: number
  /** AAAA-MM-DD ou '' (a definir) */
  data: string
  /** HH:MM ou '' */
  hora: string
  status: StatusKey
  retifs: Retif[]
}

export type EditalInput = Omit<Edital, 'id' | 'retifs'>

export interface Settings {
  nome: string
  cargo: string
}

/** Registro de auditoria: quem criou/editou qual edital e quando. */
export interface AuditLog {
  id: number
  ts: number
  /** usuário logado (nome definido em Configurações) */
  usuario: string
  acao: 'CRIACAO' | 'EDICAO'
  editalId: number
  editalNum: string
  /** resumo legível das alterações (ex.: "Status: Aguardando → Em Análise") */
  detalhe: string
}

export interface AppState {
  settings: Settings
  editais: Edital[]
  audit: AuditLog[]
}

export const CAMPOS: Record<string, string> = {
  cat: 'Categoria',
  mod: 'Modalidade',
  num: 'Nº do edital',
  uasg: 'UASG',
  orgao: 'Órgão',
  uf: 'UF',
  objeto: 'Objeto',
  valor: 'Valor',
  data: 'Data limite',
  hora: 'Horário',
  status: 'Status',
}

export const STATUS: Record<StatusKey, string> = {
  PREP: 'Aguardando Abertura',
  ANALISE: 'Em Análise Técnica',
  DOCS: 'Documentação Pronta',
  RETIF: 'Retificado / Aditivo',
  IMPUG: 'Em Impugnação',
}

export const STATUS_KEYS = Object.keys(STATUS) as StatusKey[]

export const MODALIDADES = ['Pregão Eletrônico', 'Dispensa Eletrônica', 'Concorrência Pública'] as const

export const REGIOES: Record<string, string[]> = {
  Sul: ['PR', 'SC', 'RS'],
  Sudeste: ['SP', 'RJ', 'MG', 'ES'],
  'Centro-Oeste': ['GO', 'MT', 'MS', 'DF'],
  'Norte/Nordeste': [],
}

export const DEFAULT_SETTINGS: Settings = { nome: 'Seu Nome', cargo: 'Seu Cargo' }
