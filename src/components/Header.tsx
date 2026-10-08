import { useEffect, useMemo, useRef, useState } from 'react'
import type { Edital, PublicUser } from '../shared'
import { compararDataHora, fmtDate } from '../lib/utils'

interface Props {
  me: PublicUser
  editais: Edital[]
  /** abre o edital escolhido na busca (modal de edição) */
  onOpen: (id: number) => void
  hasDue: boolean
  onBell: () => void
  onProfile: () => void
  onLogout: () => void
}

const MAX = 8

/** Busca rápida do topo: lista os resultados num menu suspenso; clicar (ou Enter) abre o edital para edição. */
function BuscaRapida({ editais, onOpen }: { editais: Edital[]; onOpen: (id: number) => void }) {
  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const [sel, setSel] = useState(0)
  const caixa = useRef<HTMLDivElement>(null)

  const achados = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    return editais.filter((x) => [x.num, x.orgao, x.uasg, x.cidade, x.uf, x.portal].some((v) => v.toLowerCase().includes(n))).sort(compararDataHora)
  }, [q, editais])
  const lista = achados.slice(0, MAX)

  // clicar fora fecha o menu
  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const abrir = (id: number) => {
    setAberto(false)
    setQ('')
    onOpen(id)
  }

  const teclas = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setSel((i) => Math.min(i + 1, lista.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (lista[sel]) abrir(lista[sel].id)
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  return (
    <div ref={caixa} className="relative flex w-80 items-center lg:w-96">
      <span className="material-symbols-outlined pointer-events-none absolute left-3 text-[18px] text-outline">search</span>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setSel(0)
          setAberto(true)
        }}
        onFocus={() => setAberto(true)}
        onKeyDown={teclas}
        role="combobox"
        aria-expanded={aberto && q.trim() !== ''}
        aria-autocomplete="list"
        className="h-9 w-full rounded-lg border-none bg-surface-container-low pl-9 pr-4 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary"
        placeholder="Abrir edital: nº, UASG, órgão, portal…"
        type="text"
      />
      {aberto && q.trim() !== '' && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl bg-surface-container-lowest shadow-xl ring-1 ring-black/10">
          {lista.length === 0 ? (
            <div className="px-4 py-3 text-body-sm text-outline">Nenhum edital encontrado.</div>
          ) : (
            <ul role="listbox" className="max-h-[420px] overflow-y-auto py-1">
              {lista.map((x, i) => (
                <li key={x.id} role="option" aria-selected={i === sel}>
                  <button
                    type="button"
                    onMouseEnter={() => setSel(i)}
                    onClick={() => abrir(x.id)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left ${i === sel ? 'bg-primary/10' : ''}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-label-md text-label-md font-bold text-primary">{x.num || `Edital #${x.id}`}</span>
                      <span className="block truncate text-[12px] text-on-surface-variant">
                        {x.orgao || '—'}
                        {x.uf ? ` • ${x.uf}` : ''}
                        {x.portal ? ` • ${x.portal}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 font-data-mono text-[11px] text-outline">{x.data ? `${x.hora ? x.hora + ' ' : ''}${fmtDate(x.data)}` : 'A definir'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {achados.length > MAX && <div className="border-t border-surface-container px-4 py-1.5 text-[11px] text-outline">Mostrando {MAX} de {achados.length}. Refine a busca.</div>}
          {lista.length > 0 && <div className="border-t border-surface-container px-4 py-1.5 text-[11px] text-outline">↑ ↓ para navegar • Enter abre • Esc fecha</div>}
        </div>
      )}
    </div>
  )
}

export default function Header({ me, editais, onOpen, hasDue, onBell, onProfile, onLogout }: Props) {
  return (
    <header className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between bg-surface/90 px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex items-center gap-space-lg">
        <BuscaRapida editais={editais} onOpen={onOpen} />
      </div>

      <div className="flex items-center gap-space-md">
        <button
          type="button"
          onClick={onBell}
          title="Alertas de prazos"
          className="relative rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          {hasDue && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error" />}
        </button>
        <div className="h-6 w-px bg-outline-variant/40" />
        <button
          type="button"
          onClick={onProfile}
          title="Meu perfil e senha"
          className="flex items-center gap-space-md rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-container-high"
        >
          <div className="hidden flex-col text-right sm:flex">
            <span className="font-label-md text-label-md font-semibold leading-tight">{me.nome}</span>
            <span className="font-label-sm text-label-sm leading-tight text-outline">
              {me.cargo || (me.papel === 'admin' ? 'Administrador' : 'Usuário')}
            </span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <span className="material-symbols-outlined text-[18px] text-on-primary">person</span>
          </div>
        </button>
        <button
          type="button"
          onClick={onLogout}
          title="Sair"
          className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-error"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
        </button>
      </div>
    </header>
  )
}
