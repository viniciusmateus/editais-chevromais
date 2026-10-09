import type { Arredondamento, PrecifLinha, PrecifProcessoInput } from '../shared'

/**
 * Cálculos do Precificador e leitura/gravação das planilhas (.xlsx).
 * A biblioteca de planilhas é carregada só quando usada (import dinâmico), para não pesar no painel.
 */

const N2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
/** 1234.5 → "1.234,50" */
export const fmt2 = (v: number) => N2.format(Number.isFinite(v) ? v : 0)
export const fmtBrl = (v: number) => `R$ ${fmt2(v)}`

/** Sobe `x` até o próximo múltiplo de `passo`, ignorando o ruído de ponto flutuante (12,34 não vira 12,35). */
const sobe = (x: number, passo: number) => Math.round(Math.ceil(Math.round((x / passo) * 1e6) / 1e6) * passo * 100) / 100

/** Preço unitário = custo × (1 + margem%), arredondado para cima. */
export function precoUnitario(custo: number, margem: number, arred: Arredondamento): number {
  if (!(custo > 0)) return 0
  const bruto = custo * (1 + (margem || 0) / 100)
  if (arred === 'dezena') return bruto < 100 ? sobe(bruto, 0.1) : sobe(bruto, 1)
  return sobe(bruto, 0.01)
}

export const ARREDONDAMENTOS: Record<Arredondamento, string> = {
  centavo: 'Centavo (para cima)',
  dezena: 'R$ 0,10 abaixo de R$ 100 • R$ 1 acima',
}

export type Situacao = 'neutro' | 'ok' | 'atencao' | 'acima'
/** Até a referência: ok; até 10% acima: atenção; mais que isso: acima (fica fora da proposta/disputa). */
export function situacao(valor: number, ref: number): Situacao {
  if (!(valor > 0) || !(ref > 0)) return 'neutro'
  if (valor <= ref + 1e-9) return 'ok'
  if (valor <= ref * 1.1 + 1e-9) return 'atencao'
  return 'acima'
}
export const variacao = (valor: number, ref: number) => (valor > 0 && ref > 0 ? ((valor - ref) / ref) * 100 : null)

export interface ResumoLote {
  lote: string
  global: boolean
  itens: number
  /** soma dos preços unitários / soma das referências unitárias */
  somaUnit: number
  refUnit: number
  /** soma de unitário × quantidade */
  somaTotal: number
  refTotal: number
  /** o que vai para a disputa: total (lote global) ou soma dos unitários */
  disputa: number
  refDisputa: number
}

export function resumirLotes(p: Pick<PrecifProcessoInput, 'linhas' | 'globais' | 'margem' | 'arredondamento'>): Map<string, ResumoLote> {
  const out = new Map<string, ResumoLote>()
  const globais = new Set(p.globais)
  for (const l of p.linhas) {
    const g = globais.has(l.lote)
    let r = out.get(l.lote)
    if (!r) out.set(l.lote, (r = { lote: l.lote, global: g, itens: 0, somaUnit: 0, refUnit: 0, somaTotal: 0, refTotal: 0, disputa: 0, refDisputa: 0 }))
    const unit = precoUnitario(l.custo, p.margem, p.arredondamento)
    const q = l.qtde || 0
    r.itens++
    r.somaUnit += unit
    r.refUnit += l.ref
    r.somaTotal += unit * q
    r.refTotal += l.ref * q
  }
  for (const r of out.values()) {
    r.disputa = Math.round((r.global ? r.somaTotal : r.somaUnit) * 100) / 100
    r.refDisputa = Math.round((r.global ? r.refTotal : r.refUnit) * 100) / 100
  }
  return out
}

// ---------- custo digitado com contas ("120+15,5", "(80*2)/3") ----------
/** Avalia + - * / e parênteses no formato brasileiro (ponto = milhar, vírgula = decimal). Devolve null se não for uma conta válida. */
export function avaliarConta(texto: string): number | null {
  const s = texto.replace(/\s|R\$/g, '').replace(/\./g, '').replace(/,/g, '.')
  if (!s) return null
  let i = 0
  const numero = (): number => {
    const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i))
    if (!m) throw new Error('número')
    i += m[0].length
    return Number(m[0])
  }
  const fator = (): number => {
    if (s[i] === '-') return i++, -fator()
    if (s[i] === '+') return i++, fator()
    if (s[i] === '(') {
      i++
      const v = soma()
      if (s[i] !== ')') throw new Error(')')
      i++
      return v
    }
    return numero()
  }
  const produto = (): number => {
    let v = fator()
    while (s[i] === '*' || s[i] === '/' || s[i] === 'x') {
      const op = s[i++]
      const d = fator()
      v = op === '/' ? v / d : v * d
    }
    return v
  }
  const soma = (): number => {
    let v = produto()
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++]
      const d = produto()
      v = op === '+' ? v + d : v - d
    }
    return v
  }
  try {
    const v = soma()
    return i === s.length && Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  } catch {
    return null
  }
}

// ---------- planilhas ----------
const xlsx = () => import('xlsx')

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const cel = (v: unknown) => (v == null ? '' : String(v).trim())

