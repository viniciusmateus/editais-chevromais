import type { AppState, AuthStatus, CampoBase, EditalInput, Papel, PrecifCatalogo, PrecifProcesso, PrecifProcessoInput, PrecifProcessoResumo, RegrasCampos, Transicao, Unchanged } from '../shared'

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
  /** id do perfil de permissões (ignorado para administradores) */
  perfil: number | null
}

export interface PerfilInput {
  nome: string
  excluir: boolean
  campos: CampoBase[]
}

export interface UserPatch {
  nome: string
  cargo: string
  papel: Papel
  portais: number[] | null
  perfil: number | null
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

  createPerfil: (v: PerfilInput) => req<AppState>('/api/perfis', 'POST', v),
  updatePerfil: (id: number, v: PerfilInput) => req<AppState>(`/api/perfis/${id}`, 'PUT', v),
  deletePerfil: (id: number) => req<AppState>(`/api/perfis/${id}`, 'DELETE'),
  createEmpresa: (v: CategoriaInput) => req<AppState>('/api/empresas', 'POST', v),
  updateEmpresa: (id: string, v: CategoriaInput) => req<AppState>(`/api/empresas/${encodeURIComponent(id)}`, 'PUT', v),
  deleteEmpresa: (id: string) => req<AppState>(`/api/empresas/${encodeURIComponent(id)}`, 'DELETE'),
  reordenarEmpresas: (ids: string[]) => req<AppState>('/api/empresas/ordem', 'POST', { ids }),
  createImpugnacao: (v: CategoriaInput) => req<AppState>('/api/impugnacoes', 'POST', v),
  updateImpugnacao: (id: string, v: CategoriaInput) => req<AppState>(`/api/impugnacoes/${encodeURIComponent(id)}`, 'PUT', v),
  deleteImpugnacao: (id: string) => req<AppState>(`/api/impugnacoes/${encodeURIComponent(id)}`, 'DELETE'),
  reordenarImpugnacoes: (ids: string[]) => req<AppState>('/api/impugnacoes/ordem', 'POST', { ids }),
  createImpugStatus: (v: CategoriaInput) => req<AppState>('/api/impug-status', 'POST', v),
  updateImpugStatus: (id: string, v: CategoriaInput) => req<AppState>(`/api/impug-status/${encodeURIComponent(id)}`, 'PUT', v),
  deleteImpugStatus: (id: string) => req<AppState>(`/api/impug-status/${encodeURIComponent(id)}`, 'DELETE'),
  reordenarImpugStatus: (ids: string[]) => req<AppState>('/api/impug-status/ordem', 'POST', { ids }),
  salvarFluxo: (v: { transicoes: Transicao[]; posicoes: Record<string, { x: number; y: number }> }) => req<AppState>('/api/fluxo', 'POST', v),

  // editais
  createEdital: (e: EditalInput) => req<AppState>('/api/editais', 'POST', e),
  /** `v` = versão que o usuário estava editando; se outra pessoa já alterou, a API responde 409 */
  updateEdital: (id: number, patch: Partial<EditalInput> & { v?: number; motivo?: string; valor?: number; impugRespostas?: Record<string, string> }) => req<AppState>(`/api/editais/${id}`, 'PUT', patch),
  deleteEditais: (ids: number[]) => req<AppState>('/api/editais/delete', 'POST', { ids }),
  addRetif: (id: number, r: { desc: string; data?: string; hora?: string }) => req<AppState>(`/api/editais/${id}/retifs`, 'POST', r),
  clearAll: () => req<AppState>('/api/editais', 'DELETE'),

  // precificador (dados em tabelas próprias; não entram na sincronização do estado)
  precifCatalogo: () => req<PrecifCatalogo>('/api/precificador/catalogo'),
  precifImportarCatalogo: (linhas: Array<{ marca: string; modelo: string }>) =>
    req<{ catalogo: PrecifCatalogo; marcasCriadas: number; modelosCriados: number; ignorados: number }>('/api/precificador/catalogo/importar', 'POST', { linhas }),
  precifCriarMarca: (nome: string) => req<PrecifCatalogo>('/api/precificador/marcas', 'POST', { nome }),
  precifEditarMarca: (id: number, nome: string) => req<PrecifCatalogo>(`/api/precificador/marcas/${id}`, 'PUT', { nome }),
  precifExcluirMarca: (id: number) => req<PrecifCatalogo>(`/api/precificador/marcas/${id}`, 'DELETE'),
  precifCriarModelo: (marcaId: number, nome: string) => req<PrecifCatalogo>('/api/precificador/modelos', 'POST', { marcaId, nome }),
  precifEditarModelo: (id: number, nome: string) => req<PrecifCatalogo>(`/api/precificador/modelos/${id}`, 'PUT', { nome }),
  precifExcluirModelo: (id: number) => req<PrecifCatalogo>(`/api/precificador/modelos/${id}`, 'DELETE'),
  precifProcessos: () => req<PrecifProcessoResumo[]>('/api/precificador/processos'),
  precifProcesso: (id: number) => req<PrecifProcesso>(`/api/precificador/processos/${id}`),
  precifCriarProcesso: (v: PrecifProcessoInput) => req<PrecifProcesso>('/api/precificador/processos', 'POST', v),
  /** `v` = versão que a tela estava editando; se outra pessoa gravou antes, a API responde 409 */
  precifSalvarProcesso: (id: number, v: PrecifProcessoInput & { v: number }) => req<PrecifProcesso>(`/api/precificador/processos/${id}`, 'PUT', v),
  precifExcluirProcesso: (id: number) => req<{ ok: true }>(`/api/precificador/processos/${id}`, 'DELETE'),
  precifRegistrarUso: (id: number) => req<PrecifCatalogo>(`/api/precificador/processos/${id}/registrar-uso`, 'POST', {}),
}
