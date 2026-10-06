import { REGIOES, STATUS, type Edital } from '../shared'

export type Periodo = 'all' | 'today' | '7days' | 'month'

const pad = (n: number) => String(n).padStart(2, '0')

export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => isoDate(new Date())
export const addDaysIso = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export const fmtDate = (s: string) => (s ? s.split('-').reverse().join('/') : 'A Definir')

export const brl = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1).replace('.', ',')}M` : v >= 1e3 ? `R$ ${Math.round(v / 1e3)}k` : `R$ ${Math.round(v)}`

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

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Abre a janela de impressão com o relatório; no diálogo escolha "Salvar como PDF". */
export function exportPdf(list: Edital[]): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  const head = ['Categoria', 'Edital / UASG', 'Órgão / UF', 'Objeto', 'Data limite', 'Horário', 'Status', 'Retif.']
  const rows = list
    .map(
      (x) =>
        `<tr><td>${esc(x.cat)}</td><td><b>${esc(x.num)}</b><br>${esc(x.uasg)}</td><td>${esc(x.orgao)}<br>${esc(x.uf)}</td>` +
        `<td>${esc(x.objeto)}</td><td>${esc(fmtDate(x.data))}</td><td>${esc(x.hora || '--:--')}</td><td>${esc(STATUS[x.status])}</td><td>${x.retifs.length}</td></tr>`,
    )
    .join('')
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Editais Chevomais - ${todayIso()}</title>
<style>
  body{font-family:Arial,sans-serif;color:#111;margin:24px}
  h1{font-size:18px;margin:0}p{color:#555;font-size:11px;margin:4px 0 14px}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{background:#222;color:#fff;text-align:left;padding:6px}
  td{border-bottom:1px solid #ccc;padding:5px;vertical-align:top}
  tr{page-break-inside:avoid}
  @page{size:A4 landscape;margin:12mm}
</style></head><body>
<h1>Editais Chevomais</h1><p>Emitido em ${new Date().toLocaleString('pt-BR')} • ${list.length} edital(is)</p>
<table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
</body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
  return true
}
