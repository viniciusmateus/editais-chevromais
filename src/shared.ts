// Tipos e constantes compartilhados entre o front-end (src/) e a API (server/).

/** id de uma categoria cadastrada em Configurações (as categorias são gerenciadas pelo administrador) */
export type CategoriaId = string
/** id de um status cadastrado em Configurações */
export type StatusKey = string
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
  cat: CategoriaId
  mod: Modalidade
  num: string
  uasg: string
  orgao: string
  cidade: string
  uf: string
  /** valor ganho na licitação (R$, com centavos). 0 = ainda não ganhou / não informado */
  valorGanho: number
  /** valor total pelo qual a licitação foi homologada (R$). 0 = ainda não homologada */
  valorHomologado: number
  /** impugnações feitas neste edital */
  impugnacoes: EditalImpugnacao[]
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
/** Campos "dados base" do edital que um perfil pode ou não editar. */
export const CAMPOS_BASE = [
  { key: 'portal', label: 'Portal' },
  { key: 'cat', label: 'Categoria' },
  { key: 'mod', label: 'Modalidade' },
  { key: 'num', label: 'Nº do edital' },
  { key: 'uasg', label: 'UASG / Nº de identificação' },
  { key: 'orgao', label: 'Órgão comprador' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'UF' },
  { key: 'data', label: 'Data limite' },
  { key: 'hora', label: 'Horário limite' },
] as const satisfies ReadonlyArray<{ key: string; label: string }>

export type CampoBase = (typeof CAMPOS_BASE)[number]['key']

/** O que um usuário pode fazer com os editais (administradores podem tudo). */
export interface Permissoes {
  /** pode excluir editais */
  excluir: boolean
  /** dados base que pode alterar nos editais já cadastrados */
  campos: CampoBase[]
}

/** Perfil de permissões, atribuído aos usuários em Configurações → Perfis. */
export interface PerfilCfg extends Permissoes {
  id: number
  nome: string
}

export interface PublicUser {
  id: number
  usuario: string
  nome: string
  cargo: string
  papel: Papel
  /** ids dos portais que o usuário enxerga; null = todos. Administradores sempre enxergam todos. */
  portais: number[] | null
  /** id do perfil de permissões (administradores não precisam de perfil) */
  perfil: number | null
  /** permissões efetivas, já calculadas pelo servidor */
  perms: Permissoes
}

export interface StatusCfg {
  id: StatusKey
  nome: string
  cor: string
  /** posição do status no mapa do fluxo (Configurações → Fluxo dos status) */
  x?: number
  y?: number
}

/** O que o usuário precisa informar ao usar uma ligação do fluxo. */
export type ExigeTransicao = 'nada' | 'motivo' | 'valorGanho' | 'valorHomologado' | 'impugnacoes'

export const EXIGE_LABEL: Record<ExigeTransicao, string> = {
  nada: 'Nada (um clique)',
  motivo: 'Motivo (texto)',
  valorGanho: 'Valor total ganho',
  valorHomologado: 'Valor total homologado',
  impugnacoes: 'Resultado das impugnações (só se o edital tiver)',
}

/**
 * Uma ligação do fluxo: de um status só se pode ir para os status que têm ligação saindo dele.
 * Cada par (de, para) existe no máximo uma vez. Sem nenhuma ligação cadastrada, qualquer mudança é livre.
 */
export interface Transicao {
  de: StatusKey
  para: StatusKey
  /** texto do botão que o usuário clica */
  rotulo: string
  /** true = aparece no botão "Negativo"; false = no botão "Avançar" */
  negativo: boolean
  exige: ExigeTransicao
  /** resultado que a ligação marca no edital ('' = não mexe) */
  resultado: Resultado
}

/** Impugnação cadastrada em Configurações (o administrador gerencia a lista). */
export interface ImpugnacaoCfg {
  id: string
  nome: string
  cor: string
}

/** Resultado possível de uma impugnação (ex.: Deferida, Indeferida), cadastrado em Configurações. */
export interface ImpugStatusCfg {
  id: string
  nome: string
  cor: string
}

/** Impugnação feita num edital; status = id de um ImpugStatusCfg ('' = ainda sem resposta). */
export interface EditalImpugnacao {
  id: string
  status: string
}

export interface CategoriaCfg {
  id: CategoriaId
  nome: string
  /** cor em #rrggbb, usada nos selos e gráficos */
  cor: string
}

