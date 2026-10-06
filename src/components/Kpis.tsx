import type { Edital } from '../shared'
import { brl, todayIso } from '../lib/utils'

const sum = (a: Edital[]) => a.reduce((s, x) => s + x.valor, 0)
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

export default function Kpis({ editais }: { editais: Edital[] }) {
  const tin = editais.filter((x) => x.cat === 'TINTAS')
  const pne = editais.filter((x) => x.cat === 'PNEUS')
  const total = editais.length || 1
  const nRet = count(editais, (x) => x.retifs.length > 0)
  const totalRet = editais.reduce((s, x) => s + x.retifs.length, 0)
  const prazoAlt = count(editais, (x) => x.retifs.some((r) => r.dias > 0))
  const pct = (n: number) => Math.round((n / total) * 100)

  const catCard = (name: string, dot: string, text: string, badgeBg: string, list: Edital[], color: string) => (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />
          <span className="font-label-sm text-label-sm font-bold uppercase" style={{ color: text }}>{name}</span>
        </div>
        <span className="rounded px-2 py-0.5 font-label-sm text-label-sm font-semibold" style={{ background: badgeBg, color: text }}>
          {pct(list.length)}% do Funil
        </span>
      </div>
      <div className="mt-space-md">
        <div className="flex items-baseline justify-between">
          <span className="font-display-lg text-display-lg font-bold text-primary">{list.length}</span>
          <span className="font-headline-sm text-headline-sm font-semibold" style={{ color: dot }}>{brl(sum(list))}</span>
        </div>
        <div className="mt-space-sm flex flex-col gap-1">
          <SubBar label="Documentação pronta" n={count(list, (x) => x.status === 'DOCS')} total={list.length} color={color} />
          <div className="mt-0.5 flex justify-between font-label-sm text-label-sm text-outline">
            <span>Em análise: {count(list, (x) => x.status === 'ANALISE')}</span>
            <span>Aguardando: {count(list, (x) => x.status === 'PREP')}</span>
          </div>
        </div>
      </div>
    </div>
  )

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
        </div>
        <div className="mt-space-md flex items-center justify-between font-data-mono text-data-mono text-outline">
          <span>Volume Estimado:</span>
          <span className="font-bold text-primary">{brl(sum(editais))}</span>
        </div>
      </div>

      {catCard('Tintas & Revestimentos', '#a6a6a6', '#d4d4d4', '#2e2e2e', tin, '#a6a6a6')}
      {catCard('Pneus & Linha Rodoviária', '#6b6b6b', '#bdbdbd', '#2e2e2e', pne, '#6b6b6b')}

      <div className={card}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-error" />
            <span className="font-label-sm text-label-sm font-bold uppercase text-error">Retificações</span>
          </div>
          <span className="rounded bg-error-container/30 px-2 py-0.5 font-label-sm text-label-sm font-bold text-error">
            {String(totalRet).padStart(2, '0')} registradas
          </span>
        </div>
        <div className="mt-space-md">
          <div className="flex items-baseline justify-between">
            <span className="font-display-lg text-display-lg font-bold text-primary">{String(nRet).padStart(2, '0')}</span>
            <span className="font-headline-sm text-headline-sm font-semibold text-error">Editais alterados</span>
          </div>
          <div className="mt-space-sm flex flex-col gap-1">
            <SubBar
              label={`${count(editais, (x) => x.cat === 'TINTAS' && x.retifs.length > 0)} Tintas • ${count(editais, (x) => x.cat === 'PNEUS' && x.retifs.length > 0)} Pneus`}
              n={nRet}
              total={editais.length}
              color="#f5f5f5"
            />
            <div className="mt-0.5 flex justify-between font-label-sm text-label-sm text-outline">
              <span>Prazo prorrogado: {prazoAlt}</span>
              <span>Impugnações: {count(editais, (x) => x.status === 'IMPUG')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
