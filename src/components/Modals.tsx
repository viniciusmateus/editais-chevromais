import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  MODALIDADES,
  PORTAIS,
  RESULTADOS,
  STATUS,
  STATUS_KEYS,
  type Categoria,
  type Edital,
  type EditalInput,
  type Modalidade,
  type Papel,
  type PublicUser,
  type Resultado,
  type StatusKey,
} from '../shared'
import type { NewUser, UserPatch } from '../lib/api'
import { brl, moneyToInput, parseMoney } from '../lib/utils'

const input =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary'
const labelCls = 'font-label-sm text-label-sm text-outline uppercase tracking-wider'
const btnPrimary = 'rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-60'
const btnGhost = 'rounded-lg bg-surface-container-low px-4 py-2 font-label-md text-label-md text-primary'

const OUTRO = '__outro__'

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
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
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
      <button type="button" onClick={onClose} className={btnGhost}>
        Cancelar
      </button>
      <button
        type="submit"
        disabled={busy}
        className={`rounded-lg px-4 py-2 font-label-md text-label-md text-white disabled:opacity-60 ${danger ? 'bg-error' : 'bg-primary'}`}
      >
        {busy ? 'Salvando…' : submit}
      </button>
    </div>
  )
}

// ---------- Novo / editar edital ----------
export function EditalModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: Edital
  onSave: (v: EditalInput) => Promise<boolean>
  onClose: () => void
}) {
  const portalInicial = initial?.portal ?? ''
  const portalNaLista = (PORTAIS as readonly string[]).includes(portalInicial)
  const [f, setF] = useState({
    cat: (initial?.cat ?? 'TINTAS') as Categoria,
    mod: (initial?.mod ?? 0) as Modalidade,
    num: initial?.num ?? '',
    uasg: initial?.uasg ?? '',
    orgao: initial?.orgao ?? '',
    uf: initial?.uf ?? '',
    objeto: initial?.objeto ?? '',
    valorGanho: moneyToInput(initial?.valorGanho ?? 0),
    portalSel: portalNaLista ? portalInicial : portalInicial ? OUTRO : '',
    portalOutro: portalNaLista ? '' : portalInicial,
    data: initial?.data ?? '',
    hora: initial?.hora ?? '',
    status: (initial?.status ?? 'PREP') as StatusKey,
    resultado: (initial?.resultado ?? '') as Resultado,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const [err, setErr] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const valorGanho = parseMoney(f.valorGanho)
    if (valorGanho === null) return setErr('Valor ganho inválido. Use só números, por exemplo 15000, 15.000,50 ou 15000.50.')
    const portal = f.portalSel === OUTRO ? f.portalOutro.trim() : f.portalSel
    if (f.portalSel === OUTRO && !portal) return setErr('Digite o nome do portal ou escolha um da lista.')
    setErr(null)
    setBusy(true)
    const { portalSel: _sel, portalOutro: _outro, valorGanho: _texto, ...campos } = f
    const ok = await onSave({ ...campos, valorGanho, portal, uf: f.uf.toUpperCase() })
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
        <Field label="UASG / Nº de identificação">
          <input required className={input} placeholder="Ex.: 158123 ou 158.123-4" value={f.uasg} onChange={(e) => set('uasg', e.target.value)} />
          <span className="text-[11px] text-outline">Aceita qualquer formato: números, decimais, traços e letras.</span>
        </Field>
        <Field label="Órgão Comprador" className="col-span-2">
          <input required className={input} value={f.orgao} onChange={(e) => set('orgao', e.target.value)} />
        </Field>
        <Field label="UF">
          <input required maxLength={2} className={`${input} uppercase`} placeholder="PR" value={f.uf} onChange={(e) => set('uf', e.target.value)} />
        </Field>
        <Field label="Portal da licitação">
          <select className={input} value={f.portalSel} onChange={(e) => set('portalSel', e.target.value)}>
            <option value="">Não informado</option>
            {PORTAIS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
            <option value={OUTRO}>Outro (digitar)</option>
          </select>
        </Field>
        {f.portalSel === OUTRO && (
          <Field label="Nome do portal" className="col-span-2">
            <input required maxLength={60} className={input} placeholder="Ex.: Portal da prefeitura" value={f.portalOutro} onChange={(e) => set('portalOutro', e.target.value)} />
          </Field>
        )}
        <Field label="Objeto" className="col-span-2">
          <textarea required rows={3} className={`${input} h-auto py-2`} value={f.objeto} onChange={(e) => set('objeto', e.target.value)} />
        </Field>
        <Field label="Data limite">
          <input type="date" className={input} value={f.data} onChange={(e) => set('data', e.target.value)} />
        </Field>
        <Field label="Horário">
          <input type="time" className={input} value={f.hora} onChange={(e) => set('hora', e.target.value)} />
        </Field>
        <Field label="Status">
          <select className={input} value={f.status} onChange={(e) => set('status', e.target.value as StatusKey)}>
            {STATUS_KEYS.map((k) => (
              <option key={k} value={k}>{STATUS[k]}</option>
            ))}
          </select>
        </Field>
        <Field label="Valor ganho (R$)">
          <input
            inputMode="decimal"
            autoComplete="off"
            className={input}
            placeholder="Ex.: 15.000,50"
            value={f.valorGanho}
            onChange={(e) => set('valorGanho', e.target.value)}
          />
          <span className="text-[11px] text-outline">Aceita centavos. Deixe vazio enquanto não ganhou.</span>
        </Field>
        <Field label="Resultado da licitação">
          <select
            className={`${input} font-semibold ${f.resultado === 'GANHAMOS' ? 'text-green-700' : f.resultado === 'PERDEMOS' ? 'text-red-700' : ''}`}
            value={f.resultado}
            onChange={(e) => set('resultado', e.target.value as Resultado)}
          >
            <option value="">Em andamento</option>
            <option value="GANHAMOS">{RESULTADOS.GANHAMOS}</option>
            <option value="PERDEMOS">{RESULTADOS.PERDEMOS}</option>
          </select>
        </Field>
        {err && <div className="col-span-2 rounded-lg bg-error-container/50 px-3 py-2 text-body-sm font-medium text-on-error-container">{err}</div>}
        <div className="col-span-2">
          <Actions onClose={onClose} busy={busy} submit="Salvar" />
        </div>
      </form>
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

  // ao trocar de edital, preenche com a data/hora atuais dele (só quando o edital muda)
  useEffect(() => {
    const ed = editais.find((e) => e.id === id)
    setData(ed?.data ?? '')
    setHora(ed?.hora ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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
const fmtTs = (ts: number) => (ts ? new Date(ts).toLocaleString('pt-BR') : '')

export function HistModal({ edital, onClose }: { edital: Edital; onClose: () => void }) {
  return (
    <Modal title={`Histórico — ${edital.num}`} icon="history" onClose={onClose}>
      <p className="text-body-sm text-on-surface-variant">
        {edital.orgao} • {edital.objeto}
      </p>
      <p className="mb-space-md mt-1 text-[11px] text-outline">
        Cadastrado por {edital.criadoPor || '—'}
        {edital.atualizadoEm ? ` • Última alteração por ${edital.atualizadoPor || '—'} em ${fmtTs(edital.atualizadoEm)}` : ''}
      </p>
      <h4 className="mb-space-xs font-label-sm text-label-sm font-bold uppercase tracking-wider text-outline">
        Registro de alterações ({edital.log.length})
      </h4>
      <ul className="mb-space-md flex flex-col gap-space-sm">
        {edital.log.length === 0 && <li className="py-2 text-outline">Nenhuma alteração registrada.</li>}
        {[...edital.log].reverse().map((l, i) => (
          <li key={`${l.ts}-${i}`} className="rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
            <div className="font-label-md text-label-md font-bold text-primary">
              {fmtTs(l.ts)} • {l.por || '—'}
              <span className="ml-1 font-normal text-on-surface-variant">
                {l.acao === 'criou' ? 'cadastrou o edital' : l.acao === 'retificou' ? 'registrou uma retificação' : 'alterou'}
              </span>
            </div>
            {l.obs && <div className="mt-0.5 text-body-sm italic text-on-surface-variant">“{l.obs}”</div>}
            {l.mudancas.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-body-sm">
                {l.mudancas.map((m, j) => (
                  <li key={j}>
                    <b>{m.campo}:</b> <span className="text-outline line-through">{m.de}</span> → <b>{m.para}</b>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <h4 className="mb-space-xs font-label-sm text-label-sm font-bold uppercase tracking-wider text-outline">Retificações</h4>
      <div className="flex flex-col gap-space-sm">
        {edital.retifs.length === 0 && (
          <div className="py-4 text-center text-outline">Nenhuma retificação registrada para este edital.</div>
        )}
        {[...edital.retifs].reverse().map((r) => (
          <div key={r.ts} className="rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
            <div className="flex justify-between">
              <span className="font-label-md text-label-md font-bold text-primary">
                {fmtTs(r.ts)}
                {r.por ? ` • ${r.por}` : ''}
              </span>
              <span className={`font-data-mono text-[11px] font-bold ${r.dias > 0 ? 'text-error' : 'text-secondary'}`}>
                {r.dias > 0 ? `+${r.dias} dias` : 'Data mantida'}
              </span>
            </div>
            <div className="mt-1 text-body-sm">{r.desc}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-space-md">
        <button type="button" onClick={onClose} className={btnPrimary}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Relatório ----------
export function ReportModal({ editais, onExport, onClose }: { editais: Edital[]; onExport: () => void; onClose: () => void }) {
  const sum = (a: Edital[]) => a.reduce((s, x) => s + x.valorGanho, 0)
  return (
    <Modal title="Relatório Resumido" icon="query_stats" onClose={onClose}>
      <table className="w-full text-body-md">
        <thead>
          <tr className="font-label-sm text-label-sm uppercase text-outline">
            <th className="text-left">Status</th>
            <th className="text-right">Editais</th>
            <th className="text-right">Valor ganho</th>
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
        <button type="button" onClick={onExport} className={btnGhost}>
          Exportar CSV
        </button>
        <button type="button" onClick={onClose} className={btnPrimary}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Meu perfil e senha ----------
export function ProfileModal({
  me,
  onSaveProfile,
  onChangePassword,
  onUsers,
  onClearAll,
  onLogout,
  onClose,
}: {
  me: PublicUser
  onSaveProfile: (v: { nome: string; cargo: string }) => Promise<boolean>
  onChangePassword: (v: { atual: string; nova: string }) => Promise<boolean>
  onUsers: () => void
  onClearAll: () => void
  onLogout: () => void
  onClose: () => void
}) {
  const [nome, setNome] = useState(me.nome)
  const [cargo, setCargo] = useState(me.cargo)
  const [busy, setBusy] = useState(false)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [conf, setConf] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const admin = me.papel === 'admin'

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    await onSaveProfile({ nome: nome.trim(), cargo: cargo.trim() })
    setBusy(false)
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (nova !== conf) return setPwErr('A confirmação não confere com a nova senha.')
    setPwErr(null)
    setPwBusy(true)
    const ok = await onChangePassword({ atual, nova })
    setPwBusy(false)
    if (ok) {
      setAtual('')
      setNova('')
      setConf('')
    }
  }

  return (
    <Modal title="Meu perfil e senha" icon="manage_accounts" onClose={onClose}>
      <p className="mb-space-md text-body-sm text-on-surface-variant">
        Conectado como <strong>@{me.usuario}</strong> • {admin ? 'Administrador' : 'Usuário'}
      </p>

      <form onSubmit={saveProfile} className="grid grid-cols-1 gap-space-md">
        <Field label="Nome">
          <input required maxLength={80} className={input} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Cargo">
          <input maxLength={80} className={input} placeholder="Ex.: Analista de Licitações" value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="mt-space-lg grid grid-cols-1 gap-space-md border-t border-surface-container pt-space-md">
        <h3 className="font-label-md text-label-md font-bold uppercase text-primary">Alterar senha</h3>
        <Field label="Senha atual">
          <input required type="password" autoComplete="current-password" className={input} value={atual} onChange={(e) => setAtual(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-space-md">
          <Field label="Nova senha (mín. 6)">
            <input required type="password" autoComplete="new-password" className={input} value={nova} onChange={(e) => setNova(e.target.value)} />
          </Field>
          <Field label="Confirmar nova senha">
            <input required type="password" autoComplete="new-password" className={input} value={conf} onChange={(e) => setConf(e.target.value)} />
          </Field>
        </div>
        {pwErr && <div className="text-body-sm font-medium text-error">{pwErr}</div>}
        <p className="text-[11px] text-outline">Ao trocar a senha, os outros aparelhos em que você está conectado são desconectados.</p>
        <div className="flex justify-end">
          <button type="submit" disabled={pwBusy} className={btnPrimary}>
            {pwBusy ? 'Salvando…' : 'Alterar senha'}
          </button>
        </div>
      </form>

      <div className="mt-space-lg flex flex-wrap items-center justify-between gap-space-sm border-t border-surface-container pt-space-md">
        <button type="button" onClick={onLogout} className={btnGhost}>
          Sair desta conta
        </button>
        {admin && (
          <button type="button" onClick={onUsers} className={btnGhost}>
            Gerenciar usuários
          </button>
        )}
      </div>

      {admin && (
        <div className="mt-space-lg border-t border-surface-container pt-space-md">
          <h3 className="font-label-md text-label-md font-bold uppercase text-error">Zona de perigo (administrador)</h3>
          <p className="mb-space-sm mt-1 text-body-sm text-on-surface-variant">
            Remove todos os editais e retificações de <strong>todos os usuários</strong>. Contas e senhas são mantidas.
          </p>
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg bg-error-container/40 px-4 py-2 font-label-md text-label-md font-bold text-error hover:bg-error-container/60"
          >
            Apagar todos os editais
          </button>
        </div>
      )}
    </Modal>
  )
}

// ---------- Usuários (administrador) ----------
interface UserFormValue {
  usuario: string
  nome: string
  cargo: string
  senha: string
  papel: Papel
}

function UserForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: PublicUser
  onSubmit: (v: UserFormValue) => Promise<boolean>
  onCancel: () => void
}) {
  const editing = !!initial
  const [f, setF] = useState<UserFormValue>({
    usuario: initial?.usuario ?? '',
    nome: initial?.nome ?? '',
    cargo: initial?.cargo ?? '',
    senha: '',
    papel: initial?.papel ?? 'usuario',
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof UserFormValue>(k: K, v: UserFormValue[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSubmit(f)
    setBusy(false)
    if (ok) onCancel()
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-space-md">
      <Field label="Usuário (login)">
        <input
          required
          disabled={editing}
          autoCapitalize="none"
          className={`${input} disabled:opacity-60`}
          placeholder="ex.: joao.silva"
          value={f.usuario}
          onChange={(e) => set('usuario', e.target.value)}
        />
      </Field>
      <Field label="Permissão">
        <select className={input} value={f.papel} onChange={(e) => set('papel', e.target.value as Papel)}>
          <option value="usuario">Usuário (vê e edita os editais)</option>
          <option value="admin">Administrador (também gerencia usuários)</option>
        </select>
      </Field>
      <Field label="Nome">
        <input required maxLength={80} className={input} value={f.nome} onChange={(e) => set('nome', e.target.value)} />
      </Field>
      <Field label="Cargo">
        <input maxLength={80} className={input} value={f.cargo} onChange={(e) => set('cargo', e.target.value)} />
      </Field>
      <Field label={editing ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 6)'} className="col-span-2">
        <input
          required={!editing}
          type="password"
          autoComplete="new-password"
          className={input}
          value={f.senha}
          onChange={(e) => set('senha', e.target.value)}
        />
      </Field>
      <div className="col-span-2">
        <Actions onClose={onCancel} busy={busy} submit={editing ? 'Salvar' : 'Criar usuário'} />
      </div>
    </form>
  )
}

type UsersMode = { k: 'list' } | { k: 'new' } | { k: 'edit'; user: PublicUser }

export function UsersModal({
  me,
  users,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  me: PublicUser
  users: PublicUser[]
  onCreate: (v: NewUser) => Promise<boolean>
  onUpdate: (id: number, v: UserPatch) => Promise<boolean>
  onDelete: (u: PublicUser) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<UsersMode>({ k: 'list' })
  const back = () => setMode({ k: 'list' })

  if (mode.k === 'new') {
    return (
      <Modal title="Novo usuário" icon="person_add" onClose={onClose}>
        <UserForm onSubmit={(v) => onCreate(v)} onCancel={back} />
      </Modal>
    )
  }
  if (mode.k === 'edit') {
    const target = mode.user
    return (
      <Modal title={`Editar @${target.usuario}`} icon="manage_accounts" onClose={onClose}>
        <UserForm
          initial={target}
          onSubmit={(v) =>
            onUpdate(target.id, { nome: v.nome, cargo: v.cargo, papel: v.papel, ...(v.senha ? { senha: v.senha } : {}) })
          }
          onCancel={back}
        />
      </Modal>
    )
  }

  return (
    <Modal title="Usuários" icon="group" onClose={onClose}>
      <p className="mb-space-md text-body-sm text-on-surface-variant">
        Todos os usuários enxergam e editam os mesmos editais. Só administradores gerenciam contas.
      </p>
      <div className="flex flex-col divide-y divide-surface-container-low rounded-lg border border-surface-container">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-space-sm p-space-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-label-md text-label-md font-bold text-primary">{u.nome}</span>
                {u.papel === 'admin' && (
                  <span className="rounded bg-secondary-container/40 px-1.5 text-[10px] font-bold text-on-secondary-container">ADMIN</span>
                )}
                {u.id === me.id && <span className="rounded bg-surface-container px-1.5 text-[10px] font-bold text-on-surface">VOCÊ</span>}
              </div>
              <div className="truncate text-body-sm text-outline">
                @{u.usuario}
                {u.cargo ? ` • ${u.cargo}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" title="Editar / redefinir senha" onClick={() => setMode({ k: 'edit', user: u })} className="rounded p-1.5 text-primary hover:bg-surface-container">
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              {u.id !== me.id && (
                <button type="button" title="Excluir usuário" onClick={() => onDelete(u)} className="rounded p-1.5 text-error hover:bg-error-container/40">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-space-md">
        <button type="button" onClick={() => setMode({ k: 'new' })} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          <span className="material-symbols-outlined text-[18px]">person_add</span> Novo usuário
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}
