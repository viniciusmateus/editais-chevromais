import { useState, type FormEvent } from 'react'
import { CAMPOS_BASE, type CampoBase, type PerfilCfg, type PublicUser } from '../shared'
import type { PerfilInput } from '../lib/api'
import { Actions, Field, btnPrimary, input } from './Modals'

export interface AcoesPerfil {
  onCreate: (v: PerfilInput) => Promise<boolean>
  onUpdate: (id: number, v: PerfilInput) => Promise<boolean>
  onDelete: (p: PerfilCfg, usos: number) => void
}

function PerfilForm({ initial, onSubmit, onCancel }: { initial?: PerfilCfg; onSubmit: (v: PerfilInput) => Promise<boolean>; onCancel: () => void }) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [excluir, setExcluir] = useState(initial?.excluir ?? false)
  const [campos, setCampos] = useState<CampoBase[]>(initial?.campos ?? [])
  const [busy, setBusy] = useState(false)
  const todos = campos.length === CAMPOS_BASE.length

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSubmit({ nome: nome.trim(), excluir, campos })
    setBusy(false)
    if (ok) onCancel()
  }
  const alternar = (k: CampoBase) => setCampos((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]))

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-space-md">
      <Field label="Nome do perfil">
        <input required autoFocus maxLength={60} className={input} placeholder="Ex.: Operador, Consulta, Supervisor" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>

      <div className="rounded-lg border border-surface-container p-space-md">
        <div className="mb-1 flex items-center justify-between">
          <h4 className="font-label-md text-label-md font-bold uppercase text-primary">Editar dados do edital</h4>
          <div className="flex gap-3 text-[12px] font-semibold text-primary">
            <button type="button" onClick={() => setCampos(CAMPOS_BASE.map((c) => c.key))} disabled={todos} className="hover:underline disabled:opacity-40">
              Marcar todos
            </button>
            <button type="button" onClick={() => setCampos([])} disabled={campos.length === 0} className="hover:underline disabled:opacity-40">
              Desmarcar todos
            </button>
          </div>
        </div>
        <p className="mb-space-sm text-body-sm text-on-surface-variant">
          Marque os dados base que este perfil pode alterar num edital já cadastrado. Os desmarcados aparecem bloqueados (cadeado) na edição. Ao cadastrar um edital novo, todos podem preencher tudo.
        </p>
        <div className="grid grid-cols-2 gap-x-space-md gap-y-1.5 sm:grid-cols-3">
          {CAMPOS_BASE.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-center gap-2 text-body-sm">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={campos.includes(c.key)} onChange={() => alternar(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-space-sm rounded-lg border border-surface-container p-space-md">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-primary" checked={excluir} onChange={(e) => setExcluir(e.target.checked)} />
        <span>
          <span className="block font-label-md text-label-md font-bold text-primary">Pode excluir editais</span>
          <span className="block text-body-sm text-on-surface-variant">Mostra o botão “Excluir edital” na edição. A exclusão não pode ser desfeita.</span>
        </span>
      </label>

      <p className="text-[12px] text-outline">
        Usar o fluxo (Avançar / Negativo), registrar retificações e marcar impugnações continua liberado para todos. Administradores sempre podem tudo.
      </p>
      <Actions onClose={onCancel} busy={busy} submit={initial ? 'Salvar perfil' : 'Criar perfil'} />
    </form>
  )
}

type Modo = { k: 'list' } | { k: 'new' } | { k: 'edit'; perfil: PerfilCfg }

/** Aba Perfis das Configurações: cria perfis e define o que cada um pode editar/excluir. */
export default function PerfisPanel({ perfis, users, acoes }: { perfis: PerfilCfg[]; users: PublicUser[]; acoes: AcoesPerfil }) {
  const [modo, setModo] = useState<Modo>({ k: 'list' })
  const voltar = () => setModo({ k: 'list' })

  if (modo.k === 'new') {
    return (
      <div>
        <h3 className="mb-space-md font-label-md text-label-md font-bold uppercase text-primary">Novo perfil</h3>
        <PerfilForm onSubmit={acoes.onCreate} onCancel={voltar} />
      </div>
    )
  }
  if (modo.k === 'edit') {
    const p = modo.perfil
    return (
      <div>
        <h3 className="mb-space-md font-label-md text-label-md font-bold uppercase text-primary">Editar perfil — {p.nome}</h3>
        <PerfilForm initial={p} onSubmit={(v) => acoes.onUpdate(p.id, v)} onCancel={voltar} />
      </div>
    )
  }

  return (
    <section className="max-w-3xl">
      <h3 className="font-label-md text-label-md font-bold uppercase text-primary">Perfis de acesso</h3>
      <p className="mb-space-md mt-1 text-body-sm text-on-surface-variant">
        Um perfil diz o que o usuário pode alterar nos dados base dos editais (portal, categoria, nº, órgão, cidade, UF, data e horário) e se pode excluir editais. Atribua o perfil em
        Usuários. Quem não tem perfil só consulta, usa o fluxo e registra retificações.
      </p>
      <div className="flex flex-col divide-y divide-surface-container-low rounded-lg border border-surface-container">
        {perfis.length === 0 && <div className="p-space-md text-center text-outline">Nenhum perfil cadastrado.</div>}
        {perfis.map((p) => {
          const usos = users.filter((u) => u.perfil === p.id && u.papel !== 'admin').length
          return (
            <div key={p.id} className="flex items-center justify-between gap-space-sm p-space-sm">
              <div className="min-w-0">
                <div className="truncate font-label-md text-label-md font-bold text-primary">{p.nome}</div>
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px] font-semibold">
                  <span className="rounded bg-surface-container px-1.5 py-0.5 text-on-surface-variant">
                    Edita {p.campos.length === CAMPOS_BASE.length ? 'todos os dados' : `${p.campos.length} de ${CAMPOS_BASE.length} dados`}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 ${p.excluir ? 'bg-error-container/40 text-error' : 'bg-surface-container text-on-surface-variant'}`}>
                    {p.excluir ? 'Pode excluir' : 'Não exclui'}
                  </span>
                  <span className="text-outline">{usos} usuário(s)</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" title="Editar perfil" onClick={() => setModo({ k: 'edit', perfil: p })} className="rounded p-1.5 text-primary hover:bg-surface-container">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button type="button" title="Excluir perfil" onClick={() => acoes.onDelete(p, usos)} className="rounded p-1.5 text-error hover:bg-error-container/40">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="pt-space-md">
        <button type="button" onClick={() => setModo({ k: 'new' })} className={`flex items-center gap-1 ${btnPrimary}`}>
          <span className="material-symbols-outlined text-[18px]">add</span> Novo perfil
        </button>
      </div>
    </section>
  )
}
