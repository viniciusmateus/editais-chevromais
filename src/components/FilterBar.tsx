import type { CategoriaCfg, Edital, StatusCfg } from '../shared'
import { inPeriod, type Periodo } from '../lib/utils'

interface Props {
  editais: Edital[]
  categorias: CategoriaCfg[]
  statuses: StatusCfg[]
  q: string
  onQ: (v: string) => void
  cat: string
  onCat: (v: string) => void
  per: Periodo
  onPer: (v: Periodo) => void
  status: string
  onStatus: (v: string) => void
  onClear: () => void
}

const select =
  'h-9 rounded-lg bg-surface-container-low px-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary'
const label = 'font-label-sm text-label-sm uppercase tracking-wider text-outline'

const PERIODOS: Array<[Periodo, string]> = [
  ['all', 'Todo o Cronograma'],
  ['today', 'Prazos para Hoje'],
  ['7days', 'Próximos 7 Dias'],
  ['month', 'Este Mês'],
]

export default function FilterBar({ editais, categorias, statuses, q, onQ, cat, onCat, per, onPer, status, onStatus, onClear }: Props) {
  const nCat = (c: string) => editais.filter((x) => x.cat === c).length
  return (
    <div className="grid grid-cols-1 gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:grid-cols-2 lg:grid-cols-12">
      <div className="flex flex-col gap-1 lg:col-span-3">
        <label className={label} htmlFor="fCat">Categoria de Fornecimento</label>
        <select id="fCat" className={select} value={cat} onChange={(e) => onCat(e.target.value)}>
          <option value="ALL">Todas as Categorias ({editais.length})</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome} ({nCat(c.id)})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 lg:col-span-3">
        <label className={label} htmlFor="fPer">Data de Abertura / Envio</label>
        <select id="fPer" className={select} value={per} onChange={(e) => onPer(e.target.value as Periodo)}>
          {PERIODOS.map(([k, name]) => (
            <option key={k} value={k}>
              {name} ({editais.filter((x) => inPeriod(x, k)).length})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 lg:col-span-3">
        <label className={label} htmlFor="fStatus">Status Interno</label>
        <select id="fStatus" className={select} value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="ALL">Todos os Status</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome} ({editais.filter((x) => x.status === s.id).length})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-space-xs lg:col-span-3">
        <div className="flex w-full flex-col gap-1">
          <label className={label}>Busca de Pregão/UASG/Portal</label>
          <div className="relative w-full">
            <input
              value={q}
              onChange={(e) => onQ(e.target.value)}
              className="h-9 w-full rounded-lg bg-surface-container-low pl-8 pr-3 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-secondary"
              placeholder="Ex: PE 104/2026, Londrina..."
              type="text"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-outline">search</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          title="Limpar Filtros"
          className="flex h-9 items-center justify-center rounded-lg bg-surface-container px-3 text-primary hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span>
        </button>
      </div>
    </div>
  )
}
