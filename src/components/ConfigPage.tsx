import { useState } from 'react'
import { STATUS_FIXOS, type CategoriaCfg, type Edital, type StatusCfg, type Transicao } from '../shared'
import type { CategoriaInput } from '../lib/api'
import { ItemForm, ListaOrdenavel, type CfgMode, type Secao } from './Admin'
import FluxoEditor from './FluxoEditor'
import { btnPrimary } from './Modals'

interface Props {
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  transicoes: Transicao[]
  editais: Edital[]
  onCreateCat: (v: CategoriaInput) => Promise<boolean>
  onUpdateCat: (id: string, v: CategoriaInput) => Promise<boolean>
  onDeleteCat: (c: CategoriaCfg, usos: number) => void
  onReorderCat: (ids: string[]) => Promise<boolean>
  onCreateStatus: (v: CategoriaInput) => Promise<boolean>
  onUpdateStatus: (id: string, v: CategoriaInput) => Promise<boolean>
  onDeleteStatus: (s: StatusCfg, usos: number) => void
  onReorderStatus: (ids: string[]) => Promise<boolean>
  onSaveFluxo: (v: { transicoes: Transicao[]; posicoes: Record<string, { x: number; y: number }> }) => Promise<boolean>
}

type Aba = 'cat' | 'status' | 'fluxo'

/** Configurações em página inteira: categorias, status e o mapa do fluxo entre os status. */
export default function ConfigPage(p: Props) {
  const [aba, setAba] = useState<Aba>('cat')
  const [mode, setMode] = useState<CfgMode>({ k: 'list' })
  const back = () => setMode({ k: 'list' })
  const trocar = (a: Aba) => {
    setAba(a)
    setMode({ k: 'list' })
  }

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
      itens: p.categorias,
      usos: (id) => p.editais.filter((e) => e.cat === id).length,
      onCreate: p.onCreateCat,
      onUpdate: p.onUpdateCat,
      onDelete: p.onDeleteCat,
      onReorder: p.onReorderCat,
    },
    {
      id: 'status',
      menu: 'Status',
      icon: 'flag',
      titulo: 'Status dos editais',
      descricao:
        'Aqui você cadastra o nome e a cor de cada status. Quem pode ir para onde é definido na aba "Fluxo dos status". Um status só pode ser excluído quando nenhum edital o usa. "Aguardando Abertura/Cadastro" (inicial de todo edital novo) e "Retificado / Aditivo" são usados pelo sistema: podem ser renomeados, não excluídos.',
      novo: 'Novo status',
      rotulo: 'do status',
      placeholder: 'Ex.: Recurso em andamento',
      itens: p.statuses,
      usos: (id) => p.editais.filter((e) => e.status === id).length,
      fixos: STATUS_FIXOS,
      onCreate: p.onCreateStatus,
      onUpdate: p.onUpdateStatus,
      onDelete: p.onDeleteStatus,
      onReorder: p.onReorderStatus,
    },
  ]
  const secao = secoes.find((s) => s.id === aba)

  const abas: Array<{ id: Aba; icon: string; label: string }> = [
    { id: 'cat', icon: 'category', label: 'Categorias' },
    { id: 'status', icon: 'flag', label: 'Status' },
    { id: 'fluxo', icon: 'account_tree', label: 'Fluxo dos status' },
  ]

  return (
    <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">settings</span>
        <h2 className="font-headline-sm text-headline-sm text-primary">Configurações</h2>
      </div>

      <nav className="flex gap-1 border-b border-surface-container">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => trocar(a.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-space-md py-2 text-body-md ${
              aba === a.id ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </nav>

      {aba === 'fluxo' && <FluxoEditor statuses={p.statuses} transicoes={p.transicoes} onSave={p.onSaveFluxo} />}

      {secao && mode.k === 'new' && (
        <div className="max-w-xl">
          <h3 className="mb-space-md font-label-md text-label-md font-bold uppercase text-primary">{secao.novo}</h3>
          <ItemForm rotulo={secao.rotulo} placeholder={secao.placeholder} onSubmit={secao.onCreate} onCancel={back} />
        </div>
      )}
      {secao && mode.k === 'edit' && (
        <div className="max-w-xl">
          <h3 className="mb-space-md font-label-md text-label-md font-bold uppercase text-primary">Editar — {mode.item.nome}</h3>
          <ItemForm initial={mode.item} rotulo={secao.rotulo} placeholder={secao.placeholder} onSubmit={(v) => secao.onUpdate(mode.item.id, v)} onCancel={back} />
        </div>
      )}
      {secao && mode.k === 'list' && (
        <section className="max-w-3xl">
          <h3 className="font-label-md text-label-md font-bold uppercase text-primary">{secao.titulo}</h3>
          <p className="mb-space-md mt-1 text-body-sm text-on-surface-variant">{secao.descricao}</p>
          <ListaOrdenavel key={secao.id} secao={secao} onEdit={(item) => setMode({ k: 'edit', item })} />
          <p className="mt-1 text-[11px] text-outline">Arraste pelo ícone à esquerda para mudar a ordem; ela vale em todo o sistema.</p>
          <div className="pt-space-md">
            <button type="button" onClick={() => setMode({ k: 'new' })} className={`flex items-center gap-1 ${btnPrimary}`}>
              <span className="material-symbols-outlined text-[18px]">add</span> {secao.novo}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
