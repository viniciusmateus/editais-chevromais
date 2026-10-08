import { MODALIDADES, REGIOES, REGRAS_PADRAO, RESULTADOS, type CategoriaCfg, type StatusCfg, type Edital, type Portal, type RegrasCampos, type Transicao } from '../shared'

export type Periodo = 'all' | 'today' | '7days' | 'month'

const pad = (n: number) => String(n).padStart(2, '0')

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => isoDate(new Date())
export const addDaysIso = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

/** AAAA-MM-DD -> dd/MM/aaaa */
export const fmtDate = (s: string) => (s ? s.split('-').reverse().join('/') : 'A Definir')

/** Visão da lista: situação do edital ('s:ID' = um status específico). */
export type Visao = 'aberto' | 'hoje' | 'atrasados' | 'todos' | `s:${string}`

/** Edital que ainda precisa de andamento: sem resultado e com algum passo a dar no fluxo (sem fluxo cadastrado, basta não ter resultado). */
export const emAberto = (e: Edital, transicoes: Transicao[]) => e.resultado === '' && (transicoes.length === 0 || transicoes.some((t) => t.de === e.status))

export function naVisao(e: Edital, v: Visao, transicoes: Transicao[]): boolean {
  const hoje = todayIso()
  if (v === 'todos') return true
  if (v === 'aberto') return emAberto(e, transicoes)
  if (v === 'hoje') return e.data === hoje
  if (v === 'atrasados') return !!e.data && e.data < hoje && emAberto(e, transicoes)
  return e.status === v.slice(2)
}

/** Dias de hoje até a data (negativo = já passou). */
export const diasAte = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00') - Date.parse(todayIso() + 'T00:00:00')) / 86_400_000)

/**
 * Ordem da lista: o que vence hoje ou depois vem primeiro (do mais próximo ao mais distante);
 * depois os já vencidos (do mais recente ao mais antigo); por fim os sem data. Assim o histórico antigo nunca fica no topo.
 */
export function compararDataHora(a: Edital, b: Edital): number {
  const t = todayIso()
  const g = (e: Edital) => (!e.data ? 2 : e.data >= t ? 0 : 1)
  const ga = g(a)
  const gb = g(b)
  if (ga !== gb) return ga - gb
  const ka = chaveDataHora(a)
  const kb = chaveDataHora(b)
  return ga === 1 ? kb.localeCompare(ka) : ka.localeCompare(kb)
}

/** Chave para ordenar por data e horário juntos (sem data vai para o fim; sem horário, depois dos que têm). */
export const chaveDataHora = (e: Pick<Edital, 'data' | 'hora' | 'id'>) => `${e.data || '9999-12-31'} ${e.hora || '99:99'} ${String(e.id).padStart(8, '0')}`

/** Instante (ms) -> dd/MM/aaaa HH:mm (24 horas) */
export function fmtTs(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Categoria pelo id; se ela não existir mais, devolve um cinza com o próprio id. */
export const catInfo = (cats: CategoriaCfg[], id: string): CategoriaCfg => cats.find((c) => c.id === id) ?? { id, nome: id, cor: '#64748b' }

/** Status pelo id; se ele não existir mais, devolve um cinza com o próprio id. */
export const statusInfo = (sts: StatusCfg[], id: string): StatusCfg => sts.find((s) => s.id === id) ?? { id, nome: id, cor: '#64748b' }

/** Regras dos campos do portal informado (sem portal ou portal desconhecido: regras padrão). */
export const regrasDoPortal = (portais: Portal[], nome: string): RegrasCampos => portais.find((p) => p.nome === nome)?.campos ?? REGRAS_PADRAO

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** R$ 1.234,56 — a partir de 1 milhão abrevia (R$ 1,23 mi) para caber nos cartões. */
export const brl = (v: number) => (v >= 1e6 ? `R$ ${(v / 1e6).toFixed(2).replace('.', ',')} mi` : BRL.format(v))

/** Sempre completo: R$ 1.234.567,89 */
export const brlFull = (v: number) => BRL.format(v)

/**
 * Lê o valor digitado em formato brasileiro ou simples: "15000", "15.000,50", "R$ 15.000,50", "15000.50".
 * Vazio = 0. Texto inválido = null.
 */
export function parseMoney(text: string): number | null {
  let s = text.replace(/R\$/gi, '').replace(/\s/g, '')
  if (s === '') return 0
  if (!/^\d[\d.,]*$/.test(s)) return null
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.') // 1.234,56 -> 1234.56
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '') // 1.234 ou 1.234.567 -> milhar
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** Valor para mostrar dentro do campo de edição (vírgula decimal, vazio se zero). */
export const moneyToInput = (v: number) => (v ? String(v).replace('.', ',') : '')

export const regiaoDe = (uf: string) =>
  Object.entries(REGIOES).find(([, ufs]) => ufs.includes(uf))?.[0] ?? 'Norte/Nordeste'

export function inPeriod(e: Edital, p: Periodo): boolean {
  if (p === 'all') return true
  if (!e.data) return false
  const t = todayIso()
  if (p === 'today') return e.data === t
  if (p === '7days') return e.data >= t && e.data <= addDaysIso(7)
  const now = new Date()
  const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
  const end = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  return e.data >= start && e.data <= end
}

/** Baixa um CSV (separador ;, UTF-8 com BOM) que abre direto no Excel. */
export function exportCsv(list: Edital[], categorias: CategoriaCfg[], statuses: StatusCfg[]): void {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Categoria', 'Edital', 'UASG / ID', 'Portal', 'Órgão', 'Cidade', 'UF', 'Modalidade', 'Valor ganho', 'Valor homologado', 'Data limite', 'Horário', 'Status', 'Resultado', 'Retificações']
  const rows = list.map((x) =>
    [catInfo(categorias, x.cat).nome, x.num, x.uasg, x.portal, x.orgao, x.cidade, x.uf, MODALIDADES[x.mod], x.valorGanho.toFixed(2).replace('.', ','), x.valorHomologado.toFixed(2).replace('.', ','), fmtDate(x.data), x.hora, statusInfo(statuses, x.status).nome, x.resultado ? RESULTADOS[x.resultado] : 'Em andamento', x.retifs.length]
      .map(q)
      .join(';'),
  )
  const blob = new Blob(['﻿' + [head.map(q).join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `editais_${todayIso()}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
