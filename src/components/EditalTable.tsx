import { STATUS, STATUS_KEYS, type Edital, type StatusKey } from '../shared'
import { fmtDate, todayIso } from '../lib/utils'

export type Tab = 'ALL' | 'TINTAS' | 'PNEUS' | 'RETIF'
export const PAGE_SIZE = 8

interface Props {
  list: Edital[]
  total: number
  counts: { all: number; tintas: number; pneus: number; retif: number }
  tab: Tab
  onTab: (t: Tab) => void
  page: number
  onPage: (p: number) => void
  sortAsc: boolean
  onSort: () => void
  q: string
  onQ: (v: string) => void
  onStatus: (id: number, s: StatusKey) => void
  onRetif: (id: number) => void
  onHist: (id: number) => void
  onEdit: (id: number) => void
}

const statusStyle: Record<StatusKey, string> = {
  PREP: 'bg-surface-container text-on-surface',
  ANALISE: 'bg-surface-variant text-on-surface',
  DOCS: 'bg-secondary-container text-on-secondary-container',
  RETIF: 'bg-error-container text-error',
  IMPUG: 'bg-primary-container text-on-primary',
}

function CatBadge({ cat }: { cat: Edital['cat'] }) {
  return cat === 'PNEUS' ? (
    <span className="inline-flex items-center gap-1 rounded bg-surface-variant px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-surface">
      <span className="material-symbols-outlined text-[14px]">tire_repair</span> Pneus
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded bg-secondary-container px-2 py-0.5 font-label-sm text-label-sm font-bold text-on-secondary-container">
      <span className="material-symbols-outlined text-[14px]">format_paint</span> Tintas
    </span>
  )
}

function DateCell({ d }: { d: string }) {
  const t = todayIso()
  if (!d) return <span className="font-data-mono text-data-mono text-outline">A Definir</span>
  if (d === t) return <span className="font-data-mono text-data-mono font-bold text-error">HOJE ({fmtDate(d).slice(0, 5)})</span>
  if (d < t) return <span className="font-data-mono text-data-mono text-outline line-through">{fmtDate(d)}</span>
  return <span className="font-data-mono text-data-mono font-semibold text-primary">{fmtDate(d)}</span>
}

