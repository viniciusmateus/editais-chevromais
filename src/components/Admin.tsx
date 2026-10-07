import { useEffect, useState, type FormEvent } from 'react'
import { CAMPOS_PORTAL, REGRAS_PADRAO, STATUS_FIXOS, type CategoriaCfg, type Edital, type Portal, type Regra, type RegrasCampos, type StatusCfg } from '../shared'
import type { CategoriaInput, PortalInput } from '../lib/api'
import { Actions, Field, Modal, btnGhost, btnPrimary, input } from './Modals'

const REGRA_LABEL: Record<Regra, string> = { oculto: 'Oculto', opcional: 'Opcional', obrigatorio: 'Obrigatório' }

function resumo(campos: RegrasCampos): string {
  const v = Object.values(campos)
  const n = (r: Regra) => v.filter((x) => x === r).length
  return `${n('obrigatorio')} obrigatório(s) • ${n('opcional')} opcional(is) • ${n('oculto')} oculto(s)`
}

// ---------- Portais ----------
function PortalForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Portal
  onSubmit: (v: PortalInput) => Promise<boolean>
  onCancel: () => void
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [campos, setCampos] = useState<RegrasCampos>(initial?.campos ?? REGRAS_PADRAO)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSubmit({ nome: nome.trim(), campos })
    setBusy(false)
    if (ok) onCancel()
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-space-md">
      <Field label="Nome do portal">
        <input required maxLength={60} autoFocus className={input} placeholder="Ex.: Comprasnet" value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>

      <div>
        <h3 className="font-label-md text-label-md font-bold uppercase text-primary">Campos do formulário de edital</h3>
        <p className="mb-space-sm text-body-sm text-on-surface-variant">
          Defina, para este portal, o que aparece no cadastro do edital e o que precisa ser preenchido. A categoria é sempre obrigatória.
        </p>
        <div className="overflow-hidden rounded-lg border border-surface-container">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="bg-surface-container-low font-label-sm text-label-sm uppercase text-outline">
                <th className="px-space-sm py-2 text-left">Campo</th>
                {(Object.keys(REGRA_LABEL) as Regra[]).map((r) => (
                  <th key={r} className="px-space-sm py-2 text-center">{REGRA_LABEL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {CAMPOS_PORTAL.map((c) => (
                <tr key={c.key}>
                  <td className="px-space-sm py-1.5 font-medium">{c.label}</td>
                  {(Object.keys(REGRA_LABEL) as Regra[]).map((r) => {
                    const bloqueado = r === 'obrigatorio' && 'semObrigatorio' in c
                    return (
                      <td key={r} className="px-space-sm py-1.5 text-center">
                        <input
                          type="radio"
                          name={`campo-${c.key}`}
                          aria-label={`${c.label}: ${REGRA_LABEL[r]}`}
                          disabled={bloqueado}
                          checked={campos[c.key] === r}
                          onChange={() => setCampos((p) => ({ ...p, [c.key]: r }))}
                          className="h-4 w-4 accent-primary disabled:opacity-30"
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-outline">
          Campos ocultos não aparecem no formulário. Modalidade e Resultado têm valor padrão, por isso não podem ser obrigatórios. Valor ganho e
          Resultado só aparecem ao editar um edital (no cadastro novo ainda não há participação).
        </p>
      </div>

      <Actions onClose={onCancel} busy={busy} submit={initial ? 'Salvar portal' : 'Criar portal'} />
    </form>
  )
}

type PortalMode = { k: 'list' } | { k: 'new' } | { k: 'edit'; portal: Portal }

export function PortaisModal({
  portais,
  editais,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  portais: Portal[]
  editais: Edital[]
  onCreate: (v: PortalInput) => Promise<boolean>
  onUpdate: (id: number, v: PortalInput) => Promise<boolean>
  onDelete: (p: Portal, usos: number) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<PortalMode>({ k: 'list' })
  const back = () => setMode({ k: 'list' })

  if (mode.k === 'new') {
    return (
      <Modal title="Novo portal" icon="add_circle" wide onClose={onClose}>
        <PortalForm onSubmit={onCreate} onCancel={back} />
      </Modal>
    )
  }
  if (mode.k === 'edit') {
    const p = mode.portal
    return (
      <Modal title={`Editar portal — ${p.nome}`} icon="edit" wide onClose={onClose}>
        <PortalForm initial={p} onSubmit={(v) => onUpdate(p.id, v)} onCancel={back} />
      </Modal>
    )
  }

  return (
    <Modal title="Portais" icon="language" wide onClose={onClose}>
      <p className="mb-space-md text-body-sm text-on-surface-variant">
        Cadastre os portais onde as licitações acontecem e defina quais campos cada um exige no cadastro do edital. Editais sem portal usam as regras
        padrão (Nº, UASG, Órgão, UF e Objeto obrigatórios).
      </p>
      <div className="flex flex-col divide-y divide-surface-container-low rounded-lg border border-surface-container">
        {portais.length === 0 && <div className="p-space-md text-center text-outline">Nenhum portal cadastrado.</div>}
        {portais.map((p) => {
          const usos = editais.filter((e) => e.portal === p.nome).length
          return (
            <div key={p.id} className="flex items-center justify-between gap-space-sm p-space-sm">
              <div className="min-w-0">
                <div className="truncate font-label-md text-label-md font-bold text-primary">{p.nome}</div>
                <div className="truncate text-body-sm text-outline">
                  {resumo(p.campos)} • {usos} edital(is)
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" title="Editar portal e campos" onClick={() => setMode({ k: 'edit', portal: p })} className="rounded p-1.5 text-primary hover:bg-surface-container">
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                </button>
                <button type="button" title="Excluir portal" onClick={() => onDelete(p, usos)} className="rounded p-1.5 text-error hover:bg-error-container/40">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between pt-space-md">
        <button type="button" onClick={() => setMode({ k: 'new' })} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          <span className="material-symbols-outlined text-[18px]">add</span> Novo portal
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Configurações: categorias dos pregões e status ----------
const CORES = ['#0284c7', '#d97706', '#16a34a', '#dc2626', '#7c3aed', '#db2777', '#0d9488', '#ca8a04', '#475569', '#ea580c']

interface Item {
  id: string
  nome: string
  cor: string
}

function ItemForm({
  initial,
  rotulo,
  placeholder,
  onSubmit,
  onCancel,
}: {
  initial?: Item
  rotulo: string
  placeholder: string
  onSubmit: (v: CategoriaInput) => Promise<boolean>
  onCancel: () => void
}) {
  const [nome, setNome] = useState(initial?.nome ?? '')
  const [cor, setCor] = useState(initial?.cor ?? CORES[0])
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSubmit({ nome: nome.trim(), cor })
    setBusy(false)
    if (ok) onCancel()
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-space-md">
      <Field label={`Nome ${rotulo}`}>
        <input required maxLength={40} autoFocus className={input} placeholder={placeholder} value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <div className="flex flex-col gap-1">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Cor</span>
        <div className="flex flex-wrap items-center gap-2">
          {CORES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => setCor(c)}
              className={`h-7 w-7 rounded-full ${cor === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
              style={{ background: c }}
            />
          ))}
          <input type="color" aria-label="Outra cor" value={cor} onChange={(e) => setCor(e.target.value)} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
        </div>
      </div>
      <Actions onClose={onCancel} busy={busy} submit={initial ? 'Salvar' : 'Criar'} />
    </form>
  )
}

interface Secao {
  id: 'cat' | 'status'
  menu: string
  icon: string
  titulo: string
  descricao: string
  novo: string
  rotulo: string // "da categoria" / "do status"
  placeholder: string
  itens: Item[]
  usos: (id: string) => number
  /** ids que não podem ser excluídos */
  fixos?: string[]
  onCreate: (v: CategoriaInput) => Promise<boolean>
  onUpdate: (id: string, v: CategoriaInput) => Promise<boolean>
  onDelete: (i: Item, usos: number) => void
  onReorder: (ids: string[]) => Promise<boolean>
}

type CfgMode = { k: 'list' } | { k: 'new' } | { k: 'edit'; item: Item }

/** Lista de itens que podem ser arrastados para mudar a ordem. */
function ListaOrdenavel({ secao, onEdit }: { secao: Secao; onEdit: (i: Item) => void }) {
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  // ordem local enquanto a gravação no servidor não volta
  const [ordem, setOrdem] = useState<string[] | null>(null)

  const itens = ordem ? ordem.map((id) => secao.itens.find((i) => i.id === id)).filter((i): i is Item => !!i) : secao.itens
  // quando o servidor devolve a lista nova (ou outra pessoa mexe nela), descarta a ordem local
  const chave = secao.itens.map((i) => i.id).join('|')
  useEffect(() => setOrdem(null), [chave])

  const soltar = async (destino: string) => {
    const origem = arrastando
    setArrastando(null)
    setSobre(null)
    if (!origem || origem === destino) return
    const ids = itens.map((i) => i.id)
    ids.splice(ids.indexOf(origem), 1)
    ids.splice(ids.indexOf(destino), 0, origem)
    setOrdem(ids)
    if (!(await secao.onReorder(ids))) setOrdem(null)
  }

  return (
    <div className="flex flex-col divide-y divide-surface-container-low rounded-lg border border-surface-container">
      {itens.map((it) => {
        const usos = secao.usos(it.id)
        const fixo = secao.fixos?.includes(it.id)
        return (
          <div
            key={it.id}
            draggable
            onDragStart={(e) => {
              setArrastando(it.id)
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData('text/plain', it.id)
            }}
            onDragOver={(e) => {
              if (!arrastando) return
              e.preventDefault()
              setSobre(it.id)
            }}
            onDragLeave={() => setSobre((s) => (s === it.id ? null : s))}
            onDrop={(e) => {
              e.preventDefault()
              void soltar(it.id)
            }}
            onDragEnd={() => {
              setArrastando(null)
              setSobre(null)
            }}
            className={`flex items-center justify-between gap-space-sm bg-surface-container-lowest p-space-sm ${
              arrastando === it.id ? 'opacity-40' : ''
            } ${sobre === it.id && arrastando !== it.id ? 'shadow-[inset_0_2px_0_#0284c7]' : ''}`}
          >
            <div className="flex min-w-0 items-center gap-space-sm">
              <span className="material-symbols-outlined shrink-0 cursor-grab text-[20px] text-outline" title="Arraste para mudar a ordem">
                drag_indicator
              </span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: it.cor }} />
              <span className="truncate font-label-md text-label-md font-bold text-primary">{it.nome}</span>
              <span className="shrink-0 text-body-sm text-outline">{usos} edital(is)</span>
              {fixo && <span className="shrink-0 rounded bg-surface-container px-1.5 text-[10px] font-bold text-on-surface">DO SISTEMA</span>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" title="Editar" onClick={() => onEdit(it)} className="rounded p-1.5 text-primary hover:bg-surface-container">
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              {!fixo && (
                <button type="button" title="Excluir" onClick={() => secao.onDelete(it, usos)} className="rounded p-1.5 text-error hover:bg-error-container/40">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ConfigModal({
  categorias,
  statuses,
  editais,
  onCreateCat,
  onUpdateCat,
  onDeleteCat,
  onReorderCat,
  onCreateStatus,
  onUpdateStatus,
  onDeleteStatus,
  onReorderStatus,
  onClose,
}: {
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  editais: Edital[]
  onCreateCat: (v: CategoriaInput) => Promise<boolean>
  onUpdateCat: (id: string, v: CategoriaInput) => Promise<boolean>
  onDeleteCat: (c: CategoriaCfg, usos: number) => void
  onReorderCat: (ids: string[]) => Promise<boolean>
  onCreateStatus: (v: CategoriaInput) => Promise<boolean>
  onUpdateStatus: (id: string, v: CategoriaInput) => Promise<boolean>
  onDeleteStatus: (s: StatusCfg, usos: number) => void
  onReorderStatus: (ids: string[]) => Promise<boolean>
  onClose: () => void
}) {
  const [aba, setAba] = useState<'cat' | 'status'>('cat')
  const [mode, setMode] = useState<CfgMode>({ k: 'list' })
  const back = () => setMode({ k: 'list' })

  const secoes: Secao[] = [
    {
      id: 'cat',
      menu: 'Categorias',
      icon: 'category',
      titulo: 'Categorias dos pregões',
      descricao:
        'As categorias aparecem no cadastro do edital, nos filtros, nas abas da tabela e nos gráficos. Uma categoria só pode ser excluída quando nenhum edital a usa.',
      novo: 'Nova categoria',
      rotulo: 'da categoria',
      placeholder: 'Ex.: Material de limpeza',
      itens: categorias,
      usos: (id) => editais.filter((e) => e.cat === id).length,
      onCreate: onCreateCat,
      onUpdate: onUpdateCat,
      onDelete: onDeleteCat,
      onReorder: onReorderCat,
    },
    {
      id: 'status',
      menu: 'Status',
      icon: 'flag',
      titulo: 'Status dos editais',
      descricao:
        'Os status aparecem na tabela, nos filtros e no relatório. Um status só pode ser excluído quando nenhum edital o usa. "Aguardando Abertura" (inicial de todo edital novo) e "Retificado / Aditivo" (aplicado ao registrar uma retificação) são usados pelo sistema: podem ser renomeados, não excluídos.',
      novo: 'Novo status',
      rotulo: 'do status',
      placeholder: 'Ex.: Recurso em andamento',
      itens: statuses,
      usos: (id) => editais.filter((e) => e.status === id).length,
      fixos: STATUS_FIXOS,
      onCreate: onCreateStatus,
      onUpdate: onUpdateStatus,
      onDelete: onDeleteStatus,
      onReorder: onReorderStatus,
    },
  ]
  const secao = secoes.find((s) => s.id === aba)!

  if (mode.k === 'new') {
    return (
      <Modal title={secao.novo} icon="add_circle" onClose={onClose}>
        <ItemForm rotulo={secao.rotulo} placeholder={secao.placeholder} onSubmit={secao.onCreate} onCancel={back} />
      </Modal>
    )
  }
  if (mode.k === 'edit') {
    const it = mode.item
    return (
      <Modal title={`Editar — ${it.nome}`} icon="edit" onClose={onClose}>
        <ItemForm initial={it} rotulo={secao.rotulo} placeholder={secao.placeholder} onSubmit={(v) => secao.onUpdate(it.id, v)} onCancel={back} />
      </Modal>
    )
  }

  return (
    <Modal title="Configurações" icon="settings" wide onClose={onClose}>
      <div className="flex flex-col gap-space-md sm:flex-row">
        <nav className="flex shrink-0 flex-row gap-1 sm:w-44 sm:flex-col">
          {secoes.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setAba(s.id)}
              className={`flex items-center gap-space-sm rounded-lg px-space-md py-space-sm text-left text-body-md ${
                aba === s.id ? 'bg-primary-container font-semibold text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{s.icon}</span>
              {s.menu}
            </button>
          ))}
        </nav>
        <section className="min-w-0 flex-1">
          <h3 className="font-label-md text-label-md font-bold uppercase text-primary">{secao.titulo}</h3>
          <p className="mb-space-md mt-1 text-body-sm text-on-surface-variant">{secao.descricao}</p>
          <ListaOrdenavel key={secao.id} secao={secao} onEdit={(item) => setMode({ k: 'edit', item })} />
          <p className="mt-1 text-[11px] text-outline">Arraste pelo ícone à esquerda para mudar a ordem; ela vale em todo o sistema.</p>
          <div className="flex justify-between pt-space-md">
            <button type="button" onClick={() => setMode({ k: 'new' })} className={`flex items-center gap-1 ${btnPrimary}`}>
              <span className="material-symbols-outlined text-[18px]">add</span> {secao.novo}
            </button>
            <button type="button" onClick={onClose} className={btnGhost}>
              Fechar
            </button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