/** Campos do formulário de edital cuja exibição/obrigatoriedade cada portal controla. */
export const CAMPOS_PORTAL = [
  { key: 'mod', label: 'Modalidade', semObrigatorio: true },
  { key: 'num', label: 'Nº do Edital' },
  { key: 'uasg', label: 'UASG / Nº de identificação' },
  { key: 'orgao', label: 'Órgão Comprador' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'uf', label: 'UF' },
  { key: 'data', label: 'Data limite' },
  { key: 'hora', label: 'Horário' },
  { key: 'valorGanho', label: 'Valor ganho' },
] as const satisfies ReadonlyArray<{ key: string; label: string; semObrigatorio?: boolean }>

export type CampoKey = (typeof CAMPOS_PORTAL)[number]['key']
export type Regra = 'oculto' | 'opcional' | 'obrigatorio'
export type RegrasCampos = Record<CampoKey, Regra>

/** Regras usadas por editais sem portal informado e como ponto de partida de um portal novo. */
export const REGRAS_PADRAO: RegrasCampos = {
  mod: 'opcional',
  num: 'obrigatorio',
  uasg: 'obrigatorio',
  orgao: 'obrigatorio',
  cidade: 'opcional',
  uf: 'obrigatorio',
  data: 'opcional',
  hora: 'opcional',
  valorGanho: 'opcional',
}

export interface Portal {
  id: number
  nome: string
  campos: RegrasCampos
}

/** Rótulos dos campos obrigatórios (segundo as regras) que estão vazios. */
export function camposFaltando(regras: RegrasCampos, v: Pick<EditalInput, CampoKey>, ignorar: CampoKey[] = []): string[] {
  return CAMPOS_PORTAL.filter(({ key }) => {
    if (regras[key] !== 'obrigatorio' || ignorar.includes(key)) return false
    return key === 'valorGanho' ? !(v.valorGanho > 0) : !String(v[key] ?? '').trim()
  }).map((c) => c.label)
}

/** AAAA-MM-DD que existe no calendário. */
export function isoValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

/** HH:MM em 24 horas. */
export const horaValida = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export interface AppState {
  /** contador que sobe a cada alteração no banco — usado para sincronizar as telas */
  rev: number
  me: PublicUser
  /** lista de usuários (só vem preenchida para administradores) */
  users: PublicUser[]
  editais: Edital[]
  portais: Portal[]
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  impugnacoes: ImpugnacaoCfg[]
  impugStatuses: ImpugStatusCfg[]
  /** perfis de permissão (só vem preenchido para administradores) */
  perfis: PerfilCfg[]
  /** ligações do fluxo de status (vazio = mudança livre entre quaisquer status) */
  transicoes: Transicao[]
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

export const STATUS_INICIAIS: StatusCfg[] = [
  { id: 'PREP', nome: 'Aguardando Abertura', cor: '#64748b' },
  { id: 'ANALISE', nome: 'Em Análise Técnica', cor: '#0369a1' },
  { id: 'DOCS', nome: 'Documentação Pronta', cor: '#15803d' },
  { id: 'RETIF', nome: 'Retificado / Aditivo', cor: '#ba1a1a' },
  { id: 'IMPUG', nome: 'Em Impugnação', cor: '#b45309' },
]

/** Status usados pelo próprio sistema: PREP é o inicial de todo edital novo e RETIF é aplicado ao registrar uma retificação. Podem ser renomeados, não excluídos. */
export const STATUS_FIXOS: StatusKey[] = ['PREP', 'RETIF']

export const RESULTADOS: Record<Exclude<Resultado, ''>, string> = { GANHAMOS: 'Ganhamos', PERDEMOS: 'Perdemos' }

export const MODALIDADES = ['Pregão Eletrônico', 'Dispensa Eletrônica', 'Concorrência Pública'] as const

/** portais cadastrados na primeira execução (depois são gerenciados no painel Portais) */
export const PORTAIS_INICIAIS = ['Comprasnet', 'Licitações-e', 'BLL', 'Portal de Compras Públicas', 'BNC', 'Licitanet', 'PNCP'] as const

export const CATEGORIAS_INICIAIS: CategoriaCfg[] = [
  { id: 'TINTAS', nome: 'Tintas', cor: '#0284c7' },
  { id: 'PNEUS', nome: 'Pneus', cor: '#d97706' },
]

export const REGIOES: Record<string, string[]> = {
  Sul: ['PR', 'SC', 'RS'],
  Sudeste: ['SP', 'RJ', 'MG', 'ES'],
  'Centro-Oeste': ['GO', 'MT', 'MS', 'DF'],
  'Norte/Nordeste': [],
}