export default function EditalTable(p: Props) {
  const pages = Math.max(1, Math.ceil(p.list.length / PAGE_SIZE))
  const page = Math.min(p.page, pages)
  const slice = p.list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const tabs: Array<{ id: Tab; label: string; n: number; dot?: string; danger?: boolean }> = [
    { id: 'ALL', label: 'Todos os Editais', n: p.counts.all },
    { id: 'TINTAS', label: 'Tintas & Revestimentos', n: p.counts.tintas, dot: '#a6a6a6' },
    { id: 'PNEUS', label: 'Pneus & Borrachas', n: p.counts.pneus, dot: '#6b6b6b' },
    { id: 'RETIF', label: 'Com Retificações', n: p.counts.retif, dot: '#f5f5f5', danger: true },
  ]

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
      <div className="flex items-center gap-space-sm border-b border-surface-container px-space-md py-space-sm">
        <div className="relative w-full max-w-xl">
          <span className="material-symbols-outlined absolute left-3 top-2 text-[18px] text-outline">search</span>
          <input
            value={p.q}
            onChange={(e) => p.onQ(e.target.value)}
            className="h-9 w-full rounded-lg bg-surface-container-low pl-9 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary"
            placeholder="Buscar edital, número do pregão, UASG, órgão ou UF..."
            type="text"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-space-sm bg-surface-container-low px-space-md pt-space-sm">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const on = p.tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => p.onTab(t.id)}
                className={`flex items-center gap-1.5 rounded-t-lg px-space-md py-2.5 font-label-md text-label-md ${
                  on ? 'bg-surface-container-lowest font-bold text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {t.dot && <span className="h-2 w-2 rounded-full" style={{ background: t.dot }} />}
                <span>{t.label}</span>
                <span className={`rounded-full px-2 text-[11px] ${t.danger ? 'bg-error-container/40 font-bold text-error' : 'bg-surface-container text-on-surface'}`}>
                  {t.n}
                </span>
              </button>
            )
          })}
        </div>
        <span className="hidden pb-2 font-data-mono text-data-mono text-outline sm:inline">
          Exibindo {slice.length} de {p.list.length} registros{p.list.length !== p.total ? ` (${p.total} no total)` : ''}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 select-none bg-surface-container-low font-label-sm text-label-sm uppercase tracking-wider text-outline">
              <th className="px-space-md py-2">Categoria</th>
              <th className="px-space-md py-2">Edital / UASG</th>
              <th className="px-space-md py-2">Órgão Comprador</th>
              <th className="min-w-[260px] px-space-md py-2">Objeto Registrado</th>
              <th className="px-space-md py-2">Retificações</th>
              <th className="cursor-pointer px-space-md py-2" onClick={p.onSort}>
                Data Limite {p.sortAsc ? '▲' : '▼'}
              </th>
              <th className="px-space-md py-2">Horário</th>
              <th className="px-space-md py-2 text-center">Status</th>
              <th className="px-space-md py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-body-md">
            {slice.length === 0 && (
              <tr>
                <td colSpan={9} className="py-8 text-center font-label-md text-label-md text-outline">
                  {p.total
                    ? 'Nenhum edital encontrado para os filtros selecionados.'
                    : 'Nenhum edital cadastrado ainda. Clique em "Novo Edital / Registro" para começar.'}
                </td>
              </tr>
            )}
            {slice.map((x) => {
              const last = x.retifs[x.retifs.length - 1]
              return (
                <tr
                  key={x.id}
                  onClick={() => p.onEdit(x.id)}
                  title="Clique para editar"
                  className={`cursor-pointer transition-colors hover:bg-surface-container ${
                    x.status === 'RETIF' ? 'bg-surface-container-low' : x.status === 'IMPUG' ? 'bg-surface-container-high/50' : ''
                  }`}
                >
                  <td className="whitespace-nowrap px-space-md py-3"><CatBadge cat={x.cat} /></td>
                  <td className="whitespace-nowrap px-space-md py-3">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-bold text-primary">{x.num}</span>
                      <span className="font-data-mono text-data-mono text-outline">{x.uasg}</span>
                    </div>
                  </td>
                  <td className="px-space-md py-3">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold">{x.orgao}</span>
                      <span className="font-label-sm text-label-sm text-outline">{x.uf}</span>
                    </div>
                  </td>
                  <td className="px-space-md py-3"><p className="line-clamp-2 max-w-sm" title={x.objeto}>{x.objeto}</p></td>
                  <td className="whitespace-nowrap px-space-md py-3">
                    {last ? (
                      <span className={`rounded px-1.5 py-0.5 font-label-sm text-[11px] font-bold ${last.dias > 0 ? 'bg-error text-on-error' : 'bg-secondary-container text-on-secondary-container'}`}>
                        {x.retifs.length} retif.{last.dias > 0 ? ` (+${last.dias}d)` : ''}
                      </span>
                    ) : (
                      <span className="font-label-sm text-label-sm italic text-outline">Sem alterações</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3"><DateCell d={x.data} /></td>
                  <td className="whitespace-nowrap px-space-md py-3">
                    <span className="rounded bg-surface-container px-2 py-0.5 font-data-mono text-data-mono">{x.hora ? `${x.hora}h` : '--:--'}</span>
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3 text-center">
                    <select
                      value={x.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => p.onStatus(x.id, e.target.value as StatusKey)}
                      className={`rounded-full border-none px-2 py-1 font-label-sm text-label-sm font-semibold focus:outline-none ${statusStyle[x.status]}`}
                    >
                      {STATUS_KEYS.map((k) => (
                        <option key={k} value={k}>{STATUS[k]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); p.onRetif(x.id) }} title="Adicionar Retificação" className="flex items-center gap-1 rounded bg-surface-container-low px-2 py-1 text-label-sm font-semibold text-primary hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[14px]">add</span> Retificação
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); p.onHist(x.id) }} title="Ver Histórico" className="rounded p-1.5 text-primary hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">history</span>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-space-sm bg-surface-container-low px-space-md py-space-sm sm:flex-row">
        <span className="font-label-sm text-label-sm text-outline">Clique em uma linha para editar o edital</span>
        <div className="flex items-center gap-space-sm font-data-mono text-data-mono">
          <span className="text-outline">Página {page} de {pages}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => p.onPage(page - 1)} className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-lowest text-primary disabled:text-outline disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            </button>
            <button type="button" disabled={page >= pages} onClick={() => p.onPage(page + 1)} className="flex h-7 w-7 items-center justify-center rounded bg-surface-container-lowest text-primary disabled:text-outline disabled:opacity-50">
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
