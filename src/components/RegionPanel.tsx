import { MODALIDADES, REGIOES, type Edital } from '../shared'
import { brl, regiaoDe } from '../lib/utils'

export default function RegionPanel({ editais }: { editais: Edital[] }) {
  const n = editais.length || 1
  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:col-span-8">
      <div className="mb-space-md flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
        <div>
          <h2 className="font-headline-sm text-headline-sm text-primary">Distribuição Geográfica &amp; Modalidades</h2>
          <p className="text-body-sm text-on-surface-variant">Comparativo de editais registrados por macrorregião</p>
        </div>
        <div className="flex items-center gap-space-md font-label-sm text-label-sm">
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#a6a6a6]" />Tintas</div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#6b6b6b]" />Pneus</div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-space-md py-space-sm">
        {Object.keys(REGIOES).map((r) => {
          const list = editais.filter((x) => regiaoDe(x.uf) === r)
          const t = list.filter((x) => x.cat === 'TINTAS').length
          const p = list.length - t
          const pt = list.length ? Math.round((t / list.length) * 100) : 0
          const valor = list.reduce((s, x) => s + x.valor, 0)
          return (
            <div key={r} className="flex flex-col gap-1">
              <div className="flex justify-between font-label-md text-label-md">
                <span className="font-semibold">Região {r} - {list.length} Editais</span>
                <span className="font-data-mono text-data-mono text-outline">{brl(valor)}</span>
              </div>
              <div className="flex h-6 w-full overflow-hidden rounded-lg bg-surface-container-low">
                {list.length > 0 && (
                  <>
                    <div className="flex h-full items-center bg-[#a6a6a6] px-2 text-[10px] font-bold text-black" style={{ width: `${pt}%` }}>
                      {t ? `Tintas (${t})` : ''}
                    </div>
                    <div className="flex h-full items-center justify-end bg-[#6b6b6b] px-2 text-[10px] font-bold text-white" style={{ width: `${100 - pt}%` }}>
                      {p ? `Pneus (${p})` : ''}
                    </div>
                  </>
                )}
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
