import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { type CategoriaCfg, type Edital, type ImpugnacaoCfg, type ImpugStatusCfg, type StatusCfg, type Transicao } from '../shared'
import { brlFull, catInfo, fmtDate, statusInfo, todayIso } from '../lib/utils'

/** 'ALL', 'RETIF' ou o id de uma categoria */
export type Tab = string
export const PAGE_SIZE = 8

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

function CatBadge({ cat }: { cat: CategoriaCfg }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 font-label-sm text-label-sm font-bold"
      style={{ background: `${cat.cor}22`, color: cat.cor }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: cat.cor }} />
      {cat.nome}
    </span>
  )
}

/** Horário e data juntos: "07:00 15/10/2026". Hoje em vermelho, vencidos riscados. */
function DateCell({ d, hora }: { d: string; hora: string }) {
  const t = todayIso()
  if (!d) return <span className="font-data-mono text-data-mono text-outline">A Definir</span>
  const h = <span className="mr-1.5 rounded bg-surface-container px-1.5 py-0.5 font-data-mono text-data-mono text-on-surface">{hora || '--:--'}</span>
  if (d === t) return <span className="font-data-mono text-data-mono font-bold text-error">{h}HOJE ({fmtDate(d)})</span>
  if (d < t) return <span className="font-data-mono text-data-mono text-outline line-through">{h}{fmtDate(d)}</span>
  return <span className="font-data-mono text-data-mono font-semibold text-primary">{h}{fmtDate(d)}</span>
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
  const cor = negativo ? 'bg-error-container/50 text-error hover:bg-error-container' : 'bg-primary text-on-primary hover:bg-primary-hover'
  const cls = `flex items-center gap-1 rounded-lg px-2.5 py-1 font-label-sm text-label-sm font-bold ${cor}`
  if (itens.length === 1) {
    return (
      <button type="button" className={cls} onClick={() => onPick(itens[0])} title={itens[0].rotulo}>
        <span className="material-symbols-outlined text-[14px]">{icone}</span> {itens[0].rotulo}
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
        <span className="material-symbols-outlined text-[14px]">{icone}</span> {rotuloMenu}
        <span className="material-symbols-outlined text-[14px]">expand_more</span>
      </button>
      {pos &&
        // fora da tabela: um ancestral com filtro/transform faria o "fixed" se posicionar errado
        createPortal(
          <>
            <div className="fixed inset-0 z-[200]" onClick={() => setPos(null)} onContextMenu={() => setPos(null)} />
            <div
              className="fixed z-[201] overflow-hidden rounded-lg bg-surface-container-lowest py-1 text-left shadow-xl ring-1 ring-black/10"
              style={{ left: pos.x, top: pos.y, minWidth: pos.w, maxHeight: pos.maxH, overflowY: 'auto' }}
            >
              {itens.map((t) => (
                <button
                  key={t.para}
                  type="button"
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left font-label-md text-label-md hover:bg-surface-container-low"
                  onClick={() => {
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

/** Status atual + botões Avançar / Negativo segundo o fluxo (sem fluxo cadastrado, qualquer status é permitido). */
function StatusCell({ x, statuses, transicoes, onPick }: { x: Edital; statuses: StatusCfg[]; transicoes: Transicao[]; onPick: (t: Transicao) => void }) {
  const st = statusInfo(statuses, x.status)
  const saidas: Transicao[] =
    transicoes.length > 0
      ? transicoes.filter((t) => t.de === x.status)
      : statuses.filter((s) => s.id !== x.status).map((s) => ({ de: x.status, para: s.id, rotulo: s.nome, negativo: false, exige: 'nada' as const, resultado: '' as const }))
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="rounded-full px-3 py-1 font-label-sm text-label-sm font-bold text-white shadow-sm" style={{ background: st.cor }}>
        {st.nome}
      </span>
      <div className="flex items-center gap-1">
        <BotaoFluxo itens={saidas.filter((t) => !t.negativo)} icone="arrow_forward" rotuloMenu="Avançar" onPick={onPick} />
        <BotaoFluxo itens={saidas.filter((t) => t.negativo)} icone="block" rotuloMenu="Negativo" negativo onPick={onPick} />
      </div>
    </div>
  )
}

export default function EditalTable(p: Props) {
  const pages = Math.max(1, Math.ceil(p.list.length / PAGE_SIZE))
  const page = Math.min(p.page, pages)
  const slice = p.list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const allChecked = slice.length > 0 && slice.every((x) => p.selected.has(x.id))

  const tabs: Array<{ id: Tab; label: string; n: number; dot?: string; danger?: boolean }> = [
    { id: 'ALL', label: 'Todos os Editais', n: p.counts.all },
    ...p.categorias.map((c) => ({ id: c.id, label: c.nome, n: p.counts.porCat[c.id] ?? 0, dot: c.cor })),
    { id: 'RETIF', label: 'Com Retificações', n: p.counts.retif, dot: '#ba1a1a', danger: true },
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
              <th className="w-8 px-space-md py-2" />
              <th className="px-space-md py-2">Categoria</th>
              <th className="px-space-md py-2">Edital / UASG</th>
              <th className="px-space-md py-2">Órgão Comprador</th>
              <th className="px-space-md py-2">Retificações</th>
              <th className="cursor-pointer whitespace-nowrap px-space-md py-2" onClick={p.onSort} title="Ordena por data e horário">
                Data / Horário {p.sortAsc ? '▲' : '▼'}
              </th>
              <th className="px-space-md py-2 text-right">Valor Ganho</th>
              <th className="px-space-md py-2 text-right">Valor Homologado</th>
              <th className="px-space-md py-2 text-center">Status</th>
              <th className="px-space-md py-2 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low text-body-md">
            {slice.length === 0 && (
              <tr>
                <td colSpan={10} className="py-8 text-center font-label-md text-label-md text-outline">
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
                  className={`transition-colors hover:brightness-95 ${
                    x.resultado === 'GANHAMOS'
                      ? 'bg-green-50 shadow-[inset_5px_0_0_#16a34a]'
                      : x.resultado === 'PERDEMOS'
                        ? 'bg-red-50 shadow-[inset_5px_0_0_#dc2626]'
                        : x.status === 'RETIF'
                          ? 'bg-error-container/10'
                          : x.status === 'IMPUG'
                            ? 'bg-[#fff7ed]'
                            : ''
                  }`}
                >
                  <td className="px-space-md py-3">
                    <input type="checkbox" className="rounded" checked={p.selected.has(x.id)} onChange={(e) => p.onToggle([x.id], e.target.checked)} />
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3"><CatBadge cat={catInfo(p.categorias, x.cat)} /></td>
                  <td className="whitespace-nowrap px-space-md py-3">
                    <div
                      className="flex flex-col"
                      title={`Cadastrado por ${x.criadoPor || '—'} • Última alteração por ${x.atualizadoPor || '—'}`}
                    >
                      <span className="font-label-md text-label-md font-bold text-primary">{x.num}</span>
                      <span className="font-data-mono text-data-mono text-outline">{x.uasg}</span>
                      {x.portal && (
                        <span className="mt-0.5 w-fit rounded bg-surface-container px-1.5 text-[10px] font-semibold text-on-surface-variant">{x.portal}</span>
                      )}
                      {x.impugnacoes.length > 0 && (
                        <div className="mt-1 flex max-w-[220px] flex-wrap gap-1 whitespace-normal">
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
                      )}
                    </div>
                  </td>
                  <td className="min-w-[190px] px-space-md py-3">
                    <div className="flex flex-col">
                      <span className="font-label-md text-label-md font-semibold">{x.orgao}</span>
                      <span
                        className="font-label-sm text-label-sm text-outline"
                        title={`Cadastrado por ${x.criadoPor || '—'} • Última alteração por ${x.atualizadoPor || '—'}`}
                      >
                        {x.cidade ? `${x.cidade}/` : ''}{x.uf}
                        {x.atualizadoPor ? ` • ${x.atualizadoPor}` : ''}
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3">
                    {last ? (
                      <span className={`rounded px-1.5 py-0.5 font-label-sm text-[11px] font-bold ${last.dias > 0 ? 'bg-error text-white' : 'bg-[#e0f2fe] text-[#0369a1]'}`}>
                        {x.retifs.length} retif.{last.dias > 0 ? ` (+${last.dias}d)` : ''}
                      </span>
                    ) : (
                      <span className="font-label-sm text-label-sm italic text-outline">Sem alterações</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3"><DateCell d={x.data} hora={x.hora} /></td>
                  <td className="whitespace-nowrap px-space-md py-3 text-right">
                    {x.valorGanho > 0 ? (
                      <span className="font-data-mono text-data-mono font-semibold text-secondary">{brlFull(x.valorGanho)}</span>
                    ) : (
                      <span className="font-data-mono text-data-mono text-outline">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3 text-right">
                    {x.valorHomologado > 0 ? (
                      <span className="font-data-mono text-data-mono font-semibold text-secondary">{brlFull(x.valorHomologado)}</span>
                    ) : (
                      <span className="font-data-mono text-data-mono text-outline">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3 text-center">
                    <StatusCell x={x} statuses={p.statuses} transicoes={p.transicoes} onPick={(t) => p.onTransicao(x.id, t)} />
                  </td>
                  <td className="whitespace-nowrap px-space-md py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => p.onRetif(x.id)} title="Adicionar Retificação" className="flex items-center gap-1 rounded bg-surface-container-low px-2 py-1 text-label-sm font-semibold text-primary hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[14px]">add</span> Retificação
                      </button>
                      <button type="button" onClick={() => p.onHist(x.id)} title="Ver Histórico" className="rounded p-1.5 text-primary hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">history</span>
                      </button>
                      <button type="button" onClick={() => p.onEdit(x.id)} title="Editar" className="rounded p-1.5 text-primary hover:bg-surface-container">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
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
