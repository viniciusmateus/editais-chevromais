import type { AppState, EditalInput, Settings } from '../shared'

/** Toda chamada devolve o estado completo ({ settings, editais }) já gravado no db.json. */
async function req(url: string, method = 'GET', body?: unknown): Promise<AppState> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Não foi possível conectar à API. O servidor está rodando? (npm run dev)')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Erro ${res.status}`)
  return data as AppState
}

export const api = {
  state: () => req('/api/state'),
  saveSettings: (s: Settings) => req('/api/settings', 'PUT', s),
  createEdital: (e: EditalInput) => req('/api/editais', 'POST', e),
  updateEdital: (id: number, patch: Partial<EditalInput>) => req(`/api/editais/${id}`, 'PUT', patch),
  addRetif: (id: number, r: { desc: string; data?: string; hora?: string }) => req(`/api/editais/${id}/retifs`, 'POST', r),
}
