import type { AppState, AuthStatus, EditalInput, Papel, RegrasCampos, Transicao, Unchanged } from '../shared'

export interface PortalInput {
  nome: string
  campos: RegrasCampos
}

export interface CategoriaInput {
  nome: string
  cor: string
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export interface NewUser {
  usuario: string
  nome: string
  cargo: string
  senha: string
  papel: Papel
  /** ids dos portais liberados; null = todos */
  portais: number[] | null
}

export interface UserPatch {
  nome: string
  cargo: string
  papel: Papel
  portais: number[] | null
  /** só enviar para redefinir a senha */
  senha?: string
}

/** O cookie de sessão (HttpOnly) é enviado automaticamente pelo navegador. */
async function req<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Não foi possível conectar ao servidor. Ele está ligado? (npm run dev / npm start)', 0)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(data?.error ?? `Erro ${res.status}`, res.status)
  return data as T
}

export const api = {
  // autenticação
  authStatus: () => req<AuthStatus>('/api/auth/status'),
  setup: (v: { usuario: string; senha: string; nome: string; cargo: string }) => req<AuthStatus>('/api/auth/setup', 'POST', v),
  login: (v: { usuario: string; senha: string }) => req<AuthStatus>('/api/auth/login', 'POST', v),
  logout: () => req<{ ok: true }>('/api/auth/logout', 'POST', {}),

  // estado compartilhado (toda alteração devolve o estado completo já gravado)
  state: () => req<AppState>('/api/state'),
  /** consulta barata: se nada mudou desde `since`, devolve só { unchanged: true } */
  poll: (since: number) => req<AppState | Unchanged>(`/api/state?since=${since}`),

  // perfil
  updateMe: (v: { nome: string; cargo: string }) => req<AppState>('/api/me', 'PUT', v),
  changePassword: (v: { atual: string; nova: string }) => req<{ ok: true }>('/api/me/password', 'POST', v),

  // usuários (administrador)
  createUser: (v: NewUser) => req<AppState>('/api/users', 'POST', v),
  updateUser: (id: number, v: UserPatch) => req<AppState>(`/api/users/${id}`, 'PUT', v),
  deleteUser: (id: number) => req<AppState>(`/api/users/${id}`, 'DELETE'),

  // portais e categorias (administrador)
  createPortal: (v: PortalInput) => req<AppState>('/api/portais', 'POST', v),
  updatePortal: (id: number, v: PortalInput) => req<AppState>(`/api/portais/${id}`, 'PUT', v),
  deletePortal: (id: number) => req<AppState>(`/api/portais/${id}`, 'DELETE'),
  createCategoria: (v: CategoriaInput) => req<AppState>('/api/categorias', 'POST', v),
  updateCategoria: (id: string, v: CategoriaInput) => req<AppState>(`/api/categorias/${encodeURIComponent(id)}`, 'PUT', v),
  deleteCategoria: (id: string) => req<AppState>(`/api/categorias/${encodeURIComponent(id)}`, 'DELETE'),

  reordenarCategorias: (ids: string[]) => req<AppState>('/api/categorias/ordem', 'POST', { ids }),
  reordenarStatus: (ids: string[]) => req<AppState>('/api/status/ordem', 'POST', { ids }),
  createStatus: (v: CategoriaInput) => req<AppState>('/api/status', 'POST', v),
  updateStatus: (id: string, v: CategoriaInput) => req<AppState>(`/api/status/${encodeURIComponent(id)}`, 'PUT', v),
  deleteStatus: (id: string) => req<AppState>(`/api/status/${encodeURIComponent(id)}`, 'DELETE'),

  salvarFluxo: (v: { transicoes: Transicao[]; posicoes: Record<string, { x: number; y: number }> }) => req<AppState>('/api/fluxo', 'POST', v),

  // editais
  createEdital: (e: EditalInput) => req<AppState>('/api/editais', 'POST', e),
  /** `v` = versão que o usuário estava editando; se outra pessoa já alterou, a API responde 409 */
  updateEdital: (id: number, patch: Partial<EditalInput> & { v?: number; motivo?: string; valor?: number }) => req<AppState>(`/api/editais/${id}`, 'PUT', patch),
  deleteEditais: (ids: number[]) => req<AppState>('/api/editais/delete', 'POST', { ids }),
  addRetif: (id: number, r: { desc: string; data?: string; hora?: string }) => req<AppState>(`/api/editais/${id}/retifs`, 'POST', r),
  clearAll: () => req<AppState>('/api/editais', 'DELETE'),
}
