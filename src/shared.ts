// Tipos e constantes compartilhados entre o front-end (src/) e a API (server/).

export type Categoria = 'TINTAS' | 'PNEUS'
export type StatusKey = 'PREP' | 'ANALISE' | 'DOCS' | 'RETIF' | 'IMPUG'
export type Modalidade = 0 | 1 | 2
export type Papel = 'admin' | 'usuario'
/** '' = em andamento */
export type Resultado = '' | 'GANHAMOS' | 'PERDEMOS'

/** Uma linha do histórico fixo de um edital. Gravada pelo servidor; ninguém edita nem apaga. */
export interface LogMudanca {
  campo: string
  de: string
  para: string
}
export interface LogEntry {
  ts: number
  por: string
  acao: 'criou' | 'alterou' | 'retificou'
  /** texto da retificação, quando acao = 'retificou' */
  obs?: string
  mudancas: LogMudanca[]
}

export interface Retif {
  ts: number
  desc: string
  /** dias de prorrogação causados pela retificação (0 = data mantida) */
  dias: number
  /** nome de quem registrou */
  por: string
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
  /** valor ganho na licitação (R$, com centavos). 0 = ainda não ganhou / não informado */
  valorGanho: number
  /** portal onde a licitação acontece (a tela oferece uma lista, mas aceita qualquer nome) */
  portal: string
  /** AAAA-MM-DD ou '' (a definir) */
  data: string
  /** HH:MM ou '' */
  hora: string
  status: StatusKey
  retifs: Retif[]
  /** ganhamos / perdemos / '' (em andamento) */
  resultado: Resultado
  /** histórico fixo de tudo que foi alterado (quem, quando, o que mudou) */
  log: LogEntry[]
  /** versão do registro: sobe a cada alteração (detecta edição simultânea) */
  v: number
  criadoPor: string
  atualizadoPor: string
  atualizadoEm: number
}

export type EditalInput = Omit<Edital, 'id' | 'retifs' | 'log' | 'v' | 'criadoPor' | 'atualizadoPor' | 'atualizadoEm'>

/** Dados de um usuário que podem ir para o navegador (nunca inclui senha). */
export interface PublicUser {
  id: number
  usuario: string
  nome: string
  cargo: string
  papel: Papel
}

export interface AppState {
  /** contador que sobe a cada alteração no banco — usado para sincronizar as telas */
  rev: number
  me: PublicUser
  /** lista de usuários (só vem preenchida para administradores) */
  users: PublicUser[]
  editais: Edital[]
}

export interface Unchanged {
  unchanged: true
  rev: number
}

export interface AuthStatus {
  needsSetup: boolean
  user: PublicUser | null
  /** nome/cargo de uma versão antiga do banco, para pré-preencher o primeiro administrador */
  sugestao?: { nome: string; cargo: string }
}

export const STATUS: Record<StatusKey, string> = {
  PREP: 'Aguardando Abertura',
  ANALISE: 'Em Análise Técnica',
  DOCS: 'Documentação Pronta',
  RETIF: 'Retificado / Aditivo',
  IMPUG: 'Em Impugnação',
}

export const RESULTADOS: Record<Exclude<Resultado, ''>, string> = { GANHAMOS: 'Ganhamos', PERDEMOS: 'Perdemos' }

export const STATUS_KEYS = Object.keys(STATUS) as StatusKey[]

export const MODALIDADES = ['Pregão Eletrônico', 'Dispensa Eletrônica', 'Concorrência Pública'] as const

export const PORTAIS = ['Comprasnet', 'Licitações-e', 'BLL', 'Portal de Compras Públicas', 'BNC', 'Licitanet', 'PNCP'] as const

export const REGIOES: Record<string, string[]> = {
  Sul: ['PR', 'SC', 'RS'],
  Sudeste: ['SP', 'RJ', 'MG', 'ES'],
  'Centro-Oeste': ['GO', 'MT', 'MS', 'DF'],
  'Norte/Nordeste': [],
}
