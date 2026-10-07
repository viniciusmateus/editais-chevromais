import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RESULTADOS, type AppState, type PublicUser, type StatusKey } from './shared'
import { api, ApiError } from './lib/api'
import { exportCsv, inPeriod, todayIso, type Periodo } from './lib/utils'
import Sidebar, { type Nav } from './components/Sidebar'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import Kpis from './components/Kpis'
import RegionPanel from './components/RegionPanel'
import RetifPanel from './components/RetifPanel'
import EditalTable, { type Tab } from './components/EditalTable'
import { EditalModal, HistModal, ProfileModal, ReportModal, RetifModal, UsersModal } from './components/Modals'

type ModalState =
  | { type: 'edital'; id?: number; v?: number }
  | { type: 'retif'; id?: number }
  | { type: 'hist'; id: number }
  | { type: 'report' }
  | { type: 'profile' }
  | { type: 'users' }
  | null

const POLL_MS = 4000

/** Painel principal. Todos os usuários logados enxergam e alteram os mesmos dados (guardados no servidor). */
export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [state, setState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [online, setOnline] = useState(true)

  const [nav, setNav] = useState<Nav>('dashboard')
  const [tab, setTab] = useState<Tab>('ALL')
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('ALL')
  const [fPer, setFPer] = useState<Periodo>('all')
  const [fStatus, setFStatus] = useState('ALL')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  // referências para o laço de sincronização não depender de renderizações
  const revRef = useRef(-1)
  const logoutRef = useRef(onLogout)
  logoutRef.current = onLogout
  useEffect(() => {
    if (state) revRef.current = state.rev
  }, [state])

  const notify = useCallback((msg: string, error = false) => setToast({ msg, error }), [])
  const closeModal = useCallback(() => setModal(null), [])

  const load = useCallback(() => {
    setLoadError(null)
    api
      .state()
      .then(setState)
      .catch((e: Error) => {
        if (e instanceof ApiError && e.status === 401) logoutRef.current()
        else setLoadError(e.message)
      })
  }, [])
  useEffect(load, [load])

  // Sincronização: pergunta ao servidor a cada poucos segundos se alguém alterou algo.
  // A consulta é barata (só devolve { unchanged: true } quando nada mudou).
  useEffect(() => {
    let stop = false
    const tick = async () => {
      if (document.hidden) return
      try {
        const r = await api.poll(revRef.current)
        if (stop) return
        setOnline(true)
        if (!('unchanged' in r)) setState(r)
      } catch (e) {
        if (stop) return
        if (e instanceof ApiError && e.status === 401) logoutRef.current()
        else setOnline(false)
      }
    }
    const id = setInterval(tick, POLL_MS)
    const wake = () => {
      if (!document.hidden) void tick()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('focus', wake)
    return () => {
      stop = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('focus', wake)
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => setPage(1), [tab, fCat, fPer, fStatus, q])

  // se outra pessoa excluir o edital que está aberto num modal, fecha o modal
  useEffect(() => {
    if (!state || !modal) return
    const id = modal.type === 'edital' || modal.type === 'retif' || modal.type === 'hist' ? modal.id : undefined
    if (id !== undefined && !state.editais.some((x) => x.id === id)) {
      setModal(null)
      notify('Este edital foi excluído por outro usuário.', true)
    }
  }, [state, modal, notify])

  /** Executa uma chamada à API, mostra o estado gravado no servidor e avisa o resultado. */
  const act = async (fn: () => Promise<AppState>, ok?: string): Promise<boolean> => {
    try {
      setState(await fn())
      if (ok) notify(ok)
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        logoutRef.current()
        return false
      }
      notify(e instanceof Error ? e.message : 'Erro inesperado', true)
      if (e instanceof ApiError && e.status === 409) {
        // alguém alterou o mesmo edital: atualiza a tela e passa a editar sobre a versão nova
        try {
          const fresh = await api.state()
          setState(fresh)
          setModal((m) => {
            if (m?.type === 'edital' && m.id !== undefined) {
              const cur = fresh.editais.find((x) => x.id === m.id)
              if (cur) return { ...m, v: cur.v }
            }
            return m
          })
        } catch {
          /* a sincronização automática tenta de novo */
        }
      }
      return false
    }
  }

  const editais = useMemo(() => state?.editais ?? [], [state])

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim()
    return editais
      .filter((x) => {
        if (tab === 'TINTAS' && x.cat !== 'TINTAS') return false
        if (tab === 'PNEUS' && x.cat !== 'PNEUS') return false
        if (tab === 'RETIF' && x.retifs.length === 0) return false
        if (fCat !== 'ALL' && x.cat !== fCat) return false
        if (fStatus !== 'ALL' && x.status !== fStatus) return false
        if (!inPeriod(x, fPer)) return false
        if (needle && ![x.num, x.orgao, x.objeto, x.uasg, x.uf, x.portal].some((v) => v.toLowerCase().includes(needle))) return false
        return true
      })
      .sort((a, b) => {
        const A = a.data || '9999-12-31'
        const B = b.data || '9999-12-31'
        return sortAsc ? A.localeCompare(B) : B.localeCompare(A)
      })
  }, [editais, tab, fCat, fPer, fStatus, q, sortAsc])

  const counts = useMemo(
    () => ({
      all: editais.length,
      tintas: editais.filter((x) => x.cat === 'TINTAS').length,
      pneus: editais.filter((x) => x.cat === 'PNEUS').length,
      retif: editais.filter((x) => x.retifs.length > 0).length,
    }),
    [editais],
  )

  const scrollToTable = () => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const onNav = (n: Nav) => {
    if (n === 'novo') return setModal({ type: 'edital' })
    if (n === 'relatorio') return setModal({ type: 'report' })
    if (n === 'config') return setModal({ type: 'profile' })
    if (n === 'usuarios') return setModal({ type: 'users' })
    setNav(n)
    if (n === 'calendario') {
      setTab('ALL')
      setSortAsc(true)
      setFPer('7days')
      notify('Mostrando prazos dos próximos 7 dias.')
    } else {
      setTab(n === 'dashboard' ? 'ALL' : n)
    }
    scrollToTable()
  }

  const onTab = (t: Tab) => {
    setTab(t)
    setNav(t === 'ALL' ? 'dashboard' : t)
  }

  const clearFilters = () => {
    setQ('')
    setFCat('ALL')
    setFPer('all')
    setFStatus('ALL')
    setTab('ALL')
    setNav('dashboard')
  }

  const onBell = () => {
    const due = editais.filter((x) => x.data === todayIso())
    notify(due.length ? `${due.length} prazo(s) vencem hoje: ${due.map((x) => x.num).join(', ')}` : 'Sem prazos vencendo hoje.')
  }

  const toggle = (ids: number[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (checked ? next.add(id) : next.delete(id)))
      return next
    })

  const deleteIds = async (ids: number[], okMsg: string) => {
    if (await act(() => api.deleteEditais(ids), okMsg)) {
      setSelected((prev) => new Set([...prev].filter((id) => !ids.includes(id))))
    }
  }

  const logout = async () => {
    await api.logout().catch(() => {})
    onLogout()
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-space-md p-margin text-center">
        <span className="material-symbols-outlined text-[40px] text-error">cloud_off</span>
        <p className="max-w-md text-on-surface-variant">{loadError}</p>
        <button type="button" onClick={load} className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary hover:bg-primary-hover">
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!state) return <div className="flex min-h-screen items-center justify-center text-outline">Carregando…</div>

  const me = state.me
  const isAdmin = me.papel === 'admin'
  const selectedEditais = editais.filter((x) => selected.has(x.id))
  const modalId = modal && 'id' in modal ? modal.id : undefined
  const modalEdital = modalId !== undefined ? editais.find((x) => x.id === modalId) : undefined

  return (
    <>
      <Sidebar nav={nav} counts={counts} isAdmin={isAdmin} onNav={onNav} />

      <div className="pl-64">
        <Header
          me={me}
          q={q}
          onQ={setQ}
          hasDue={editais.some((x) => x.data === todayIso())}
          onBell={onBell}
          onProfile={() => setModal({ type: 'profile' })}
          onLogout={logout}
        />

        <main className="relative min-h-screen w-full bg-surface px-gutter pt-16">
          {!online && (
            <div className="mt-space-sm rounded-lg bg-[#fff7ed] px-space-md py-space-sm text-body-sm font-medium text-[#9a3412]">
              Sem conexão com o servidor — tentando reconectar. O que você vê pode estar desatualizado.
            </div>
          )}
          <div className="flex w-full flex-col gap-space-lg pb-12 pt-space-lg">
            {/* Topo */}
            <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:flex-row xl:items-center">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-space-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Central Integrada de Monitoramento</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-on-surface">Central de Registro e Acompanhamento de Editais</h1>
                <p className="max-w-2xl text-body-md text-on-surface-variant">
                  Acompanhamento unificado de editais de Tintas e Pneus, controle de alterações, aditivos técnicos e prazos de envio.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-space-sm">
                <button
                  type="button"
                  onClick={() => (filtered.length ? exportCsv(filtered) : notify('Nada para exportar.', true))}
                  className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span> Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={() => (editais.length ? setModal({ type: 'retif' }) : notify('Cadastre um edital primeiro.', true))}
                  className="flex items-center gap-space-xs rounded-lg bg-error-container/50 px-space-md py-2 font-label-md text-label-md font-bold text-error shadow-sm transition-colors hover:bg-error-container"
                >
                  <span className="material-symbols-outlined text-[18px]">published_with_changes</span> + Registrar Retificação
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'edital' })}
                  className="flex items-center gap-space-xs rounded-lg bg-primary px-space-md py-2 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-hover"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span> Novo Edital / Registro
                </button>
              </div>
            </div>

            <FilterBar
              editais={editais}
              q={q}
              onQ={setQ}
              cat={fCat}
              onCat={setFCat}
              per={fPer}
              onPer={setFPer}
              status={fStatus}
              onStatus={setFStatus}
              onClear={clearFilters}
            />

            <Kpis editais={editais} />

            <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
              <RegionPanel editais={editais} />
              <RetifPanel
                editais={editais}
                onNew={() => (editais.length ? setModal({ type: 'retif' }) : notify('Cadastre um edital primeiro.', true))}
                onHist={(id) => setModal({ type: 'hist', id })}
              />
            </div>

            <div ref={tableRef}>
              <EditalTable
                list={filtered}
                total={editais.length}
                counts={counts}
                tab={tab}
                onTab={onTab}
                page={page}
                onPage={setPage}
                sortAsc={sortAsc}
                onSort={() => setSortAsc((v) => !v)}
                selected={selected}
                onToggle={toggle}
                onStatus={(id, status: StatusKey) => void act(() => api.updateEdital(id, { status }), 'Status atualizado.')}
                onResultado={(id, resultado) => void act(() => api.updateEdital(id, { resultado }), resultado ? `Marcado como ${RESULTADOS[resultado]}.` : 'Resultado removido.')}
                onRetif={(id) => setModal({ type: 'retif', id })}
                onHist={(id) => setModal({ type: 'hist', id })}
                onEdit={(id) => setModal({ type: 'edital', id, v: editais.find((x) => x.id === id)?.v })}
                onDelete={(id) => {
                  if (confirm('Excluir este edital? Ele some para todos os usuários.')) void deleteIds([id], 'Edital excluído.')
                }}
                onExportSel={() => (selectedEditais.length ? exportCsv(selectedEditais) : notify('Nenhum edital marcado.', true))}
                onDeleteSel={() => {
                  if (!selected.size) return notify('Nenhum edital marcado.', true)
                  if (confirm(`Excluir ${selected.size} edital(is) marcado(s)? Eles somem para todos os usuários.`)) void deleteIds([...selected], 'Editais excluídos.')
                }}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-space-md py-space-sm font-label-sm text-label-sm text-outline">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                <span>Editais Chevomais • dados compartilhados e gravados no servidor</span>
              </div>
              <span>{editais.length} edital(is) no banco</span>
            </div>
          </div>
        </main>
      </div>

      {modal?.type === 'edital' && (modal.id === undefined || modalEdital) && (
        <EditalModal
          key={modal.id ?? 'novo'}
          initial={modalEdital}
          onClose={closeModal}
          onSave={(v) =>
            act(
              () => (modalEdital ? api.updateEdital(modalEdital.id, { ...v, v: modal.v }) : api.createEdital(v)),
              modalEdital ? 'Edital atualizado.' : 'Edital registrado.',
            )
          }
        />
      )}
      {modal?.type === 'retif' && editais.length > 0 && (
        <RetifModal
          editais={editais}
          initialId={modal.id}
          onClose={closeModal}
          onSave={(id, v) => act(() => api.addRetif(id, v), 'Retificação registrada.')}
        />
      )}
      {modal?.type === 'hist' && modalEdital && <HistModal edital={modalEdital} onClose={closeModal} />}
      {modal?.type === 'report' && (
        <ReportModal
          editais={editais}
          onClose={closeModal}
          onExport={() => (editais.length ? exportCsv(editais) : notify('Nada para exportar.', true))}
        />
      )}
      {modal?.type === 'profile' && (
        <ProfileModal
          me={me}
          onClose={closeModal}
          onSaveProfile={(v) => act(() => api.updateMe(v), 'Perfil salvo.')}
          onChangePassword={async (v) => {
            try {
              await api.changePassword(v)
              notify('Senha alterada.')
              return true
            } catch (e) {
              notify(e instanceof Error ? e.message : 'Erro ao alterar a senha', true)
              return false
            }
          }}
          onUsers={() => setModal({ type: 'users' })}
          onLogout={logout}
          onClearAll={() => {
            if (!confirm('Apagar TODOS os editais e retificações de TODOS os usuários? Esta ação não pode ser desfeita.')) return
            void act(() => api.clearAll(), 'Todos os editais foram apagados.').then((ok) => {
              if (ok) {
                setSelected(new Set())
                closeModal()
              }
            })
          }}
        />
      )}
      {modal?.type === 'users' && isAdmin && (
        <UsersModal
          me={me}
          users={state.users}
          onClose={closeModal}
          onCreate={(v) => act(() => api.createUser(v), 'Usuário criado.')}
          onUpdate={(id, v) => act(() => api.updateUser(id, v), 'Usuário atualizado.')}
          onDelete={(u: PublicUser) => {
            if (confirm(`Excluir o usuário ${u.nome} (@${u.usuario})? Ele perde o acesso na hora. Os editais que ele cadastrou continuam.`)) {
              void act(() => api.deleteUser(u.id), 'Usuário excluído.')
            }
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[110] max-w-md rounded-lg px-4 py-3 font-label-md text-label-md shadow-lg ${
            toast.error ? 'bg-error text-on-error' : 'bg-on-surface text-surface-container-lowest'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </>
  )
}
