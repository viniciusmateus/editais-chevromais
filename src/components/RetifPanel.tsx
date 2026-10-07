import type { Edital, Retif } from '../shared'

interface Props {
  editais: Edital[]
  onNew: () => void
  onHist: (id: number) => void
}

export default function RetifPanel({ editais, onNew, onHist }: Props) {
  const all: Array<Retif & { ed: Edital }> = editais
    .flatMap((ed) => ed.retifs.map((r) => ({ ...r, ed })))
    .sort((a, b) => b.ts - a.ts)
  const prazo = all.filter((r) => r.dias > 0).length

  return (
    <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:col-span-4">
      <div className="flex flex-col gap-space-md">
        <div className="flex items-center justify-between border-b border-surface-container-low pb-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[22px] text-error">published_with_changes</span>
            <div>
              <h2 className="font-headline-sm text-headline-sm leading-tight text-primary">Painel de Retificações</h2>
              <p className="text-body-sm text-on-surface-variant">Últimos registros</p>
            </div>
          </div>
          <span className="rounded bg-error-container/40 px-2 py-0.5 font-data-mono text-data-mono font-bold text-error">
            {all.length} {all.length === 1 ? 'REG.' : 'REGS.'}
          </span>
        </div>

        <div className="flex items-center justify-between gap-space-sm rounded-lg border border-[#ffedd5] bg-[#fff7ed] p-space-sm">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-[20px] text-[#ea580c]">notification_important</span>
            <span className="text-body-sm font-medium text-[#9a3412]">
              {prazo} {prazo === 1 ? 'retificação alterou' : 'retificações alteraram'} prazos de envio.
            </span>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="shrink-0 rounded bg-[#ea580c] px-2.5 py-1 font-label-sm text-label-sm font-semibold text-white hover:bg-[#c2410c]"
          >
            Registrar
          </button>
        </div>

        <div className="flex flex-col gap-space-sm">
          {all.length === 0 && <div className="py-4 text-center text-body-sm text-outline">Nenhuma retificação registrada.</div>}
          {all.slice(0, 3).map((r) => (
            <div key={`${r.ed.id}-${r.ts}`} className="flex flex-col gap-1 rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded px-1.5 font-label-sm text-label-sm font-bold ${
                      r.ed.cat === 'PNEUS' ? 'bg-[#fef3c7] text-[#b45309]' : 'bg-[#e0f2fe] text-[#0369a1]'
                    }`}
                  >
                    {r.ed.cat}
                  </span>
                  <span className="font-label-md text-label-md font-bold text-primary">{r.ed.num}</span>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 font-data-mono text-[11px] font-bold ${
                    r.dias > 0 ? 'bg-error-container/30 text-error' : 'bg-secondary-container/30 text-secondary'
                  }`}
                >
                  {r.dias > 0 ? `+${r.dias} dias de prazo` : 'Data mantida'}
                </span>
              </div>
              <div className="truncate text-body-sm font-medium" title={r.desc}>
                {r.ed.orgao} • {r.desc}
              </div>
              <div className="flex items-center justify-between border-t border-surface-container-high/60 pt-1 text-[11px] text-outline">
                <span>
                  Registrado:{' '}
                  {new Date(r.ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  {r.por ? ` por ${r.por}` : ''}
                </span>
                <button type="button" onClick={() => onHist(r.ed.id)} className="font-semibold text-primary hover:underline">
                  Ver Histórico
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-space-sm flex items-center justify-between pt-space-xs">
        <span className="font-label-sm text-label-sm text-outline">Compartilhado entre todos os usuários</span>
        <div className="flex items-center gap-1.5 font-label-md text-label-md font-semibold text-primary">
          <span className="h-2 w-2 rounded-full bg-secondary" />
          Ativo
        </div>
      </div>
    </div>
  )
}
