import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppState, EditalInput, StatusKey } from './shared'
import { api } from './lib/api'
import { exportPdf, inPeriod, todayIso, type Periodo } from './lib/utils'
import Sidebar, { type Nav } from './components/Sidebar'
import Header from './components/Header'
import FilterBar from './components/FilterBar'
import Kpis from './components/Kpis'
import RegionPanel from './components/RegionPanel'
import RetifPanel from './components/RetifPanel'
import EditalTable, { type Tab } from './components/EditalTable'
import { EditalModal, HistModal, ReportModal, RetifModal, SettingsModal } from './components/Modals'

type ModalState =
  | { type: 'edital'; id?: number }
  | { type: 'retif'; id?: number }
  | { type: 'hist'; id: number }
  | { type: 'report' }
  | { type: 'settings' }
  | null

export default function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [nav, setNav] = useState<Nav>('dashboard')
  const [tab, setTab] = useState<Tab>('ALL')
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('ALL')
  const [fPer, setFPer] = useState<Periodo>('all')
  const [fStatus, setFStatus] = useState('ALL')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<{ msg: string; error: boolean } | null>(null)
  const tableRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => {
    setLoadError(null)
    api.state().then(setState).catch((e: Error) => setLoadError(e.message))
  }, [])
  useEffect(load, [load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => setPage(1), [tab, fCat, fPer, fStatus, q])

  const notify = (msg: string, error = false) => setToast({ msg, error })
  const closeModal = useCallback(() => setModal(null), [])

  /** Executa uma chamada à API, atualiza a tela com o estado gravado e avisa o resultado. */
  const act = async (fn: () => Promise<AppState>, ok?: string): Promise<boolean> => {
    try {
      setState(await fn())
      if (ok) notify(ok)
      return true
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Erro inesperado', true)
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
        if (needle && ![x.num, x.orgao, x.objeto, x.uasg, x.uf].some((v) => v.toLowerCase().includes(needle))) return false
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

  const exportar = (list: typeof editais) => {
    if (!list.length) return notify('Nada para exportar.', true)
    if (!exportPdf(list)) notify('O navegador bloqueou a janela do PDF. Permita pop-ups para este site.', true)
  }

  const scrollToTable = () => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const onNav = (n: Nav) => {
    if (n === 'novo') return setModal({ type: 'edital' })
    if (n === 'relatorio') return setModal({ type: 'report' })
    if (n === 'config') return setModal({ type: 'settings' })
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

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-space-md p-margin text-center">
        <span className="material-symbols-outlined text-[40px] text-error">cloud_off</span>
        <p className="max-w-md text-on-surface-variant">{loadError}</p>
        <button type="button" onClick={load} className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          Tentar novamente
        </button>
      </div>
    )
  }
  if (!state) {
    return <div className="flex min-h-screen items-center justify-center text-outline">Carregando…</div>
  }

  const modalEdital = modal && 'id' in modal && modal.id !== undefined ? editais.find((x) => x.id === modal.id) : undefined

  return (
    <>
      <Sidebar nav={nav} counts={counts} onNav={onNav} />

      <div className="pl-64">
        <Header
          settings={state.settings}
          hasDue={editais.some((x) => x.data === todayIso())}
          onBell={onBell}
          onSettings={() => setModal({ type: 'settings' })}
        />

        <main className="relative min-h-screen w-full bg-surface px-gutter pt-16">
          <div className="flex w-full flex-col gap-space-lg pb-12 pt-space-lg">
            {/* Topo */}
            <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:flex-row xl:items-center">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-space-sm">
                  <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
                  <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Central Integrada de Monitoramento</span>
                </div>
                <h1 className="font-headline-lg text-headline-lg text-primary">Central de Registro e Acompanhamento de Editais</h1>
                <p className="max-w-2xl text-body-md text-on-surface-variant">
                  Acompanhamento unificado de editais de Tintas e Pneus, controle de alterações, aditivos técnicos e prazos de envio.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-space-sm">
                <button
                  type="button"
                  onClick={() => exportar(filtered)}
                  className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-2 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container"
                >
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span> Exportar em PDF
                </button>
                <button
                  type="button"
                  onClick={() => (editais.length ? setModal({ type: 'retif' }) : notify('Cadastre um edital primeiro.', true))}
                  className="flex items-center gap-space-xs rounded-lg bg-error-container/30 px-space-md py-2 font-label-md text-label-md font-bold text-error shadow-sm transition-colors hover:bg-error-container/50"
                >
                  <span className="material-symbols-outlined text-[18px]">published_with_changes</span> + Registrar Retificação
                </button>
                <button
                  type="button"
                  onClick={() => setModal({ type: 'edital' })}
                  className="flex items-center gap-space-xs rounded-lg bg-primary px-space-md py-2 font-label-md text-label-md text-on-primary shadow-sm transition-colors hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span> Novo Edital / Registro
                </button>
              </div>
            </div>

            <FilterBar
              editais={editais}
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
                q={q}
                onQ={setQ}
                onStatus={(id, status: StatusKey) => void act(() => api.updateEdital(id, { status }), 'Status atualizado.')}
                onRetif={(id) => setModal({ type: 'retif', id })}
                onHist={(id) => setModal({ type: 'hist', id })}
                onEdit={(id) => setModal({ type: 'edital', id })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-space-md py-space-sm font-label-sm text-label-sm text-outline">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-secondary">verified</span>
                <span>Editais Chevomais • dados gravados em data/db.json</span>
              </div>
              <span>{editais.length} edital(is) no banco</span>
            </div>
          </div>
        </main>
      </div>

      {modal?.type === 'edital' && (
        <EditalModal
          initial={modalEdital}
          audit={modalEdital ? state.audit.filter((a) => a.editalId === modalEdital.id) : []}
          usuario={state.settings.nome}
          onClose={closeModal}
          onSave={(v: EditalInput) =>
            act(() => (modalEdital ? api.updateEdital(modalEdital.id, v) : api.createEdital(v)), modalEdital ? 'Edital atualizado.' : 'Edital registrado.')
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
          onExport={() => exportar(editais)}
        />
      )}
      {modal?.type === 'settings' && (
        <SettingsModal
          settings={state.settings}
          onClose={closeModal}
          onSave={(s) => act(() => api.saveSettings(s), 'Configurações salvas.')}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[110] rounded-lg px-4 py-3 font-label-md text-label-md shadow-lg ${
            toast.error ? 'bg-error text-on-error' : 'bg-primary text-on-primary'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </>
  )
}
