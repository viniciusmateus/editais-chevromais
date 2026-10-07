import { useCallback, useEffect, useState } from 'react'
import type { AuthStatus } from './shared'
import { api } from './lib/api'
import AuthScreen from './components/AuthScreens'
import Dashboard from './Dashboard'

/** Porta de entrada: decide entre "criar administrador", "login" e o painel. */
export default function App() {
  const [auth, setAuth] = useState<AuthStatus | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const check = useCallback(() => {
    setErr(null)
    api.authStatus().then(setAuth).catch((e: Error) => setErr(e.message))
  }, [])
  useEffect(check, [check])

  if (err) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-space-md p-margin text-center">
        <span className="material-symbols-outlined text-[40px] text-error">cloud_off</span>
        <p className="max-w-md text-on-surface-variant">{err}</p>
        <button type="button" onClick={check} className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!auth) return <div className="flex min-h-screen items-center justify-center text-outline">Carregando…</div>

  if (auth.needsSetup) return <AuthScreen mode="setup" sugestao={auth.sugestao} onDone={setAuth} />
  if (!auth.user) return <AuthScreen mode="login" onDone={setAuth} />

  // key = id do usuário: ao trocar de conta, o painel recomeça do zero
  return <Dashboard key={auth.user.id} onLogout={() => setAuth({ needsSetup: false, user: null })} />
}
