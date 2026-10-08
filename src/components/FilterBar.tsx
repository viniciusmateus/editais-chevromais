import type { CategoriaCfg, Edital } from '../shared'
import { inPeriod, type Periodo } from '../lib/utils'

interface Props {
  editais: Edital[]
  categorias: CategoriaCfg[]
  cat: string
  onCat: (v: string) => void
  per: Periodo
  onPer: (v: Periodo) => void
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

export default function FilterBar({ editais, categorias, cat, onCat, per, onPer, onClear }: Props) {
  const nCat = (c: string) => editais.filter((x) => x.cat === c).length
  return (
    <div className="grid grid-cols-1 gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm md:grid-cols-2 lg:grid-cols-12">
      <div className="flex flex-col gap-1 lg:col-span-4">
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

      <div className="flex flex-col gap-1 lg:col-span-4">
        <label className={label} htmlFor="fPer">Data de Abertura / Envio</label>
        <select id="fPer" className={select} value={per} onChange={(e) => onPer(e.target.value as Periodo)}>
          {PERIODOS.map(([k, name]) => (
            <option key={k} value={k}>
              {name} ({editais.filter((x) => inPeriod(x, k)).length})
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end justify-end gap-space-xs lg:col-span-4">
        <button
          type="button"
          onClick={onClear}
          title="Limpar filtros"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface-container px-3 font-label-md text-label-md text-primary hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-[18px]">filter_alt_off</span> Limpar filtros
        </button>
      </div>
    </div>
  )
}
