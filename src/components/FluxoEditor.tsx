import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { EXIGE_LABEL, type ExigeTransicao, type Resultado, type StatusCfg, type Transicao } from '../shared'
import { btnGhost, btnPrimary, input, labelCls } from './Modals'

const NODE_W = 176
const NODE_H = 54
const INICIAL = 'PREP'

type Pos = Record<string, { x: number; y: number }>
type Pt = { x: number; y: number }

const chave = (t: Pick<Transicao, 'de' | 'para'>) => `${t.de}>${t.para}`

/**
 * Distribui os status em colunas pela distância até o status inicial, seguindo só as ligações "Avançar".
 * Status que só se alcançam por ligações "Negativo" ficam numa faixa própria, embaixo.
 * Sem ligações: grade na ordem cadastrada.
 */
function layoutAutomatico(statuses: StatusCfg[], ligacoes: Transicao[]): Pos {
  const out: Pos = {}
  const COL = 280
  const LIN = 90
  if (ligacoes.length === 0) {
    statuses.forEach((s, i) => (out[s.id] = { x: 30 + (i % 4) * 230, y: 30 + Math.floor(i / 4) * 110 }))
    return out
  }
  const nivel = new Map<string, number>()
  const fila: string[] = []
  const ini = statuses.some((s) => s.id === INICIAL) ? INICIAL : statuses[0]?.id
  if (ini) {
    nivel.set(ini, 0)
    fila.push(ini)
  }
  while (fila.length) {
    const id = fila.shift()!
    for (const t of ligacoes) {
      if (t.de === id && !t.negativo && !nivel.has(t.para)) {
        nivel.set(t.para, nivel.get(id)! + 1)
        fila.push(t.para)
      }
    }
  }
  // só por ligações negativas: uma coluna depois de quem leva até eles
  const negativos = new Map<string, number>()
  for (const t of ligacoes) {
    if (nivel.has(t.para) || !nivel.has(t.de)) continue
    negativos.set(t.para, Math.min(negativos.get(t.para) ?? Infinity, nivel.get(t.de)! + 1))
  }
  const linhas = new Map<number, number>()
  let maxLinhas = 1
  for (const s of statuses) {
    const n = nivel.get(s.id)
    if (n === undefined) continue
    const l = linhas.get(n) ?? 0
    linhas.set(n, l + 1)
    maxLinhas = Math.max(maxLinhas, l + 1)
    out[s.id] = { x: 30 + n * COL, y: 30 + l * LIN }
  }
  const baseY = 30 + maxLinhas * LIN + 50
  const linhasNeg = new Map<number, number>()
  const soltos: string[] = []
  for (const s of statuses) {
    if (out[s.id]) continue
    const n = negativos.get(s.id)
    if (n === undefined) {
      soltos.push(s.id)
      continue
    }
    const l = linhasNeg.get(n) ?? 0
    linhasNeg.set(n, l + 1)
    out[s.id] = { x: 30 + n * COL, y: baseY + l * LIN }
  }
  const baseSoltos = baseY + Math.max(0, ...linhasNeg.values()) * LIN + 40
  soltos.forEach((id, i) => (out[id] = { x: 30 + (i % 4) * COL, y: baseSoltos + Math.floor(i / 4) * LIN }))
  return out
}

/** Ponto onde a reta do centro do retângulo até `alvo` cruza a borda dele. */
function borda(c: Pt, alvo: Pt, folga = 6): Pt {
  const dx = alvo.x - c.x
  const dy = alvo.y - c.y
  if (!dx && !dy) return c
  const s = Math.min(dx ? (NODE_W / 2 + folga) / Math.abs(dx) : Infinity, dy ? (NODE_H / 2 + folga) / Math.abs(dy) : Infinity)
  return { x: c.x + dx * s, y: c.y + dy * s }
}

interface Geo {
  d: string
  label: Pt
}

function geometria(a: Pt, b: Pt, curvo: boolean): Geo {
  const ca = { x: a.x + NODE_W / 2, y: a.y + NODE_H / 2 }
  const cb = { x: b.x + NODE_W / 2, y: b.y + NODE_H / 2 }
  const dx = cb.x - ca.x
  const dy = cb.y - ca.y
  const len = Math.hypot(dx, dy) || 1
  const k = curvo ? 56 : 0
  const ctrl = { x: (ca.x + cb.x) / 2 + (-dy / len) * k, y: (ca.y + cb.y) / 2 + (dx / len) * k }
  const p0 = borda(ca, ctrl)
  const p1 = borda(cb, ctrl, 8)
  return {
    d: `M ${p0.x} ${p0.y} Q ${ctrl.x} ${ctrl.y} ${p1.x} ${p1.y}`,
    label: { x: 0.25 * p0.x + 0.5 * ctrl.x + 0.25 * p1.x, y: 0.25 * p0.y + 0.5 * ctrl.y + 0.25 * p1.y },
  }
}

