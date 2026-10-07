import type { CategoriaCfg, Edital, StatusCfg } from '../shared'
import { brl, todayIso } from '../lib/utils'

const sum = (a: Edital[]) => a.reduce((s, x) => s + x.valorGanho, 0)
const count = (a: Edital[], f: (e: Edital) => boolean) => a.filter(f).length

function SubBar({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  return (
    <>
      <div className="flex justify-between text-body-sm text-on-surface-variant">
        <span>{label}</span>
        <span className="font-data-mono font-semibold text-primary">{n}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div className="h-1.5 rounded-full" style={{ width: `${total ? Math.round((n / total) * 100) : 0}%`, background: color }} />
      </div>
    </>
  )
}

const card = 'flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm transition-shadow hover:shadow-md'

export default function Kpis({ editais, categorias, statuses }: { editais: Edital[]; categorias: CategoriaCfg[]; statuses: StatusCfg[] }) {
  const st = (id: string) => statuses.find((s) => s.id === id)
  const total = editais.length || 1
  const nRet = count(editais, (x) => x.retifs.length > 0)
  const totalRet = editais.reduce((s, x) => s + x.retifs.length, 0)
  const prazoAlt = count(editais, (x) => x.retifs.some((r) => r.dias > 0))
  const pct = (n: number) => Math.round((n / total) * 100)

  const catCard = (c: CategoriaCfg) => {
    const list = editais.filter((x) => x.cat === c.id)
    const dot = c.cor
    return (
    <div key={c.id} className={card}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
          <span className="font-label-sm text-label-sm font-bold uppercase" style={{ color: dot }}>{c.nome}</span>
        </div>
        <span className="rounded px-2 py-0.5 font-label-sm text-label-sm font-semibold" style={{ background: `${dot}22`, color: dot }}>
          {pct(list.length)}% do Funil
        </span>
      </div>
      <div className="mt-space-md">
        <div className="flex items-baseline justify-between">
          <span className="font-display-lg text-display-lg font-bold text-primary">{list.length}</span>
          <span className="font-headline-sm text-headline-sm font-semibold" style={{ color: dot }} title="Valor ganho">
            {brl(sum(list))}
            <span className="ml-1 text-[11px] font-medium text-outline">ganho</span>
          </span>
        </div>
        <div className="mt-space-sm flex flex-col gap-1">
          {st('DOCS') && <SubBar label={st('DOCS')!.nome} n={count(list, (x) => x.status === 'DOCS')} total={list.length} color={dot} />}
          <div className="mt-0.5 flex justify-between font-label-sm text-label-sm text-outline">
            {st('ANALISE') && <span>{st('ANALISE')!.nome}: {count(list, (x) => x.status === 'ANALISE')}</span>}
            {st('PREP') && <span>{st('PREP')!.nome}: {count(list, (x) => x.status === 'PREP')}</span>}
          </div>
        </div>
      </div>
    </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2 xl:grid-cols-4">
      <div className={card}>
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Monitoramento Ativo</span>
          <span className="material-symbols-outlined text-[20px] text-primary">radar</span>
        </div>
        <div className="mt-space-md">
          <div className="flex items-baseline gap-space-sm">
            <span className="font-display-lg text-display-lg font-bold text-primary">{editais.length}</span>
            <span className="rounded bg-secondary-container/30 px-1.5 py-0.5 font-label-sm text-label-sm font-semibold text-secondary">
              {count(editais, (x) => x.data === todayIso())} hoje
            </span>
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {count(editais, (x) => x.status === 'PREP' || x.status === 'ANALISE')} em preparação ou análise
          </p>
          <p className="mt-1 text-body-sm font-semibold">
            <span className="text-green-700">{count(editais, (x) => x.resultado === 'GANHAMOS')} ganhamos</span>
            <span className="text-outline"> • </span>
            <span className="text-red-700">{count(editais, (x) => x.resultado === 'PERDEMOS')} perdemos</span>
          </p>
        </div>
        <div className="mt-space-md flex items-center justify-between font-data-mono text-data-mono text-outline">
          <span>Valor ganho:</span>
          <span className="font-bold text-primary">{brl(sum(editais))}</span>
        </div>
      </div>

      {categorias.map(catCard)}

      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-error" />
            <span className="font-label-sm text-label-sm font-bold uppercase text-error">Retificações</span>
          </div>
          <span className="rounded bg-error-container/30 px-2 py-0.5 font-label-sm text-label-sm font-bold text-error">
            {totalRet} registradas
          </span>
        </div>
        <div className="mt-space-md">
          <div className="flex items-baseline justify-between">
            <span className="font-display-lg text-display-lg font-bold text-primary">{nRet}</span>
            <span className="font-headline-sm text-headline-sm font-semibold text-error">Editais alterados</span>
          </div>
          <div className="mt-space-sm flex flex-col gap-1">
            <SubBar
              label={
                categorias
                  .map((c) => ({ c, n: count(editais, (x) => x.cat === c.id && x.retifs.length > 0) }))
                  .filter((i) => i.n > 0)
                  .map((i) => `${i.n} ${i.c.nome}`)
                  .join(' • ') || 'Nenhuma retificação'
              }
              n={nRet}
              total={editais.length}
              color="#ba1a1a"
            />
            <div className="mt-0.5 flex justify-between font-label-sm text-label-sm text-outline">
              <span>Prazo prorrogado: {prazoAlt}</span>
              {st('IMPUG') && <span>{st('IMPUG')!.nome}: {count(editais, (x) => x.status === 'IMPUG')}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
