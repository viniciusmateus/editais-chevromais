import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  MODALIDADES,
  STATUS,
  STATUS_KEYS,
  type AuditLog,
  type Categoria,
  type Edital,
  type EditalInput,
  type Modalidade,
  type Settings,
  type StatusKey,
} from '../shared'
import { brl } from '../lib/utils'

const input =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary'
const labelCls = 'font-label-sm text-label-sm text-outline uppercase tracking-wider'

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  )
}

export function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-surface-container-lowest p-space-lg shadow-xl">
        <div className="mb-space-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">{icon}</span>
            <h2 className="font-headline-sm text-headline-sm text-primary">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Actions({ onClose, busy, submit, danger }: { onClose: () => void; busy: boolean; submit: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-space-sm pt-space-sm">
      <button type="button" onClick={onClose} className="rounded-lg bg-surface-container-low px-4 py-2 font-label-md text-label-md text-primary">
        Cancelar
      </button>
      <button
        type="submit"
        disabled={busy}
        className={`rounded-lg px-4 py-2 font-label-md text-label-md disabled:opacity-60 ${danger ? 'bg-error text-on-error' : 'bg-primary text-on-primary'}`}
      >
        {busy ? 'Salvando…' : submit}
      </button>
    </div>
  )
}

// ---------- Novo / editar edital ----------
export function EditalModal({
  initial,
  audit,
  usuario,
  onSave,
  onClose,
}: {
  initial?: Edital
  audit: AuditLog[]
  usuario: string
  onSave: (v: EditalInput) => Promise<boolean>
  onClose: () => void
}) {
  const [f, setF] = useState({
    cat: (initial?.cat ?? 'TINTAS') as Categoria,
    mod: (initial?.mod ?? 0) as Modalidade,
    num: initial?.num ?? '',
    uasg: initial?.uasg ?? '',
    orgao: initial?.orgao ?? '',
    uf: initial?.uf ?? '',
    objeto: initial?.objeto ?? '',
    valor: initial?.valor ? String(initial.valor) : '',
    data: initial?.data ?? '',
    hora: initial?.hora ?? '',
    status: (initial?.status ?? 'PREP') as StatusKey,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSave({ ...f, valor: Number(f.valor) || 0, uf: f.uf.toUpperCase() })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title={initial ? 'Editar Edital' : 'Novo Edital / Registro'} icon="post_add" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-space-md">
        <Field label="Categoria">
          <select className={input} value={f.cat} onChange={(e) => set('cat', e.target.value as Categoria)}>
            <option value="TINTAS">Tintas</option>
            <option value="PNEUS">Pneus</option>
          </select>
        </Field>
        <Field label="Modalidade">
          <select className={input} value={f.mod} onChange={(e) => set('mod', Number(e.target.value) as Modalidade)}>
            {MODALIDADES.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </Field>
        <Field label="Nº do Edital">
          <input required className={input} placeholder="PE 001/2026" value={f.num} onChange={(e) => set('num', e.target.value)} />
        </Field>
        <Field label="UASG / Portal">
          <input required className={input} placeholder="UASG 158123" value={f.uasg} onChange={(e) => set('uasg', e.target.value)} />
        </Field>
        <Field label="Órgão Comprador" className="col-span-2">
          <input required className={input} value={f.orgao} onChange={(e) => set('orgao', e.target.value)} />
        </Field>
        <Field label="UF">
          <input required maxLength={2} className={`${input} uppercase`} placeholder="PR" value={f.uf} onChange={(e) => set('uf', e.target.value)} />
        </Field>
        <Field label="Valor estimado (R$)">
          <input type="number" min={0} step={1000} className={input} value={f.valor} onChange={(e) => set('valor', e.target.value)} />
        </Field>
        <Field label="Objeto" className="col-span-2">
          <textarea required rows={3} className={`${input} h-auto py-2`} value={f.objeto} onChange={(e) => set('objeto', e.target.value)} />
        </Field>
        <Field label="Data limite">
          <input type="date" className={input} value={f.data} onChange={(e) => set('data', e.target.value)} />
        </Field>
        <Field label="Horário">
          <input type="time" className={input} value={f.hora} onChange={(e) => set('hora', e.target.value)} />
        </Field>
        <Field label="Status" className="col-span-2">
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value as StatusKey)}>
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>{STATUS[k]}</option>
            ))}
          </select>
        </Field>
        <div className="col-span-2 text-body-sm text-outline">
          Registro em nome de <b className="text-on-surface">{usuario || 'usuário não identificado'}</b>
        </div>
        <div className="col-span-2">
          <Actions onClose={onClose} busy={busy} submit="Salvar" />
        </div>
      </form>

      {initial && (
        <div className="mt-space-lg border-t border-surface-container pt-space-md">
          <h3 className="mb-space-sm flex items-center gap-1 font-label-md text-label-md font-bold uppercase text-outline">
            <span className="material-symbols-outlined text-[16px]">fact_check</span> Auditoria
          </h3>
          <div className="flex max-h-48 flex-col gap-space-xs overflow-y-auto">
            {audit.length === 0 && <span className="text-body-sm text-outline">Sem registros de auditoria para este edital.</span>}
            {[...audit].reverse().map((a) => (
              <div key={a.id} className="rounded-lg bg-surface-container-low p-space-sm text-body-sm">
                <div className="flex justify-between text-outline">
                  <span>
                    <b className="text-on-surface">{a.usuario}</b> • {a.acao === 'CRIACAO' ? 'criou' : 'editou'}
                  </span>
                  <span className="font-data-mono">{new Date(a.ts).toLocaleString('pt-BR')}</span>
                </div>
                <div className="mt-0.5 text-on-surface-variant">{a.detalhe}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ---------- Registrar retificação ----------
export function RetifModal({
  editais,
  initialId,
  onSave,
  onClose,
}: {
  editais: Edital[]
  initialId?: number
  onSave: (id: number, v: { desc: string; data: string; hora: string }) => Promise<boolean>
  onClose: () => void
}) {
  const [id, setId] = useState<number>(initialId ?? editais[0].id)
  const [desc, setDesc] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const ed = editais.find((e) => e.id === id)
    setData(ed?.data ?? '')
    setHora(ed?.hora ?? '')
  }, [id, editais])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSave(id, { desc, data, hora })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Registrar Retificação" icon="published_with_changes" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-space-md">
        <Field label="Edital" className="col-span-2">
          <select className={input} value={id} onChange={(e) => setId(Number(e.target.value))}>
            {editais.map((e) => (
              <option key={e.id} value={e.id}>{e.num} — {e.orgao}</option>
            ))}
          </select>
        </Field>
        <Field label="Descrição da alteração" className="col-span-2">
          <textarea
            required
            rows={3}
            className={`${input} h-auto py-2`}
            placeholder="Ex.: Retificação 03 — inclusão de novo anexo técnico"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Field>
        <Field label="Nova data limite (opcional)">
          <input type="date" className={input} value={data} onChange={(e) => setData(e.target.value)} />
        </Field>
        <Field label="Novo horário (opcional)">
          <input type="time" className={input} value={hora} onChange={(e) => setHora(e.target.value)} />
        </Field>
        <div className="col-span-2">
          <Actions onClose={onClose} busy={busy} submit="Registrar" danger />
        </div>
      </form>
    </Modal>
  )
}

// ---------- Histórico ----------
export function HistModal({ edital, onClose }: { edital: Edital; onClose: () => void }) {
  return (
    <Modal title={`Histórico — ${edital.num}`} icon="history" onClose={onClose}>
      <p className="mb-space-md text-body-sm text-on-surface-variant">
        {edital.orgao} • {edital.objeto}
      </p>
      <div className="flex flex-col gap-space-sm">
        {edital.retifs.length === 0 && (
          <div className="py-4 text-center text-outline">Nenhuma retificação registrada para este edital.</div>
        )}
        {[...edital.retifs].reverse().map((r) => (
          <div key={r.ts} className="rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
            <div className="flex justify-between">
              <span className="font-label-md text-label-md font-bold text-primary">{new Date(r.ts).toLocaleString('pt-BR')}</span>
              <span className={`font-data-mono text-[11px] font-bold ${r.dias > 0 ? 'text-error' : 'text-secondary'}`}>
                {r.dias > 0 ? `+${r.dias} dias` : 'Data mantida'}
              </span>
            </div>
            <div className="mt-1 text-body-sm">{r.desc}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-space-md">
        <button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Relatório ----------
export function ReportModal({ editais, onExport, onClose }: { editais: Edital[]; onExport: () => void; onClose: () => void }) {
  const sum = (a: Edital[]) => a.reduce((s, x) => s + x.valor, 0)
  return (
    <Modal title="Relatório Resumido" icon="query_stats" onClose={onClose}>
      <table className="w-full text-body-md">
        <thead>
          <tr className="font-label-sm text-label-sm uppercase text-outline">
            <th className="text-left">Status</th>
            <th className="text-right">Editais</th>
            <th className="text-right">Volume</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_KEYS.map((k) => {
            const l = editais.filter((x) => x.status === k)
            return (
              <tr key={k}>
                <td className="py-1">{STATUS[k]}</td>
                <td className="text-right font-data-mono">{l.length}</td>
                <td className="text-right font-data-mono">{brl(sum(l))}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-bold">
            <td className="pt-2">Total</td>
            <td className="pt-2 text-right font-data-mono">{editais.length}</td>
            <td className="pt-2 text-right font-data-mono">{brl(sum(editais))}</td>
          </tr>
        </tfoot>
      </table>
      <div className="flex justify-end gap-space-sm pt-space-md">
        <button type="button" onClick={onExport} className="rounded-lg bg-surface-container-low px-4 py-2 font-label-md text-label-md text-primary">
          Exportar em PDF
        </button>
        <button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Configurações (nome e cargo) ----------
export function SettingsModal({
  settings,
  onSave,
  onClose,
}: {
  settings: Settings
  onSave: (s: Settings) => Promise<boolean>
  onClose: () => void
}) {
  const [nome, setNome] = useState(settings.nome)
  const [cargo, setCargo] = useState(settings.cargo)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSave({ nome: nome.trim(), cargo: cargo.trim() })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Configurações" icon="settings" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-space-md">
        <p className="text-body-sm text-on-surface-variant">Nome e cargo aparecem no canto superior direito do painel.</p>
        <Field label="Seu nome">
          <input required maxLength={80} className={input} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Seu cargo">
          <input maxLength={80} className={input} placeholder="Ex.: Analista de Licitações" value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </Field>
        <Actions onClose={onClose} busy={busy} submit="Salvar" />
      </form>

    </Modal>
  )
}