interface Props {
  statuses: StatusCfg[]
  transicoes: Transicao[]
  onSave: (v: { transicoes: Transicao[]; posicoes: Pos }) => Promise<boolean>
}

export default function FluxoEditor({ statuses, transicoes, onSave }: Props) {
  const inicial = () => {
    const auto = layoutAutomatico(statuses, transicoes)
    const pos: Pos = {}
    for (const s of statuses) pos[s.id] = s.x !== undefined && s.y !== undefined ? { x: s.x, y: s.y } : auto[s.id]
    return pos
  }
  const [pos, setPos] = useState<Pos>(inicial)
  const [ligacoes, setLigacoes] = useState<Transicao[]>(transicoes)
  const [sel, setSel] = useState<string | null>(null)
  const [fio, setFio] = useState<{ de: string; to: Pt } | null>(null)
  const [sujo, setSujo] = useState(false)
  const [busy, setBusy] = useState(false)
  const canvas = useRef<HTMLDivElement>(null)

  // quando o servidor devolve dados novos (ou outra pessoa mexe) e não há edição pendente, volta a espelhar o servidor
  const assinatura = JSON.stringify([statuses.map((s) => [s.id, s.nome, s.cor, s.x, s.y]), transicoes])
  useEffect(() => {
    if (sujo) return
    setLigacoes(transicoes)
    setPos(inicial())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura])

  const nome = (id: string) => statuses.find((s) => s.id === id)?.nome ?? id
  const cor = (id: string) => statuses.find((s) => s.id === id)?.cor ?? '#64748b'
  const selecionada = ligacoes.find((t) => chave(t) === sel)

  const alterar = (fn: (l: Transicao[]) => Transicao[]) => {
    setLigacoes(fn)
    setSujo(true)
  }
  const mudar = (k: string, patch: Partial<Transicao>) => alterar((l) => l.map((t) => (chave(t) === k ? { ...t, ...patch } : t)))

  const ponto = (ev: { clientX: number; clientY: number }): Pt => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }
  const noNo = (p: Pt) => statuses.find((s) => p.x >= pos[s.id].x && p.x <= pos[s.id].x + NODE_W && p.y >= pos[s.id].y && p.y <= pos[s.id].y + NODE_H)?.id

  const arrastar = (e: RPointerEvent, id: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    const p0 = ponto(e)
    const off = { x: p0.x - pos[id].x, y: p0.y - pos[id].y }
    const mv = (ev: PointerEvent) => {
      const p = ponto(ev)
      setPos((cur) => ({ ...cur, [id]: { x: Math.max(0, Math.round(p.x - off.x)), y: Math.max(0, Math.round(p.y - off.y)) } }))
      setSujo(true)
    }
    const up = () => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }

  const ligar = (e: RPointerEvent, de: string) => {
    e.preventDefault()
    e.stopPropagation()
    const mv = (ev: PointerEvent) => setFio({ de, to: ponto(ev) })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv)
      window.removeEventListener('pointerup', up)
      setFio(null)
      const alvo = noNo(ponto(ev))
      if (!alvo || alvo === de) return
      const nova: Transicao = { de, para: alvo, rotulo: nome(alvo), negativo: false, exige: 'nada', resultado: '' }
      setLigacoes((l) => (l.some((t) => chave(t) === chave(nova)) ? l : [...l, nova]))
      setSujo(true)
      setSel(chave(nova))
    }
    setFio({ de, to: ponto(e) })
    window.addEventListener('pointermove', mv)
    window.addEventListener('pointerup', up)
  }

  const largura = Math.max(900, ...statuses.map((s) => (pos[s.id]?.x ?? 0) + NODE_W + 80))
  const altura = Math.max(520, ...statuses.map((s) => (pos[s.id]?.y ?? 0) + NODE_H + 80))

  const geos = useMemo(
    () =>
      ligacoes
        .filter((t) => pos[t.de] && pos[t.para])
        .map((t) => ({ t, g: geometria(pos[t.de], pos[t.para], ligacoes.some((o) => o.de === t.para && o.para === t.de)) })),
    [ligacoes, pos],
  )

  const salvar = async () => {
    setBusy(true)
    const ok = await onSave({ transicoes: ligacoes, posicoes: pos })
    setBusy(false)
    if (ok) setSujo(false)
  }
  const descartar = () => {
    setLigacoes(transicoes)
    setPos(inicial())
    setSel(null)
    setSujo(false)
  }
  const reorganizar = () => {
    setPos(layoutAutomatico(statuses, ligacoes))
    setSujo(true)
  }

  const COR_NEG = '#ba1a1a'
  const COR_OK = '#475569'
  const COR_SEL = '#0284c7'

  return (
    <div className="flex flex-col gap-space-sm">
      <p className="text-body-sm text-on-surface-variant">
        Monte o caminho que um edital percorre. Arraste o <b>círculo à direita</b> de um status até outro para criar uma ligação; clique na ligação para definir o texto do botão, se é <b>Avançar</b> ou{' '}
        <b>Negativo</b>, o que o usuário precisa preencher e se ela marca ganhou/perdeu. Um edital só pode ir para os status que têm ligação saindo do status em que ele está. Sem nenhuma ligação, qualquer
        mudança é livre.
      </p>

      <div className="flex flex-wrap items-center gap-space-sm">
        <button type="button" disabled={!sujo || busy} onClick={salvar} className={btnPrimary}>
          {busy ? 'Salvando…' : 'Salvar fluxo'}
        </button>
        <button type="button" disabled={!sujo || busy} onClick={descartar} className={`${btnGhost} disabled:opacity-50`}>
          Descartar alterações
        </button>
        <button type="button" onClick={reorganizar} className={btnGhost}>
          Organizar automaticamente
        </button>
        {sujo && <span className="rounded-full bg-[#fff7ed] px-2.5 py-0.5 text-[12px] font-semibold text-[#9a3412]">Alterações não salvas</span>}
        <span className="ml-auto flex items-center gap-3 text-[12px] text-outline">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5 bg-[#475569]" /> Avançar</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed" style={{ borderColor: COR_NEG }} /> Negativo</span>
        </span>
      </div>

      <div className="flex flex-col gap-space-sm lg:flex-row">
        <div className="h-[560px] min-w-0 flex-1 overflow-auto rounded-lg border border-surface-container bg-surface-container-low/40">
          <div
            ref={canvas}
            className="relative"
            style={{ width: largura, height: altura, backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)', backgroundSize: '22px 22px' }}
            onPointerDown={() => setSel(null)}
          >
            <svg className="absolute inset-0" width={largura} height={altura}>
              <defs>
                {[
                  ['ok', COR_OK],
                  ['neg', COR_NEG],
                  ['sel', COR_SEL],
                ].map(([id, c]) => (
                  <marker key={id} id={`seta-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                  </marker>
                ))}
              </defs>
              {geos.map(({ t, g }) => {
                const k = chave(t)
                const ativo = k === sel
                const c = ativo ? COR_SEL : t.negativo ? COR_NEG : COR_OK
                const m = ativo ? 'sel' : t.negativo ? 'neg' : 'ok'
                return (
                  <g key={k}>
                    <path d={g.d} fill="none" stroke={c} strokeWidth={ativo ? 3 : 2} strokeDasharray={t.negativo ? '7 5' : undefined} markerEnd={`url(#seta-${m})`} />
                    <path
                      d={g.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        setSel(k)
                      }}
                    />
                  </g>
                )
              })}
              {fio && pos[fio.de] && (
                <line
                  x1={pos[fio.de].x + NODE_W}
                  y1={pos[fio.de].y + NODE_H / 2}
                  x2={fio.to.x}
                  y2={fio.to.y}
                  stroke={COR_SEL}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {geos.map(({ t, g }) => {
              const k = chave(t)
              const ativo = k === sel
              return (
                <button
                  key={k}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    setSel(k)
                  }}
                  className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm ${
                    ativo ? 'border-[#0284c7] bg-[#e0f2fe] text-[#075985]' : t.negativo ? 'border-[#ba1a1a]/40 bg-white text-[#ba1a1a]' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                  style={{ left: g.label.x, top: g.label.y }}
                >
                  {t.rotulo}
                  {t.exige === 'motivo' && <span className="material-symbols-outlined text-[12px]">notes</span>}
                  {(t.exige === 'valorGanho' || t.exige === 'valorHomologado') && <span className="material-symbols-outlined text-[12px]">payments</span>}
                  {t.resultado && <span className="material-symbols-outlined text-[12px]">{t.resultado === 'GANHAMOS' ? 'thumb_up' : 'thumb_down'}</span>}
                </button>
              )
            })}

            {statuses.map((s) => {
              const p = pos[s.id]
              if (!p) return null
              return (
                <div
                  key={s.id}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    arrastar(e, s.id)
                  }}
                  className="absolute z-20 flex cursor-grab select-none items-center gap-2 rounded-xl bg-surface-container-lowest px-3 shadow-md active:cursor-grabbing"
                  style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H, border: `2px solid ${s.cor}` }}
                  title="Arraste para mover"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.cor }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-label-md text-label-md font-bold text-on-surface">{s.nome}</span>
                    {s.id === INICIAL && <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">Início</span>}
                  </span>
                  <span
                    onPointerDown={(e) => ligar(e, s.id)}
                    title="Arraste até outro status para criar uma ligação"
                    className="absolute -right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border-2 border-white text-white shadow"
                    style={{ background: s.cor }}
                  >
                    <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <aside className="w-full shrink-0 rounded-lg border border-surface-container p-space-md lg:w-72">
          {!selecionada ? (
            <div className="text-body-sm text-on-surface-variant">
              <h4 className="mb-1 font-label-md text-label-md font-bold uppercase text-primary">Ligações</h4>
              <p>Clique numa ligação do mapa para editar.</p>
              {ligacoes.length === 0 && <p className="mt-2">Nenhuma ligação ainda — o fluxo está livre.</p>}
              <ul className="mt-2 flex flex-col gap-1">
                {ligacoes.map((t) => (
                  <li key={chave(t)}>
                    <button type="button" onClick={() => setSel(chave(t))} className="w-full rounded px-2 py-1 text-left hover:bg-surface-container-low">
                      <span style={{ color: cor(t.de) }}>●</span> {nome(t.de)} → <span style={{ color: cor(t.para) }}>●</span> {nome(t.para)}
                      <span className="block text-[11px] text-outline">
                        {t.negativo ? 'Negativo' : 'Avançar'} • “{t.rotulo}”
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col gap-space-sm">
              <h4 className="font-label-md text-label-md font-bold uppercase text-primary">
                {nome(selecionada.de)} → {nome(selecionada.para)}
              </h4>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Texto do botão</span>
                <input className={input} maxLength={40} value={selecionada.rotulo} onChange={(e) => mudar(chave(selecionada), { rotulo: e.target.value })} />
              </label>
              <div className="flex flex-col gap-1">
                <span className={labelCls}>Em qual botão aparece</span>
                <div className="flex overflow-hidden rounded-lg border border-surface-container">
                  {[false, true].map((neg) => (
                    <button
                      key={String(neg)}
                      type="button"
                      onClick={() => mudar(chave(selecionada), { negativo: neg })}
                      className={`flex-1 px-2 py-1.5 font-label-md text-label-md ${
                        selecionada.negativo === neg ? (neg ? 'bg-error font-bold text-white' : 'bg-primary font-bold text-on-primary') : 'bg-surface-container-lowest text-on-surface-variant'
                      }`}
                    >
                      {neg ? 'Negativo' : 'Avançar'}
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>O usuário precisa informar</span>
                <select className={input} value={selecionada.exige} onChange={(e) => mudar(chave(selecionada), { exige: e.target.value as ExigeTransicao })}>
                  {(Object.keys(EXIGE_LABEL) as ExigeTransicao[]).map((x) => (
                    <option key={x} value={x}>{EXIGE_LABEL[x]}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelCls}>Marca o resultado do edital</span>
                <select className={input} value={selecionada.resultado} onChange={(e) => mudar(chave(selecionada), { resultado: e.target.value as Resultado })}>
                  <option value="">Não mexe no resultado</option>
                  <option value="GANHAMOS">Ganhamos</option>
                  <option value="PERDEMOS">Perdemos</option>
                </select>
              </label>
              <div className="flex justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const k = chave(selecionada)
                    alterar((l) => l.filter((t) => chave(t) !== k))
                    setSel(null)
                  }}
                  className="flex items-center gap-1 rounded-lg bg-error-container/50 px-3 py-1.5 font-label-md text-label-md font-bold text-error"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span> Excluir ligação
                </button>
                <button type="button" onClick={() => setSel(null)} className={btnGhost}>
                  Ok
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
