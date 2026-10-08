import { useState } from 'react'
import { STATUS_FIXOS, type CategoriaCfg, type Edital, type ImpugnacaoCfg, type ImpugStatusCfg, type PerfilCfg, type PublicUser, type StatusCfg, type Transicao } from '../shared'
import type { CategoriaInput } from '../lib/api'
import { ItemForm, ListaOrdenavel, type CfgMode, type Item, type Secao } from './Admin'
import FluxoEditor from './FluxoEditor'
import PerfisPanel, { type AcoesPerfil } from './PerfisPanel'
import { btnPrimary } from './Modals'

/** Ações de uma lista de itens (nome + cor) gerenciada pelo administrador. */
export interface AcoesLista {
  onCreate: (v: CategoriaInput) => Promise<boolean>
  onUpdate: (id: string, v: CategoriaInput) => Promise<boolean>
  onDelete: (i: Item, usos: number) => void
  onReorder: (ids: string[]) => Promise<boolean>
}

interface Props {
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  impugnacoes: ImpugnacaoCfg[]
  impugStatuses: ImpugStatusCfg[]
  transicoes: Transicao[]
  perfis: PerfilCfg[]
  users: PublicUser[]
  acoesPerfil: AcoesPerfil
  editais: Edital[]
  acoesCat: AcoesLista
  acoesStatus: AcoesLista
  acoesImpug: AcoesLista
  acoesImpugStatus: AcoesLista
  onSaveFluxo: (v: { transicoes: Transicao[]; posicoes: Record<string, { x: number; y: number }> }) => Promise<boolean>
}

type Aba = 'cat' | 'status' | 'fluxo' | 'impug' | 'perfis'

/** Uma lista (com botão de novo, edição e arrastar para ordenar) que alterna entre listagem e formulário na própria página. */
function ListaConfig({ secao }: { secao: Secao }) {
  const [mode, setMode] = useState<CfgMode>({ k: 'list' })
  const back = () => setMode({ k: 'list' })

  if (mode.k === 'new') {
    return (
      <div className="max-w-xl">
        <h3 className="mb-space-md font-label-md text-label-md font-bold uppercase text-primary">{secao.novo}</h3>
        <ItemForm rotulo={secao.rotulo} placeholder={secao.placeholder} onSubmit={secao.onCreate} onCancel={back} />
      </div>
    )
  }
  if (mode.k === 'edit') {
    const it = mode.item
    return (
      <div className="max-w-xl">
        <h3 className="mb-space-md font-label-md text-label-md font-bold uppercase text-primary">Editar — {it.nome}</h3>
        <ItemForm initial={it} rotulo={secao.rotulo} placeholder={secao.placeholder} onSubmit={(v) => secao.onUpdate(it.id, v)} onCancel={back} />
      </div>
    )
  }
  return (
    <section className="max-w-3xl">
      <h3 className="font-label-md text-label-md font-bold uppercase text-primary">{secao.titulo}</h3>
      <p className="mb-space-md mt-1 text-body-sm text-on-surface-variant">{secao.descricao}</p>
      {secao.itens.length === 0 && <div className="mb-space-sm rounded-lg border border-dashed border-surface-container p-space-md text-center text-outline">Nada cadastrado ainda.</div>}
      {secao.itens.length > 0 && <ListaOrdenavel key={secao.id} secao={secao} onEdit={(item) => setMode({ k: 'edit', item })} />}
      <p className="mt-1 text-[11px] text-outline">Arraste pelo ícone à esquerda para mudar a ordem; ela vale em todo o sistema.</p>
      <div className="pt-space-md">
        <button type="button" onClick={() => setMode({ k: 'new' })} className={`flex items-center gap-1 ${btnPrimary}`}>
          <span className="material-symbols-outlined text-[18px]">add</span> {secao.novo}
        </button>
      </div>
    </section>
  )
}

/** Configurações em página inteira: categorias, status, fluxo entre os status e impugnações. */
export default function ConfigPage(p: Props) {
  const [aba, setAba] = useState<Aba>('cat')

  const cat: Secao = {
    id: 'cat',
    menu: 'Categorias',
    icon: 'category',
    titulo: 'Categorias dos pregões',
    descricao: 'As categorias aparecem no cadastro do edital, nos filtros, nas abas da tabela e nos gráficos. Uma categoria só pode ser excluída quando nenhum edital a usa.',
    novo: 'Nova categoria',
    rotulo: 'da categoria',
    placeholder: 'Ex.: Material de limpeza',
    itens: p.categorias,
    usos: (id) => p.editais.filter((e) => e.cat === id).length,
    ...p.acoesCat,
  }
  const status: Secao = {
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
    ...p.acoesStatus,
  }
  const impug: Secao = {
    id: 'impug',
    menu: 'Impugnações',
    icon: 'gavel',
    titulo: 'Impugnações',
    descricao:
      'Cadastre aqui as impugnações que a empresa costuma fazer. No cadastro do edital você marca quais foram feitas (botão +). Só pode ser excluída quando nenhum edital a usa.',
    novo: 'Nova impugnação',
    rotulo: 'da impugnação',
    placeholder: 'Ex.: Exigência de atestado técnico',
    itens: p.impugnacoes,
    usos: (id) => p.editais.filter((e) => e.impugnacoes.some((i) => i.id === id)).length,
    ...p.acoesImpug,
  }
  const impugStatus: Secao = {
    id: 'impugStatus',
    menu: 'Status das impugnações',
    icon: 'rule',
    titulo: 'Status das impugnações',
    descricao:
      'Os resultados possíveis de uma impugnação (ex.: Deferida, Indeferida). Quando o fluxo pedir (ligação com "Resultado das impugnações"), o usuário escolhe um desses status para cada impugnação do edital.',
    novo: 'Novo status de impugnação',
    rotulo: 'do status',
    placeholder: 'Ex.: Deferida',
    itens: p.impugStatuses,
    usos: (id) => p.editais.filter((e) => e.impugnacoes.some((i) => i.status === id)).length,
    ...p.acoesImpugStatus,
  }

  const abas: Array<{ id: Aba; icon: string; label: string }> = [
    { id: 'cat', icon: 'category', label: 'Categorias' },
    { id: 'status', icon: 'flag', label: 'Status' },
    { id: 'fluxo', icon: 'account_tree', label: 'Fluxo dos status' },
    { id: 'impug', icon: 'gavel', label: 'Impugnações' },
    { id: 'perfis', icon: 'admin_panel_settings', label: 'Perfis de acesso' },
  ]

  return (
    <div className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">settings</span>
        <h2 className="font-headline-sm text-headline-sm text-primary">Configurações</h2>
      </div>

      <nav className="flex gap-1 overflow-x-auto border-b border-surface-container">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-space-md py-2 text-body-md ${
              aba === a.id ? 'border-primary font-semibold text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">{a.icon}</span>
            {a.label}
          </button>
        ))}
      </nav>

      {aba === 'cat' && <ListaConfig key="cat" secao={cat} />}
      {aba === 'status' && <ListaConfig key="status" secao={status} />}
      {aba === 'fluxo' && <FluxoEditor statuses={p.statuses} transicoes={p.transicoes} onSave={p.onSaveFluxo} />}
      {aba === 'perfis' && <PerfisPanel perfis={p.perfis} users={p.users} acoes={p.acoesPerfil} />}
      {aba === 'impug' && (
        <div className="flex flex-col gap-space-lg">
          <ListaConfig key="impug" secao={impug} />
          <hr className="border-surface-container" />
          <ListaConfig key="impugStatus" secao={impugStatus} />
        </div>
      )}
    </div>
  )
}
