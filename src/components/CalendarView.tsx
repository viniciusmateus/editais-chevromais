import { useMemo, useState } from 'react'
import type { CategoriaCfg, Edital, Portal, StatusCfg } from '../shared'
import { catInfo, fmtDate, isoDate, statusInfo, todayIso } from '../lib/utils'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const PALETA = ['#0284c7', '#d97706', '#16a34a', '#7c3aed', '#db2777', '#0d9488', '#ca8a04', '#ea580c', '#4f46e5', '#65a30d']
const SEM_PORTAL = 'Sem portal'
const MAX_CHIPS = 3

interface Props {
  editais: Edital[]
  portais: Portal[]
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  onEdit: (id: number) => void
  onHist: (id: number) => void
}

const nomePortal = (e: Edital) => e.portal || SEM_PORTAL
const pad = (n: number) => String(n).padStart(2, '0')
const keyDe = (ano: number, mes: number, dia: number) => `${ano}-${pad(mes + 1)}-${pad(dia)}`

/** Calendário mensal: cada dia mostra quantos editais vencem em cada portal; clicar no dia lista os editais. */
export default function CalendarView({ editais, portais, categorias, statuses, onEdit, onHist }: Props) {
  const hoje = todayIso()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const [sel, setSel] = useState(hoje)
  const [ocultos, setOcultos] = useState<Set<string>>(new Set())

  const cor = (nome: string) => {
    if (nome === SEM_PORTAL) return '#64748b'
    const i = portais.findIndex((p) => p.nome === nome)
    if (i >= 0) return PALETA[i % PALETA.length]
    let h = 0
    for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0
    return PALETA[h % PALETA.length]
  }

  // editais com data, agrupados por dia (já sem os portais ocultados na legenda)
  const porDia = useMemo(() => {
    const m = new Map<string, Edital[]>()
    for (const e of editais) {
      if (!e.data || ocultos.has(nomePortal(e))) continue
      const l = m.get(e.data)
      if (l) l.push(e)
      else m.set(e.data, [e])
    }
    for (const l of m.values()) l.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))
    return m
  }, [editais, ocultos])

  const semData = editais.filter((e) => !e.data).length

  // portais que aparecem na legenda: os cadastrados + os que só existem nos editais
  const legenda = useMemo(() => {
    const nomes = new Set<string>(portais.map((p) => p.nome))
    for (const e of editais) if (e.data) nomes.add(nomePortal(e))
    return [...nomes]
  }, [editais, portais])

  const { ano, mes } = cursor
  const primeiro = new Date(ano, mes, 1)
  const inicio = new Date(ano, mes, 1 - primeiro.getDay())
  const celulas = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
    return { iso: isoDate(d), dia: d.getDate(), fora: d.getMonth() !== mes, fimDeSemana: d.getDay() === 0 || d.getDay() === 6 }
  })
  // some a última semana se for inteira do mês seguinte
  const linhas = celulas[35].fora && celulas[35].dia < 8 ? 5 : 6
  const visiveis = celulas.slice(0, linhas * 7)

  const totalMes = visiveis.reduce((n, c) => (c.fora ? n : n + (porDia.get(c.iso)?.length ?? 0)), 0)

  const mover = (delta: number) => setCursor(({ ano: a, mes: m }) => {
    const d = new Date(a, m + delta, 1)
    return { ano: d.getFullYear(), mes: d.getMonth() }
  })
  const irHoje = () => {
    const d = new Date()
    setCursor({ ano: d.getFullYear(), mes: d.getMonth() })
    setSel(hoje)
  }
  const alternar = (nome: string) =>
    setOcultos((p) => {
      const n = new Set(p)
      if (n.has(nome)) n.delete(nome)
      else n.add(nome)
      return n
    })

  const doDia = porDia.get(sel) ?? []
  const [sy, sm, sd] = sel.split('-').map(Number)
  const tituloDia = `${DIAS_LONGOS[new Date(sy, sm - 1, sd).getDay()]}, ${sd} de ${MESES[sm - 1].toLowerCase()} de ${sy}`

  const btnNav = 'flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container'

  return (
    <div className="grid grid-cols-1 gap-space-md xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <h2 className="min-w-[11rem] font-headline-sm text-headline-sm text-on-surface">
              {MESES[mes]} <span className="font-normal text-outline">{ano}</span>
            </h2>
            <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">{totalMes} edital(is) no mês</span>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={irHoje} className="mr-1 rounded-lg border border-surface-container px-3 py-1.5 font-label-md text-label-md text-primary hover:bg-surface-container-low">
              Hoje
            </button>
            <button type="button" aria-label="Mês anterior" onClick={() => mover(-1)} className={btnNav}>
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button type="button" aria-label="Próximo mês" onClick={() => mover(1)} className={btnNav}>
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        </div>

        {legenda.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {legenda.map((n) => {
              const off = ocultos.has(n)
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => alternar(n)}
                  title={off ? 'Mostrar este portal' : 'Ocultar este portal'}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-opacity ${off ? 'border-surface-container text-outline line-through opacity-50' : 'border-transparent text-on-surface'}`}
                  style={off ? undefined : { background: `${cor(n)}1f` }}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: cor(n) }} />
                  {n}
                </button>
              )
            })}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-surface-container">
          <div className="grid grid-cols-7 border-b border-surface-container bg-surface-container-low">
            {DIAS.map((d) => (
              <div key={d} className="py-1.5 text-center font-label-sm text-label-sm uppercase tracking-wider text-outline">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {visiveis.map((c, i) => {
              const lista = porDia.get(c.iso) ?? []
              const ehHoje = c.iso === hoje
              const ehSel = c.iso === sel
              const grupos = new Map<string, number>()
              for (const e of lista) grupos.set(nomePortal(e), (grupos.get(nomePortal(e)) ?? 0) + 1)
              const chips = [...grupos.entries()].sort((a, b) => b[1] - a[1])
              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => {
                    setSel(c.iso)
                    if (c.fora) setCursor({ ano: Number(c.iso.slice(0, 4)), mes: Number(c.iso.slice(5, 7)) - 1 })
                  }}
                  aria-label={`${fmtDate(c.iso)}: ${lista.length} edital(is)`}
                  className={`flex min-h-[104px] flex-col items-stretch gap-1 border-surface-container p-1.5 text-left align-top transition-colors hover:bg-surface-container-low ${
                    i % 7 !== 6 ? 'border-r' : ''
                  } ${i < visiveis.length - 7 ? 'border-b' : ''} ${c.fora ? 'bg-surface-container-low/60' : c.fimDeSemana ? 'bg-surface-container-low/30' : ''} ${
                    ehSel ? 'ring-2 ring-inset ring-primary' : ''
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold ${
                        ehHoje ? 'bg-primary text-on-primary' : c.fora ? 'text-outline/60' : 'text-on-surface'
                      }`}
                    >
                      {c.dia}
                    </span>
                    {lista.length > 0 && <span className="text-[11px] font-semibold text-outline">{lista.length}</span>}
                  </span>
                  {chips.slice(0, MAX_CHIPS).map(([nome, n]) => (
                    <span
                      key={nome}
                      className={`flex items-center gap-1 truncate rounded px-1.5 py-px text-[11px] font-medium leading-tight ${c.fora ? 'opacity-60' : ''}`}
                      style={{ background: `${cor(nome)}26`, color: cor(nome), borderLeft: `3px solid ${cor(nome)}` }}
                      title={`${nome}: ${n} edital(is)`}
                    >
                      <b className="shrink-0">{n}</b>
                      <span className="truncate">{nome}</span>
                    </span>
                  ))}
                  {chips.length > MAX_CHIPS && <span className="px-1 text-[11px] font-medium text-outline">+{chips.length - MAX_CHIPS} portal(is)</span>}
                </button>
              )
            })}
          </div>
        </div>
        {semData > 0 && <p className="text-[12px] text-outline">{semData} edital(is) estão com a data “a definir” e não aparecem no calendário.</p>}
      </section>

      <aside className="flex max-h-[760px] flex-col gap-space-sm overflow-y-auto rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
        <div>
          <div className="font-label-sm text-label-sm uppercase tracking-wider text-outline">{sel === hoje ? 'Hoje' : 'Dia selecionado'}</div>
          <h3 className="font-headline-sm text-headline-sm capitalize text-on-surface">{tituloDia}</h3>
          <p className="text-body-sm text-on-surface-variant">{doDia.length ? `${doDia.length} edital(is) com prazo neste dia` : 'Nenhum edital com prazo neste dia.'}</p>
        </div>
        {doDia.map((e) => {
          const st = statusInfo(statuses, e.status)
          const cat = catInfo(categorias, e.cat)
          const pn = nomePortal(e)
          return (
            <div key={e.id} className="rounded-lg border border-surface-container p-space-sm" style={{ borderLeft: `4px solid ${cor(pn)}` }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-data-mono text-[12px] font-bold text-primary">{e.hora ? `${e.hora}h` : 'Sem horário'}</span>
                <span className="truncate text-[11px] font-semibold" style={{ color: cor(pn) }}>{pn}</span>
              </div>
              <div className="mt-0.5 font-label-md text-label-md font-bold text-on-surface">{e.num || `Edital #${e.id}`}</div>
              <div className="truncate text-body-sm text-on-surface-variant" title={e.orgao}>{e.orgao || '—'}{e.uf ? ` • ${e.uf}` : ''}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${cat.cor}22`, color: cat.cor }}>{cat.nome}</span>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: `${st.cor}22`, color: st.cor }}>{st.nome}</span>
              </div>
              <div className="mt-1.5 flex gap-1">
                <button type="button" onClick={() => onEdit(e.id)} className="rounded bg-surface-container-low px-2 py-1 text-[12px] font-medium text-primary hover:bg-surface-container">
                  Editar
                </button>
                <button type="button" onClick={() => onHist(e.id)} className="rounded bg-surface-container-low px-2 py-1 text-[12px] font-medium text-primary hover:bg-surface-container">
                  Histórico
                </button>
              </div>
            </div>
          )
        })}
      </aside>
    </div>
  )
}
