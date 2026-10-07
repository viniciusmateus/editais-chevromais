export type Nav = 'dashboard' | 'editais' | 'RETIF' | 'novo' | 'calendario' | 'relatorio' | 'usuarios' | 'portais' | 'configuracoes' | 'perfil'

interface Props {
  nav: Nav
  counts: { all: number; retif: number }
  isAdmin: boolean
  onNav: (n: Nav) => void
}

interface Item {
  id: Nav
  icon: string
  label: string
  count?: number
  danger?: boolean
}

export default function Sidebar({ nav, counts, isAdmin, onNav }: Props) {
  const main: Item[] = [
    { id: 'dashboard', icon: 'dashboard', label: 'Visão Geral' },
    { id: 'editais', icon: 'description', label: 'Editais', count: counts.all },
    { id: 'RETIF', icon: 'published_with_changes', label: 'Retificações', count: counts.retif, danger: true },
    { id: 'novo', icon: 'post_add', label: 'Registro de Editais' },
    { id: 'calendario', icon: 'calendar_clock', label: 'Calendário & Prazos' },
    { id: 'relatorio', icon: 'query_stats', label: 'Relatórios' },
  ]

  const link = (it: Item) => {
    const active = nav === it.id
    return (
      <button
        key={it.id}
        type="button"
        onClick={() => onNav(it.id)}
        className={`flex w-full items-center justify-between rounded-lg px-space-md py-space-sm text-left transition-all ${
          active ? 'bg-primary-container font-semibold text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
        }`}
      >
        <span className="flex items-center gap-space-md">
          <span className="material-symbols-outlined text-[20px]">{it.icon}</span>
          <span className="text-body-md">{it.label}</span>
        </span>
        {it.count !== undefined && (
          <span
            className={`rounded px-space-xs py-0.5 font-label-sm text-label-sm font-semibold ${
              it.danger ? 'bg-error-container/40 font-bold text-error' : 'bg-surface-variant text-on-surface'
            }`}
          >
            {it.count}
          </span>
        )}
      </button>
    )
  }

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-64 select-none flex-col justify-between overflow-y-auto bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex flex-col">
        <div className="flex h-16 items-center gap-space-sm px-margin">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-bold text-on-primary">EC</div>
          <div className="flex flex-col">
            <span className="font-headline-sm text-headline-sm leading-none text-primary">Editais Chevomais</span>
            <span className="mt-0.5 font-label-sm text-label-sm uppercase leading-tight tracking-wider text-outline">Gestão de Editais</span>
          </div>
        </div>
        <div className="px-space-md py-space-sm">
          <div className="px-space-sm py-space-xs font-label-sm text-label-sm uppercase tracking-wider text-outline">Módulos Principais</div>
        </div>
        <nav className="flex flex-col gap-1 px-space-md">{main.map(link)}</nav>
      </div>
      <div className="flex flex-col gap-space-sm p-space-md">
        <nav className="flex flex-col gap-1">
          {isAdmin && link({ id: 'portais', icon: 'language', label: 'Portais' })}
          {isAdmin && link({ id: 'configuracoes', icon: 'settings', label: 'Configurações' })}
          {isAdmin && link({ id: 'usuarios', icon: 'group', label: 'Usuários' })}
          {link({ id: 'perfil', icon: 'manage_accounts', label: 'Meu perfil e senha' })}
        </nav>
        <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
          <span className="font-label-sm text-label-sm text-on-surface">Sincronizado em tempo real</span>
        </div>
      </div>
    </aside>
  )
}
