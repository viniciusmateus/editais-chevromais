import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type CategoriaCfg, type Edital, type ImpugnacaoCfg, type ImpugStatusCfg, type StatusCfg, type Transicao } from '../shared'
import { brlFull, catInfo, diasAte, fmtDate, statusInfo } from '../lib/utils'

/** 'ALL', 'RETIF' ou o id de uma categoria */
export type Tab = string
export const PAGE_SIZES = [8, 15, 25, 50, 100]

interface Props {
  list: Edital[]
  total: number
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  transicoes: Transicao[]
  impugnacoes: ImpugnacaoCfg[]
  impugStatuses: ImpugStatusCfg[]
  counts: { all: number; retif: number; porCat: Record<string, number> }
  tab: Tab
  onTab: (t: Tab) => void
  page: number
  onPage: (p: number) => void
  pageSize: number
  onPageSize: (n: number) => void
  /** busca da lista (filtra a tabela) */
  q: string
  onQ: (v: string) => void
  sortAsc: boolean
  onSort: () => void
  selected: Set<number>
  onToggle: (ids: number[], checked: boolean) => void
  onTransicao: (id: number, t: Transicao) => void
  onRetif: (id: number) => void
  onHist: (id: number) => void
  onEdit: (id: number) => void
  onExportSel: () => void
}

/** Horário e data lado a lado. Hoje em vermelho; já passou, em cinza. */
function DateCell({ d, hora }: { d: string; hora: string }) {
  if (!d) return <span className="font-data-mono text-data-mono text-outline">A definir</span>
  const n = diasAte(d)
  const cor = n === 0 ? 'text-error' : n > 0 ? 'text-primary' : 'text-outline'
  return (
    <span className="flex items-center gap-1.5" title={n === 0 ? 'Hoje' : undefined}>
      <span className="rounded bg-surface-container px-1.5 py-0.5 font-data-mono text-data-mono text-on-surface">{hora || '--:--'}</span>
      <span className={`font-data-mono text-data-mono font-semibold ${cor}`}>{fmtDate(d)}</span>
    </span>
  )
}

/** Botão do fluxo: age direto quando só há uma opção; com várias, abre uma lista. */
function BotaoFluxo({ itens, icone, rotuloMenu, negativo, onPick }: { itens: Transicao[]; icone: string; rotuloMenu: string; negativo?: boolean; onPick: (t: Transicao) => void }) {
  // menu logo abaixo do botão, com a mesma largura mínima; sem espaço embaixo, abre para cima
  const [pos, setPos] = useState<{ x: number; y: number; w: number; maxH: number } | null>(null)
  useEffect(() => {
    if (!pos) return
    const fechar = () => setPos(null)
    window.addEventListener('scroll', fechar, true)
    window.addEventListener('resize', fechar)
    return () => {
      window.removeEventListener('scroll', fechar, true)
      window.removeEventListener('resize', fechar)
    }
  }, [pos])
  if (itens.length === 0) return null
  const cor = negativo
    ? 'border-error/25 bg-error/5 text-error hover:border-error hover:bg-error hover:text-white'
    : 'border-primary/25 bg-primary/5 text-primary hover:border-primary hover:bg-primary hover:text-white'
  const cls = `flex h-6 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[11px] font-semibold leading-none transition-colors ${cor}`
  if (itens.length === 1) {
    return (
      <button type="button" className={cls} onClick={() => onPick(itens[0])} title={itens[0].rotulo}>
        <span className="material-symbols-outlined text-[13px]">{icone}</span> {itens[0].rotulo}
      </button>
    )
  }
  return (
    <>
      <button
        type="button"
        className={cls}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const h = itens.length * 34 + 8
          const abaixo = window.innerHeight - r.bottom - 8
          const cabe = abaixo >= h || abaixo >= r.top - 8
          const maxH = Math.max(80, cabe ? abaixo : r.top - 8)
          setPos({
            x: Math.max(8, Math.min(r.left, window.innerWidth - Math.max(r.width, 170) - 8)),
            y: cabe ? r.bottom + 2 : Math.max(8, r.top - Math.min(h, maxH) - 2),
            w: Math.max(r.width, 170),
            maxH,
          })
        }}
      >
        <span className="material-symbols-outlined text-[13px]">{icone}</span> {rotuloMenu}
        <span className="material-symbols-outlined -mr-0.5 text-[14px]">expand_more</span>
      </button>
      {pos &&
        // fora da tabela: um ancestral com filtro/transform faria o "fixed" se posicionar errado
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200]"
              onClick={(e) => {
                e.stopPropagation()
                setPos(null)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setPos(null)
              }}
            />
            <div
              className="fixed z-[201] overflow-hidden rounded-lg bg-surface-container-lowest py-1 text-left shadow-xl ring-1 ring-black/10"
              style={{ left: pos.x, top: pos.y, minWidth: pos.w, maxHeight: pos.maxH, overflowY: 'auto' }}
            >
              {itens.map((t) => (
                <button
                  key={t.para}
                  type="button"
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left font-label-md text-label-md hover:bg-surface-container-low"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPos(null)
                    onPick(t)
                  }}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

/** Botões Avançar / Negativo de um edital segundo o fluxo (sem fluxo cadastrado, qualquer status é permitido). */
export function FluxoBotoes({ x, statuses, transicoes, onPick }: { x: Edital; statuses: StatusCfg[]; transicoes: Transicao[]; onPick: (t: Transicao) => void }) {
  const saidas: Transicao[] =
    transicoes.length > 0
      ? transicoes.filter((t) => t.de === x.status)
      : statuses.filter((s) => s.id !== x.status).map((s) => ({ de: x.status, para: s.id, rotulo: s.nome, negativo: false, exige: 'nada' as const, resultado: '' as const }))
  return (
    <>
      <BotaoFluxo itens={saidas.filter((t) => !t.negativo)} icone="arrow_forward" rotuloMenu="Avançar" onPick={onPick} />
      <BotaoFluxo itens={saidas.filter((t) => t.negativo)} icone="block" rotuloMenu="Negativo" negativo onPick={onPick} />
    </>
  )
}

/** Status atual + botões do fluxo. */
function StatusCell({ x, statuses, transicoes, onPick }: { x: Edital; statuses: StatusCfg[]; transicoes: Transicao[]; onPick: (t: Transicao) => void }) {
  const st = statusInfo(statuses, x.status)
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: st.cor }}>
        {st.nome}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1">
        <FluxoBotoes x={x} statuses={statuses} transicoes={transicoes} onPick={onPick} />
      </div>
    </div>
  )
}