/** Número de uma célula: aceita 1234.5, "1.234,50", "R$ 1.234,50". */
export function numeroCelula(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  let s = cel(v).replace(/[^\d,.-]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

/** Lote/item para comparar entre planilhas: "0001" e 1 são o mesmo. */
export const chave = (v: unknown) => {
  const s = cel(v)
  return /^\d+$/.test(s) ? String(Number(s)) : s.toUpperCase()
}

async function lerLinhas(file: File): Promise<unknown[][]> {
  const XLSX = await xlsx()
  const wb = XLSX.read(await file.arrayBuffer())
  const ws = wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error('A planilha está vazia.')
  return (XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }) as unknown[][]).filter((r) => r.some((c) => cel(c) !== ''))
}

type Coluna = 'lote' | 'item' | 'descricao' | 'ref' | 'qtde'
const PISTAS: Record<Coluna, string[]> = {
  lote: ['lote', 'grupo'],
  item: ['item'],
  descricao: ['descri', 'especifica', 'produto', 'objeto'],
  ref: ['refer', 'unitari', 'estimad', 'valor', 'preco'],
  qtde: ['quant', 'qtd', 'qtde'],
}

/** Acha as colunas pelo cabeçalho; sem cabeçalho reconhecível, usa A=lote, B=item, C=referência, D=quantidade. */
function mapearColunas(linhas: unknown[][]): { cols: Partial<Record<Coluna, number>>; inicio: number } {
  const cab = (linhas[0] ?? []).map((c) => semAcento(cel(c)))
  const cols: Partial<Record<Coluna, number>> = {}
  const livre = (idx: number) => !Object.values(cols).includes(idx)
  for (const k of ['lote', 'item', 'qtde', 'descricao', 'ref'] as Coluna[]) {
    // cabeçalho exato primeiro ("Item"), depois parcial ("Valor unitário de referência") — "Descrição do item" não vira a coluna Item
    let i = cab.findIndex((h, idx) => livre(idx) && PISTAS[k].includes(h))
    if (i < 0) i = cab.findIndex((h, idx) => h && livre(idx) && PISTAS[k].some((p) => h.includes(p)))
    if (i >= 0) cols[k] = i
  }
  if (cols.lote !== undefined && cols.item !== undefined) return { cols, inicio: 1 }
  // sem cabeçalho: a primeira linha só é pulada se não começar com número
  const temCabecalho = linhas[0] && typeof linhas[0][0] !== 'number' && !/^\d+$/.test(cel(linhas[0][0]))
  return { cols: { lote: 0, item: 1, ref: 2, qtde: 3 }, inicio: temCabecalho ? 1 : 0 }
}

/** Planilha de itens do edital → linhas do processo. Lotes com mais de um item começam como "global". */
export async function importarItens(file: File): Promise<{ linhas: PrecifLinha[]; globais: string[] }> {
  const rows = await lerLinhas(file)
  const { cols, inicio } = mapearColunas(rows)
  const linhas: PrecifLinha[] = []
  for (const r of rows.slice(inicio)) {
    const lote = cel(r[cols.lote!])
    const item = cel(r[cols.item!])
    if (!lote && !item) continue
    linhas.push({
      lote: lote || item,
      item: item || lote,
      descricao: cols.descricao !== undefined ? cel(r[cols.descricao]).slice(0, 500) : '',
      ref: cols.ref !== undefined ? Math.round(numeroCelula(r[cols.ref]) * 100) / 100 : 0,
      qtde: cols.qtde !== undefined ? Math.max(Math.round(numeroCelula(r[cols.qtde])), 0) || 1 : 1,
      custo: 0,
      marca: '',
      modelo: '',
    })
  }
  if (!linhas.length) throw new Error('Nenhum item encontrado. A planilha precisa das colunas Lote, Item e Valor de referência (e, se tiver, Quantidade).')
  const porLote = linhas.reduce<Record<string, number>>((a, l) => ((a[l.lote] = (a[l.lote] ?? 0) + 1), a), {})
  return { linhas, globais: Object.keys(porLote).filter((k) => porLote[k] > 1) }
}

/** Planilha de quantidades (Lote, Item, Quantidade) → mapa "lote|item" → quantidade. */
export async function importarQuantidades(file: File): Promise<Map<string, number>> {
  const rows = await lerLinhas(file)
  const { cols, inicio } = mapearColunas(rows)
  const out = new Map<string, number>()
  if (cols.qtde === undefined) throw new Error('Não achei a coluna de quantidade (cabeçalho "Quantidade" ou "Qtd").')
  for (const r of rows.slice(inicio)) {
    const q = Math.round(numeroCelula(r[cols.qtde]))
    if (q > 0) out.set(`${chave(r[cols.lote!])}|${chave(r[cols.item!])}`, q)
  }
  return out
}

