import { MODALIDADES, REGIOES, type CategoriaCfg, type Edital } from '../shared'
import { brl, regiaoDe } from '../lib/utils'

export default function RegionPanel({ editais, categorias }: { editais: Edital[]; categorias: CategoriaCfg[] }) {
  const n = editais.length || 1
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:col-span-8">
      <div className="mb-space-md flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-primary">Distribuição Geográfica &amp; Modalidades</h2>
          <p className="text-body-sm text-on-surface-variant">Comparativo de editais registrados por macrorregião</p>
        </div>
        <div className="flex flex-wrap items-center gap-space-md font-label-sm text-label-sm">
          {categorias.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: c.cor }} />{c.nome}</div>
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-space-md py-space-sm">
        {Object.keys(REGIOES).map((r) => {
          const list = editais.filter((x) => regiaoDe(x.uf) === r)
          const valor = list.reduce((s, x) => s + x.valorGanho, 0)
          return (
            <div key={r} className="flex flex-col gap-1">
              <div className="flex justify-between font-label-md text-label-md">
                <span className="font-semibold">Região {r} - {list.length} {list.length === 1 ? 'Edital' : 'Editais'}</span>
                <span className="font-data-mono text-data-mono text-outline" title="Valor ganho">{brl(valor)}</span>
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-lg bg-surface-container-low">
                {categorias.map((c) => {
                  const k = list.filter((x) => x.cat === c.id).length
                  if (!k) return null
                  return (
                    <div
                      key={c.id}
                      className="flex h-full items-center overflow-hidden whitespace-nowrap px-2 text-[10px] font-bold text-white"
                      style={{ width: `${(k / list.length) * 100}%`, background: c.cor }}
                      title={`${c.nome}: ${k}`}
                    >
                      {c.nome} ({k})
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-space-md grid grid-cols-3 gap-space-sm pt-space-md">
        {MODALIDADES.map((m, i) => {
          const c = editais.filter((x) => x.mod === i).length
          return (
            <div key={m} className="flex flex-col rounded-lg bg-surface-container-low p-space-sm">
              <span className="font-label-sm text-label-sm uppercase text-outline">{m}</span>
              <span className="font-headline-sm text-headline-sm font-bold text-primary">
                {c} <span className="text-body-sm font-normal text-on-surface-variant">({Math.round((c / n) * 100)}%)</span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
