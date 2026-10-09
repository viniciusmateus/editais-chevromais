import { useEffect, useMemo, useRef, useState } from 'react'
import type { Edital } from '../../shared'
import { buscarEditais, confereComTexto, paresNumAno } from '../../lib/buscaEdital'
import { fmtDate } from '../../lib/utils'
import { input } from '../Modals'

const rotulo = (e: Edital) => `${e.num || `#${e.id}`}${e.orgao ? ` — ${e.orgao}` : ''}${e.uf ? ` (${e.uf})` : ''}`

interface Props {
  editais: Edital[]
  value: number | null
  onChange: (id: number | null) => void
  /** texto com o número do pregão (ex.: nome do processo): sugere os editais de mesmo número e avisa se o escolhido não confere */
  dica?: string
}

/** Escolha de edital com busca: digite número/ano (16/2026), UASG, órgão, cidade… e só aparecem os editais compatíveis. */
export default function EditalPicker({ editais, value, onChange, dica = '' }: Props) {
  const [aberto, setAberto] = useState(false)
  const [q, setQ] = useState('')
  const [ativo, setAtivo] = useState(0)
  const raiz = useRef<HTMLDivElement>(null)
  const sel = value !== null ? editais.find((e) => e.id === value) : undefined

  // sem digitar nada: se a dica traz número/ano, sugere só os editais desse número
  const consulta = useMemo(() => {
    if (q.trim()) return q
    const p = paresNumAno(dica)
    return p.length ? `${p[0].n}/${p[0].ano}` : ''
  }, [q, dica])
  const sugerindo = !q.trim() && consulta !== ''
  const lista = useMemo(() => buscarEditais(editais, consulta).slice(0, 30), [editais, consulta])

  useEffect(() => setAtivo(0), [consulta])
  useEffect(() => {
    if (!aberto) return
    const fora = (ev: MouseEvent) => !raiz.current?.contains(ev.target as Node) && setAberto(false)
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const escolher = (id: number | null) => {
    onChange(id)
    setAberto(false)
    setQ('')
  }
  const confere = sel ? confereComTexto(sel, dica) : null

  return (
    <div ref={raiz} className="relative">
      {aberto ? (
        <input
          autoFocus
          className={input}
          value={q}
          placeholder="Digite o nº (ex.: 16/2026), UASG, órgão ou cidade…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setAtivo((a) => Math.min(a + 1, lista.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setAtivo((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              if (lista[ativo]) escolher(lista[ativo].id)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setAberto(false)
            }
          }}
        />
      ) : (
        <button type="button" className={`${input} flex items-center justify-between gap-2 text-left`} onClick={() => setAberto(true)}>
          <span className={`truncate ${value === null ? 'text-outline' : ''}`}>{sel ? rotulo(sel) : value !== null ? `Edital #${value} (não encontrado)` : '— Nenhum —'}</span>
          <span className="material-symbols-outlined text-[18px] text-outline">search</span>
        </button>
      )}
      {!aberto && confere === false && (
        <p className="mt-1 flex items-center gap-1 text-[12px] text-error">
          <span className="material-symbols-outlined text-[14px]">warning</span> O número do edital não confere com o do nome do processo.
        </p>
      )}
      {aberto && (
        <div className="absolute z-30 mt-1 max-h-72 w-full min-w-[300px] overflow-auto rounded-lg border border-surface-container bg-surface-container-lowest py-1 shadow-lg">
          <button type="button" onClick={() => escolher(null)} className="block w-full px-3 py-1.5 text-left text-body-sm text-outline hover:bg-surface-container-low">
            — Nenhum —
          </button>
          {sugerindo && lista.length > 0 && <p className="px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-outline">Sugestões pelo nome do processo ({consulta})</p>}
          {lista.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onMouseEnter={() => setAtivo(i)}
              onClick={() => escolher(e.id)}
              className={`flex w-full flex-col px-3 py-1.5 text-left ${i === ativo ? 'bg-surface-container-low' : ''} ${e.id === value ? 'font-semibold' : ''}`}
            >
              <span className="truncate text-body-sm">{rotulo(e)}</span>
              <span className="truncate text-[11px] text-outline">{[e.uasg && `UASG ${e.uasg}`, e.cidade, e.portal, e.data && fmtDate(e.data)].filter(Boolean).join(' • ')}</span>
            </button>
          ))}
          {lista.length === 0 && <p className="px-3 py-2 text-body-sm text-outline">Nenhum edital compatível com “{consulta}”.</p>}
          {sugerindo && <p className="px-3 py-1 text-[11px] text-outline">Digite para buscar em todos os editais.</p>}
        </div>
      )}
    </div>
  )
}
