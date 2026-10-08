import type { StatusCfg } from '../shared'
import type { Visao } from '../lib/utils'

interface Props {
  visao: Visao
  onVisao: (v: Visao) => void
  /** contagens das visões inteligentes, já considerando categoria, período e busca */
  n: { aberto: number; hoje: number; atrasados: number; todos: number }
  statuses: StatusCfg[]
  porStatus: Record<string, number>
}

interface CardInfo {
  id: Visao
  label: string
  n: number
  cor: string
  icon?: string
}

/**
 * Faixa de cartões que divide a lista por situação: quanto ainda precisa de atenção (em aberto, hoje, sem atualização)
 * e, embaixo, uma pílula compacta por status que tem editais. Clicar mostra só aqueles editais.
 */
export default function SituacaoBar({ visao, onVisao, n, statuses, porStatus }: Props) {
  const smart: CardInfo[] = [
    { id: 'aberto', label: 'Em aberto', n: n.aberto, cor: '#0369a1', icon: 'pending_actions' },
    { id: 'hoje', label: 'Hoje', n: n.hoje, cor: '#ba1a1a', icon: 'today' },
    { id: 'atrasados', label: 'Sem atualização', n: n.atrasados, cor: '#b45309', icon: 'schedule' },
    { id: 'todos', label: 'Todos', n: n.todos, cor: '#475569', icon: 'list' },
  ]
  // só os status que têm editais (o selecionado sempre aparece)
  const porSt: CardInfo[] = statuses
    .map((s) => ({ id: `s:${s.id}` as Visao, label: s.nome, n: porStatus[s.id] ?? 0, cor: s.cor }))
    .filter((c) => c.n > 0 || c.id === visao)

  const card = (c: CardInfo) => {
    const on = visao === c.id
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => onVisao(c.id)}
        aria-pressed={on}
        title={c.id === 'atrasados' ? 'Pregões que já aconteceram e ainda estão sem atualização no fluxo' : `Mostrar: ${c.label}`}
        className={`flex min-w-[150px] flex-1 items-center gap-2.5 rounded-xl border bg-surface-container-lowest px-3 py-2 text-left transition-all hover:shadow-md ${
          on ? 'shadow-md' : 'border-transparent'
        }`}
        style={on ? { borderColor: c.cor, background: `${c.cor}12` } : undefined}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${c.cor}1f`, color: c.cor }}>
          <span className="material-symbols-outlined text-[20px]">{c.icon}</span>
        </span>
        <span className="min-w-0">
          <span className="block font-headline-sm text-[20px] font-bold leading-none" style={{ color: on ? c.cor : undefined }}>
            {c.n}
          </span>
          <span className="mt-0.5 block whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">{c.label}</span>
        </span>
      </button>
    )
  }

  /** Pílula pequena de um status: ponto colorido, nome e quantidade, tudo numa linha. */
  const pilula = (c: CardInfo) => {
    const on = visao === c.id
    return (
      <button
        key={c.id}
        type="button"
        onClick={() => onVisao(on ? 'todos' : c.id)}
        aria-pressed={on}
        title={on ? 'Clique para voltar a ver todos' : `Mostrar só: ${c.label}`}
        className={`flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-semibold transition-colors ${
          on ? 'text-white' : 'border-surface-container bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low'
        }`}
        style={on ? { background: c.cor, borderColor: c.cor } : undefined}
      >
        <span className="h-2 w-2 rounded-full" style={{ background: on ? '#fff' : c.cor }} />
        {c.label}
        <span className={`rounded-full px-1.5 text-[11px] font-bold ${on ? 'bg-white/25' : 'bg-surface-container text-on-surface'}`}>{c.n}</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-space-xs">
      <div className="flex flex-wrap gap-space-sm">{smart.map(card)}</div>
      {porSt.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-label-sm text-label-sm uppercase tracking-wider text-outline">Por status</span>
          {porSt.map(pilula)}
        </div>
      )}
    </div>
  )
}
