import { memo, useEffect, useState } from 'react'
import type { Arredondamento, PrecifLinha } from '../../shared'
import { avaliarConta, fmt2, fmtBrl, precoUnitario, situacao, variacao } from '../../lib/precos'
import { Sugestoes, type Opcao } from './campos'

export interface IndiceCatalogo {
  /** modelos (nome único, somando o uso em todas as marcas) com as marcas de cada um */
  modelos: Opcao[]
  marcasDoModelo: Map<string, string[]>
  marcas: Opcao[]
  marcasSet: Set<string>
}

export const CORES_SITUACAO = {
  neutro: 'bg-surface-container-low text-on-surface-variant',
  ok: 'bg-secondary-container text-on-secondary-container',
  atencao: 'bg-[#fef3c7] text-[#92400e]',
  acima: 'bg-error-container text-on-error-container',
} as const

const foca = (sel: string) => setTimeout(() => (document.querySelector(sel) as HTMLInputElement | null)?.focus(), 0)

interface Props {
  index: number
  total: number
  linha: PrecifLinha
  margem: number
  arred: Arredondamento
  cat: IndiceCatalogo
  pendencias?: string[]
  onChange: (index: number, patch: Partial<PrecifLinha>) => void
}

/** Uma linha do processo. Fluxo de teclado: Modelo → (Marca, se o modelo tem mais de uma) → Modelo da linha seguinte; Custo → Enter → Custo da seguinte. */
function LinhaItem({ index, total, linha, margem, arred, cat, pendencias, onChange }: Props) {
  const [custoTxt, setCustoTxt] = useState(linha.custo ? fmt2(linha.custo) : '')
  const [custoErro, setCustoErro] = useState(false)

  // custo alterado por fora (recarregar processo): atualiza o texto
  useEffect(() => {
    setCustoTxt((t) => (avaliarConta(t) === linha.custo || (!t && !linha.custo) ? t : linha.custo ? fmt2(linha.custo) : ''))
  }, [linha.custo])

  const fecharCusto = () => {
    const v = custoTxt.trim() ? avaliarConta(custoTxt) : 0
    if (v === null || v < 0) return setCustoErro(true)
    setCustoErro(false)
    setCustoTxt(v ? fmt2(v) : '')
    if (v !== linha.custo) onChange(index, { custo: v })
  }

  const proximaLinha = () => foca(`[data-modelo="${index + 1 < total ? index + 1 : 0}"]`)

  const escolherModelo = (nome: string) => {
    const marcas = cat.marcasDoModelo.get(nome) ?? []
    if (marcas.length === 1) {
      onChange(index, { modelo: nome, marca: marcas[0] })
      return proximaLinha()
    }
    // modelo de várias marcas (ou novo): mantém a marca só se ela fizer sentido e vai para o campo marca
    onChange(index, { modelo: nome, marca: marcas.includes(linha.marca) ? linha.marca : marcas.length ? '' : linha.marca })
    foca(`[data-marca="${index}"]`)
  }

  // marcas sugeridas: as do modelo escolhido primeiro
  const doModelo = cat.marcasDoModelo.get(linha.modelo) ?? []
  const opcoesMarca: Opcao[] = doModelo.length
    ? [...doModelo.map((nome) => ({ nome, detalhe: 'deste modelo' })), ...cat.marcas.filter((m) => !doModelo.includes(m.nome))]
    : cat.marcas

  const unit = precoUnitario(linha.custo, margem, arred)
  const sit = situacao(unit, linha.ref)
  const vr = variacao(unit, linha.ref)
  const falta = (k: string) => !!pendencias?.includes(k)
  const completa = !pendencias?.length

  return (
    <div
      id={`linha-${index}`}
      className={`grid scroll-mt-40 grid-cols-2 items-center gap-x-space-sm gap-y-1 rounded-lg border-l-4 bg-surface-container-lowest px-space-sm py-1.5 transition-shadow md:grid-cols-[92px_minmax(0,1.3fr)_minmax(0,1fr)_72px_104px_118px_150px] ${
        completa ? 'border-secondary' : 'border-outline-variant'
      }`}
    >
      <div className="flex items-center gap-1 font-data-mono text-[11px] text-outline">
        <span className="text-outline/70">#{index + 1}</span>
        <span className="rounded bg-surface-container px-1.5 py-0.5 font-semibold text-on-surface" title={`Lote ${linha.lote} • Item ${linha.item}`}>
          {linha.item}
        </span>
      </div>

      <Sugestoes
        value={linha.modelo}
        onChange={(v) => onChange(index, { modelo: v })}
        onEscolher={escolherModelo}
        opcoes={cat.modelos}
        conhecido={cat.marcasDoModelo.has(linha.modelo)}
        placeholder="Modelo"
        erro={falta('Modelo')}
        inputProps={{ 'data-modelo': index, 'aria-label': `Modelo do item ${linha.item}` }}
      />

      <Sugestoes
        value={linha.marca}
        onChange={(v) => onChange(index, { marca: v })}
        onEscolher={(nome) => {
          onChange(index, { marca: nome })
          proximaLinha()
        }}
        opcoes={opcoesMarca}
        conhecido={cat.marcasSet.has(linha.marca)}
        abrirAoFocar={doModelo.length > 1 && !linha.marca}
        placeholder="Marca"
        erro={falta('Marca')}
        inputProps={{ 'data-marca': index, 'aria-label': `Marca do item ${linha.item}` }}
      />

      <label className="flex items-center gap-1" title="Quantidade">
        <span className="font-label-sm text-[10px] uppercase text-outline md:hidden">Qtd</span>
        <input
          type="text"
          inputMode="numeric"
          value={linha.qtde || ''}
          onFocus={(e) => e.target.select()}
          onChange={(e) => onChange(index, { qtde: Number(e.target.value.replace(/\D/g, '').slice(0, 9)) || 0 })}
          className={`h-9 w-full rounded-lg bg-surface-container-low px-2 text-center font-data-mono focus:outline-none focus:ring-1 ${falta('Quantidade') ? 'ring-1 ring-error/60' : 'focus:ring-secondary'}`}
        />
      </label>

      <div className="text-right" title="Valor de referência unitário">
        <span className="block font-label-sm text-[10px] uppercase text-outline">Ref.</span>
        <span className="font-data-mono text-[12px] text-on-surface">{linha.ref ? fmt2(linha.ref) : '—'}</span>
      </div>

      <input
        type="text"
        data-custo={index}
        value={custoTxt}
        placeholder="Custo"
        aria-label={`Custo do item ${linha.item}`}
        title="Aceita contas: 120+15,5 • (80*2)/3"
        onChange={(e) => {
          setCustoTxt(e.target.value.replace(/[^\d.,+\-*/()x ]/g, ''))
          setCustoErro(false)
        }}
        onFocus={(e) => e.target.select()}
        onBlur={fecharCusto}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          fecharCusto()
          foca(`[data-custo="${e.shiftKey ? Math.max(index - 1, 0) : index + 1 < total ? index + 1 : 0}"]`)
        }}
        className={`h-9 w-full rounded-lg bg-surface-container-low px-2 text-right font-data-mono focus:outline-none focus:ring-1 ${
          custoErro || falta('Custo') ? 'ring-1 ring-error/60 focus:ring-error' : 'focus:ring-secondary'
        }`}
      />

      <div className={`flex flex-col items-end rounded-lg px-2 py-0.5 ${CORES_SITUACAO[sit]}`} title="Preço unitário • variação sobre a referência • total (× quantidade)">
        <span className="flex w-full items-baseline justify-between gap-1">
          <span className="text-[10px] font-semibold">{vr === null ? '' : `${vr > 0 ? '+' : ''}${fmt2(vr)}%`}</span>
          <span className="font-data-mono text-[13px] font-bold">{fmtBrl(unit)}</span>
        </span>
        <span className="font-data-mono text-[10px] opacity-80">{fmtBrl(unit * (linha.qtde || 0))}</span>
      </div>

      {linha.descricao && (
        <p className="col-span-2 truncate pl-1 text-[11px] text-outline md:col-span-6 md:col-start-2" title={linha.descricao}>
          {linha.descricao}
        </p>
      )}
    </div>
  )
}

export default memo(LinhaItem)
