import type { Edital } from '../shared'

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Número de pregão com ano: "16/2026", "016-2026" e "16.26" viram { n: 16, ano: 2026 }. */
export interface NumAno {
  n: number
  ano: number
}

const RE_NUM_ANO = /(\d{1,9})\s*[/\-.]\s*(\d{4}|\d{2})(?!\d)/g

const anoCompleto = (a: string) => (a.length === 2 ? 2000 + Number(a) : Number(a))

/** Todos os pares número/ano de um texto (zeros à esquerda não contam). */
export function paresNumAno(texto: string): NumAno[] {
  const out: NumAno[] = []
  for (const m of texto.matchAll(RE_NUM_ANO)) out.push({ n: Number(m[1]), ano: anoCompleto(m[2]) })
  return out
}

const semZeros = (s: string) => s.replace(/^0+(?=\d)/, '')

/** Todos os números soltos de um texto, sem zeros à esquerda. */
const numerosSoltos = (texto: string) => (texto.match(/\d+/g) ?? []).map(semZeros)

/**
 * Pontua um edital para o que foi digitado; 0 = não serve.
 * - "16/2026" só casa com um edital de número 16 e ano 2026 (009/2026 e 160/2026 ficam de fora);
 * - número solto ("16") casa com o início do número do edital (ou com a UASG);
 * - palavras ("curitiba", "pneus") precisam aparecer todas no órgão, cidade, UF, portal, UASG ou número.
 */
export function pontuarEdital(e: Edital, consulta: string): number {
  const q = consulta.trim()
  if (!q) return 1
  let pontos = 1

  const numsEdital = numerosSoltos(e.num)
  const doEdital = paresNumAno(e.num)
  for (const p of paresNumAno(q)) {
    const exato = doEdital.some((d) => d.n === p.n && d.ano === p.ano)
    // edital cujo número não traz ano: só o número precisa bater
    const soNumero = !doEdital.length && numsEdital.includes(String(p.n))
    if (!exato && !soNumero) return 0
    pontos += 100
  }

  // o que sobra depois de tirar os pares número/ano
  const resto = semAcento(q.replace(RE_NUM_ANO, ' ')).split(/\s+/).filter(Boolean)
  const palheiro = semAcento(`${e.num} ${e.orgao} ${e.cidade} ${e.uf} ${e.portal} ${e.uasg}`)
  for (const t of resto) {
    if (/^\d+$/.test(t)) {
      const z = semZeros(t)
      if (numsEdital.some((n) => n === z)) pontos += 50
      else if (numsEdital.some((n) => n.startsWith(z))) pontos += 20
      else if (t.length >= 3 && e.uasg.includes(t)) pontos += 20
      else return 0
    } else if (palheiro.includes(t)) pontos += 5
    else return 0
  }
  return pontos
}

/** Editais que servem para a consulta, melhores primeiro (empate: os mais recentes). */
export function buscarEditais(editais: Edital[], consulta: string): Edital[] {
  return editais
    .map((e) => ({ e, p: pontuarEdital(e, consulta) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p || b.e.id - a.e.id)
    .map((x) => x.e)
}

/** O edital tem o mesmo número/ano de algum que aparece no texto (ex.: nome do processo)? null = o texto não traz número para comparar. */
export function confereComTexto(e: Edital, texto: string): boolean | null {
  const pares = paresNumAno(texto)
  if (!pares.length) return null
  const doEdital = paresNumAno(e.num)
  return pares.some((p) => doEdital.some((d) => d.n === p.n && d.ano === p.ano))
}