export default function EditalTable(p: Props) {
  const pages = Math.max(1, Math.ceil(p.list.length / p.pageSize))
  const page = Math.min(p.page, pages)
  const slice = p.list.slice((page - 1) * p.pageSize, page * p.pageSize)
  const allChecked = slice.length > 0 && slice.every((x) => p.selected.has(x.id))

  const tabs: Array<{ id: Tab; label: string; n: number; dot?: string }> = [
    { id: 'ALL', label: 'Todos os Editais', n: p.counts.all },
    ...p.categorias.map((c) => ({ id: c.id, label: c.nome, n: p.counts.porCat[c.id] ?? 0, dot: c.cor })),
  ]

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
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
                <span className="rounded-full bg-surface-container px-2 text-[11px] text-on-surface">
                  {t.n}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-space-sm px-space-md py-space-sm">
        <div className="flex flex-1 flex-wrap items-center gap-space-sm">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
          <input
            value={p.q}
            onChange={(e) => p.onQ(e.target.value)}
            type="text"
            placeholder="Filtrar a lista: nº, UASG, órgão, cidade, portal…"
            className="h-9 w-full rounded-lg bg-surface-container-low pl-9 pr-8 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary"
          />
          {p.q && (
            <button type="button" onClick={() => p.onQ('')} title="Limpar busca" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-outline hover:bg-surface-container">
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
        {p.tab === 'RETIF' && (
          <button
            type="button"
            onClick={() => p.onTab('ALL')}
            title="Remover este filtro"
            className="flex h-8 items-center gap-1.5 rounded-full bg-error-container/50 pl-3 pr-2 text-[12px] font-bold text-error hover:bg-error-container"
          >
            Somente com retificações
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        )}
        </div>
        <span className="font-data-mono text-data-mono text-outline">
          Exibindo {slice.length} de {p.list.length} registros{p.list.length !== p.total ? ` (${p.total} no total)` : ''}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: 40 }} />
            <col style={{ width: 220 }} />
            <col />
            <col style={{ width: 176 }} />
            <col style={{ width: 170 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead>
            <tr className="h-10 select-none bg-surface-container-low font-label-sm text-label-sm uppercase tracking-wider text-outline">
              <th className="py-2 pl-3" />
              <th className="px-3 py-2">Edital</th>
              <th className="px-3 py-2">Órgão Comprador</th>
              <th className="cursor-pointer whitespace-nowrap px-3 py-2" onClick={p.onSort} title="Mais próximos de hoje primeiro; vencidos depois. Clique para inverter.">
                Data / Horário {p.sortAsc ? '▲' : '▼'}
              </th>
              <th className="px-3 py-2 text-right">Valores</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-body-md">
            {slice.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center font-label-md text-label-md text-outline">
                  {p.total
                    ? 'Nenhum edital nesta visão. Escolha outro cartão de situação ou ajuste os filtros.'
                    : 'Nenhum edital cadastrado ainda. Clique em "Novo Edital / Registro" para começar.'}
                </td>
              </tr>
            )}
            {slice.map((x) => {
              const last = x.retifs[x.retifs.length - 1]
              const cat = catInfo(p.categorias, x.cat)
              return (
                <tr
                  key={x.id}
                  onClick={() => p.onEdit(x.id)}
                  className={`cursor-pointer align-top transition-colors hover:bg-primary/[0.07] hover:shadow-[inset_4px_0_0_#0284c7] ${
                    x.resultado === 'GANHAMOS'
                      ? 'bg-green-50 shadow-[inset_5px_0_0_#16a34a]'
                      : x.resultado === 'PERDEMOS'
                        ? 'bg-red-50 shadow-[inset_5px_0_0_#dc2626]'
                        : x.status === 'RETIF'
                          ? 'bg-error-container/10'
                          : ''
                  }`}
                >
                  <td className="py-3 pl-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded" checked={p.selected.has(x.id)} onChange={(e) => p.onToggle([x.id], e.target.checked)} />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col gap-1 break-words" title={`Cadastrado por ${x.criadoPor || '—'} • Última alteração por ${x.atualizadoPor || '—'}`}>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: cat.cor }}>
                        <span className="h-2 w-2 rounded-full" style={{ background: cat.cor }} />
                        {cat.nome}
                      </span>
                      <span className="font-label-md text-label-md font-bold text-primary">{x.num || `#${x.id}`}</span>
                      {x.uasg && <span className="font-data-mono text-data-mono text-outline">{x.uasg}</span>}
                      <div className="flex flex-wrap gap-1">
                        {x.portal && <span className="rounded bg-surface-container px-1.5 text-[10px] font-semibold text-on-surface-variant">{x.portal}</span>}
                        {last && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              p.onHist(x.id)
                            }}
                            title="Ver as retificações deste edital"
                            className={`flex items-center gap-0.5 rounded px-1.5 text-[10px] font-bold ${last.dias > 0 ? 'bg-error text-white' : 'bg-[#e0f2fe] text-[#0369a1]'}`}
                          >
                            <span className="material-symbols-outlined text-[11px]">published_with_changes</span>
                            {x.retifs.length} retif.{last.dias > 0 ? ` +${last.dias}d` : ''}
                          </button>
                        )}
                        {x.impugnacoes.map((i) => {
                          const c = p.impugnacoes.find((y) => y.id === i.id)
                          const st = p.impugStatuses.find((y) => y.id === i.status)
                          return (
                            <span
                              key={i.id}
                              title={`${c?.nome ?? i.id} — ${st ? st.nome : 'sem resposta'}`}
                              className="flex items-center gap-1 rounded px-1.5 text-[10px] font-semibold"
                              style={{ background: `${c?.cor ?? '#64748b'}22`, color: c?.cor ?? '#64748b' }}
                            >
                              <span className="material-symbols-outlined text-[11px]">gavel</span>
                              {c?.nome ?? i.id}
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: st ? st.cor : '#cbd5e1' }} />
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col">
                      <span className="line-clamp-2 font-label-md text-label-md font-semibold">{x.orgao}</span>
                      <span className="font-label-sm text-label-sm text-outline">
                        {x.cidade ? `${x.cidade}/` : ''}{x.uf}
                        {x.atualizadoPor ? ` • ${x.atualizadoPor}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3"><DateCell d={x.data} hora={x.hora} /></td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {x.valorGanho > 0 || x.valorHomologado > 0 ? (
                      <div className="flex flex-col gap-1 font-data-mono text-data-mono">
                        {x.valorGanho > 0 && (
                          <span className="font-semibold text-secondary">
                            <span className="mr-1 text-[10px] font-bold uppercase text-outline">Ganho</span>
                            {brlFull(x.valorGanho)}
                          </span>
                        )}
                        {x.valorHomologado > 0 && (
                          <span className="font-semibold text-primary">
                            <span className="mr-1 text-[10px] font-bold uppercase text-outline">Homol.</span>
                            {brlFull(x.valorHomologado)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="font-data-mono text-data-mono text-outline">—</span>
                    )}
                  </td>
                  <td className="cursor-default px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <StatusCell x={x} statuses={p.statuses} transicoes={p.transicoes} onPick={(t) => p.onTransicao(x.id, t)} />
                  </td>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center">
                      <button type="button" onClick={() => p.onRetif(x.id)} title="Registrar retificação" className="rounded-lg p-1.5 text-error hover:bg-error-container/40">
                        <span className="material-symbols-outlined text-[20px]">published_with_changes</span>
                      </button>
                      <button type="button" onClick={() => p.onHist(x.id)} title="Histórico" className="rounded-lg p-1.5 text-primary hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[20px]">history</span>
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
        <div className="flex items-center gap-space-md font-label-sm text-label-sm text-outline">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="rounded" checked={allChecked} onChange={(e) => p.onToggle(slice.map((x) => x.id), e.target.checked)} />
            <span className="text-on-surface">Selecionar todos da página</span>
          </label>
          <span className="h-4 w-px bg-outline-variant/40" />
          <button type="button" onClick={p.onExportSel} className="transition-colors hover:text-primary">Exportar Marcados</button>
        </div>
        <div className="flex items-center gap-space-sm font-data-mono text-data-mono">
          <label className="flex items-center gap-1.5 text-outline">
            Por página
            <select
              value={p.pageSize}
              onChange={(e) => p.onPageSize(Number(e.target.value))}
              className="h-7 rounded bg-surface-container-lowest px-1.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <span className="h-4 w-px bg-outline-variant/40" />
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
