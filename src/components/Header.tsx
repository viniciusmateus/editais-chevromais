import type { PublicUser } from '../shared'

interface Props {
  me: PublicUser
  q: string
  onQ: (v: string) => void
  hasDue: boolean
  onBell: () => void
  onProfile: () => void
  onLogout: () => void
}

export default function Header({ me, q, onQ, hasDue, onBell, onProfile, onLogout }: Props) {
  return (
    <header className="fixed left-64 right-0 top-0 z-40 flex h-16 items-center justify-between bg-surface/90 px-margin shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
      <div className="flex items-center gap-space-lg">
        <div className="relative flex w-80 items-center lg:w-96">
          <span className="material-symbols-outlined absolute left-3 text-[18px] text-outline">search</span>
          <input
            value={q}
            onChange={(e) => onQ(e.target.value)}
            className="h-9 w-full rounded-lg border-none bg-surface-container-low pl-9 pr-4 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary"
            placeholder="Buscar edital, número do pregão, UASG, portal ou órgão..."
            type="text"
          />
        </div>
        <div className="hidden items-center gap-space-md rounded-lg bg-surface-container-low px-space-md py-1 xl:flex">
          <span className="font-label-sm text-label-sm uppercase text-outline">Portais:</span>
          {['Comprasnet', 'Licitações-e', 'BLL'].map((p) => (
            <div key={p} className="flex items-center gap-space-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              <span className="font-label-sm text-label-sm">{p}</span>
            </div>
          ))}
        </div>
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