/** Planilha de marcas e modelos (colunas "Marca" e "Modelo"). */
export async function importarCatalogo(file: File): Promise<Array<{ marca: string; modelo: string }>> {
  const rows = await lerLinhas(file)
  const cab = (rows[0] ?? []).map((c) => semAcento(cel(c)))
  const im = cab.indexOf('marca')
  const imd = cab.indexOf('modelo')
  if (im < 0 || imd < 0) throw new Error('A planilha precisa das colunas "Marca" e "Modelo" na primeira linha.')
  return rows
    .slice(1)
    .map((r) => ({ marca: cel(r[im]), modelo: cel(r[imd]) }))
    .filter((x) => x.marca && x.modelo)
}

async function gravar(nome: string, aba: string, dados: unknown[][], formatoNumero?: { colunas: number[]; formato: string }) {
  const XLSX = await xlsx()
  const ws = XLSX.utils.aoa_to_sheet(dados)
  if (formatoNumero) {
    for (let r = 1; r < dados.length; r++) {
      for (const c of formatoNumero.colunas) {
        const ref = XLSX.utils.encode_cell({ r, c })
        if (ws[ref] && typeof ws[ref].v === 'number') ws[ref].z = formatoNumero.formato
      }
    }
  }
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, aba)
  XLSX.writeFile(wb, `${nome.replace(/[\\/:*?"<>|]+/g, '-') || 'precificacao'}.xlsx`)
}

const pronta = (l: PrecifLinha) => !!l.marca.trim() && !!l.modelo.trim()

/**
 * Proposta (regras da planilha original):
 * - lote com um item fica de fora se o preço passar 10% da referência; lote com vários itens, se a soma passar 10% da soma das referências;
 * - o valor proposto é o maior entre o preço calculado e a referência (a disputa desce a partir dele);
 * - item sem referência vai com 3× o preço calculado.
 */
export async function exportarProposta(p: PrecifProcessoInput): Promise<number> {
  const unit = (l: PrecifLinha) => precoUnitario(l.custo, p.margem, p.arredondamento)
  const agg = new Map<string, { n: number; val: number; ref: number }>()
  for (const l of p.linhas.filter(pronta)) {
    const a = agg.get(l.lote) ?? { n: 0, val: 0, ref: 0 }
    a.n++
    a.val += unit(l)
    a.ref += l.ref
    agg.set(l.lote, a)
  }
  const dados: unknown[][] = [['Lote', 'Item', '', 'Marca', 'Modelo', '', 'Valor']]
  for (const l of p.linhas) {
    const v = unit(l)
    if (!pronta(l) || !v) continue
    let saida: number
    if (!l.ref) saida = v * 3
    else {
      const a = agg.get(l.lote)!
      if (a.n === 1 ? v > l.ref * 1.1 : a.val > a.ref * 1.1) continue
      saida = Math.max(v, l.ref)
    }
    dados.push([l.lote, l.item, '', l.marca, l.modelo, '', Math.round(saida * 100) / 100])
  }
  if (dados.length === 1) return 0
  await gravar(`${p.nome}-proposta`, 'Proposta', dados, { colunas: [6], formato: '0.00' })
  return dados.length - 1
}

/** Disputa: uma linha por lote com o valor limite (global = soma de unitário × qtde; unitário = soma dos unitários). Lotes mais de 10% acima da referência ficam de fora. */
export async function exportarDisputa(p: PrecifProcessoInput): Promise<number> {
  const so = { ...p, linhas: p.linhas.filter((l) => pronta(l) && precoUnitario(l.custo, p.margem, p.arredondamento) > 0) }
  const dados: unknown[][] = [['Item', 'Descrição', 'Valor limite', 'Variação inicial', 'Variação final', 'Tipo de redução']]
  for (const r of resumirLotes(so).values()) {
    if (r.refDisputa && r.disputa > r.refDisputa * 1.1) continue
    dados.push([r.lote, `LOTE ${r.lote} (${r.global ? 'Global' : 'Unitário'})`, r.disputa, 0.1, 1, 'Valor'])
  }
  if (dados.length === 1) return 0
  await gravar(`${p.nome}-disputa`, 'Disputa', dados, { colunas: [2], formato: '0.00' })
  return dados.length - 1
}

/** Planilha com tudo o que foi preenchido (conferência / arquivo). */
export async function exportarCompleta(p: PrecifProcessoInput): Promise<number> {
  const lotes = resumirLotes(p)
  const dados: unknown[][] = [['Lote', 'Item', 'Descrição', 'Qtd.', 'Ref. unitária', 'Custo', 'Margem %', 'Preço unitário', 'Preço total', 'Variação %', 'Marca', 'Modelo', 'Tipo do lote']]
  for (const l of p.linhas) {
    const u = precoUnitario(l.custo, p.margem, p.arredondamento)
    const vr = variacao(u, l.ref)
    dados.push([l.lote, l.item, l.descricao, l.qtde, l.ref, l.custo, p.margem, u, Math.round(u * l.qtde * 100) / 100, vr === null ? '' : Math.round(vr * 100) / 100, l.marca, l.modelo, lotes.get(l.lote)?.global ? 'Global' : 'Unitário'])
  }
  await gravar(`${p.nome}-completa`, 'Precificação', dados, { colunas: [4, 5, 7, 8], formato: '#,##0.00' })
  return p.linhas.length
}
