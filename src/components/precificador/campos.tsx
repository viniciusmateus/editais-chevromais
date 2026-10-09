import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes } from 'react'
import type { Arredondamento } from '../../shared'
import { ARREDONDAMENTOS, avaliarConta, fmt2, fmtBrl, precoUnitario } from '../../lib/precos'
import { input, labelCls } from '../Modals'

/** Margem em % digitada como no caixa eletrônico: os dígitos entram pela direita (2 → 0,02 → 0,25 → 2,50). */
export function MargemInput({ value, onChange, className = '', autoFocus }: { value: number; onChange: (v: number) => void; className?: string; autoFocus?: boolean }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={fmt2(value)}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(-7)
          onChange(d ? Number(d) / 100 : 0)
        }}
        className={`${input} pr-7 text-right font-data-mono`}
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-body-sm font-semibold text-outline">%</span>
    </div>
  )
}

export function ArredondamentoSelect({ value, onChange, className = '' }: { value: Arredondamento; onChange: (v: Arredondamento) => void; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Arredondamento)} className={`${input} ${className}`}>
      {(Object.keys(ARREDONDAMENTOS) as Arredondamento[]).map((k) => (
        <option key={k} value={k}>
          {ARREDONDAMENTOS[k]}
        </option>
      ))}
    </select>
  )
}

/** Interruptor Unitário / Global de um lote. */
export function Interruptor({ ligado, onClick, title }: { ligado: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      title={title}
      onClick={onClick}
      className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${ligado ? 'justify-end bg-primary' : 'justify-start bg-outline-variant'}`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow" />
    </button>
  )
}

/** Calculadora rápida: custo + margem → preço (aceita contas no custo). */
export function Calculadora() {
  const [custo, setCusto] = useState('100,00')
  const [margem, setMargem] = useState(20)
  const [arred, setArred] = useState<Arredondamento>('centavo')
  const c = avaliarConta(custo)
  const preco = c ? precoUnitario(c, margem, arred) : 0
  return (
    <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Custo</span>
        <input value={custo} onChange={(e) => setCusto(e.target.value)} onFocus={(e) => e.target.select()} className={`${input} text-right font-data-mono ${c === null && custo.trim() ? 'ring-1 ring-error' : ''}`} />
      </label>
      <label className="flex flex-col gap-1">
        <span className={labelCls}>Margem</span>
        <MargemInput value={margem} onChange={setMargem} />
      </label>
      <div className="flex flex-col gap-1">
        <span className={labelCls}>Preço</span>
        <div className="flex h-9 items-center justify-end rounded-lg bg-primary-container px-3 font-data-mono text-[14px] font-bold text-on-primary-container">{fmtBrl(preco)}</div>
      </div>
      <label className="flex flex-col gap-1 sm:col-span-3">
        <span className={labelCls}>Arredondamento</span>
        <ArredondamentoSelect value={arred} onChange={setArred} />
      </label>
    </div>
  )
}

export interface Opcao {
  nome: string
  detalhe?: string
}

const MAX_SUGESTOES = 40

/**
 * Campo com sugestões (modelo / marca). O valor é o próprio texto: o que não está no catálogo aparece como "novo"
 * e entra no catálogo quando o processo é exportado. As sugestões abrem ao digitar (ou por `abrirAoFocar`);
 * Enter/Tab escolhe a destacada, setas navegam, Esc fecha.
 */
export function Sugestoes({
  value,
  onChange,
  onEscolher,
  opcoes,
  conhecido,
  abrirAoFocar,
  placeholder,
  disabled,
  erro,
  inputProps,
}: {
  value: string
  onChange: (v: string) => void
  onEscolher: (v: string) => void
  /** lista completa já ordenada (mais usados primeiro) */
  opcoes: Opcao[]
  conhecido: boolean
  abrirAoFocar?: boolean
  placeholder: string
  disabled?: boolean
  erro?: boolean
  inputProps?: InputHTMLAttributes<HTMLInputElement> & Record<`data-${string}`, string | number>
}) {
  const [aberto, setAberto] = useState(false)
  const [sel, setSel] = useState(0)
  const lista = useRef<HTMLUListElement>(null)

  const filtradas = useMemo(() => {
    if (!aberto) return []
    const q = value.trim().toUpperCase()
    const achadas = (q ? opcoes.filter((o) => o.nome.includes(q)) : opcoes).slice(0, MAX_SUGESTOES)
    // o que começa com o texto digitado vem primeiro
    if (q) achadas.sort((a, b) => Number(b.nome.startsWith(q)) - Number(a.nome.startsWith(q)))
    if (q && !opcoes.some((o) => o.nome === q)) achadas.push({ nome: q, detalhe: 'novo' })
    return achadas
  }, [aberto, value, opcoes])

  useEffect(() => setSel(0), [value, aberto])
  useEffect(() => {
    lista.current?.children[sel]?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const escolher = (nome: string) => {
    setAberto(false)
    onEscolher(nome)
  }

  return (
    <div className="relative min-w-0">
      <input
        {...inputProps}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value.toUpperCase())
          setAberto(true)
        }}
        onFocus={(e) => {
          e.target.select()
          if (abrirAoFocar) setAberto(true)
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={(e) => {
          if (!aberto || !filtradas.length) {
            // sem lista aberta, Enter confirma o que está escrito (e segue para o próximo campo)
            if (e.key === 'Enter' && value.trim()) {
              e.preventDefault()
              escolher(value.trim())
            }
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSel((i) => Math.min(i + 1, filtradas.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSel((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault()
            escolher(filtradas[sel].nome)
          } else if (e.key === 'Escape') {
            e.stopPropagation()
            setAberto(false)
          }
        }}
        className={`h-9 w-full rounded-lg bg-surface-container-low px-3 font-label-md text-[13px] uppercase focus:outline-none focus:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
          erro ? 'ring-1 ring-error/60 focus:ring-error' : 'focus:ring-secondary'
        } ${value && conhecido ? 'text-secondary' : value ? 'text-[#b45309]' : 'text-on-surface'}`}
      />
      {aberto && filtradas.length > 0 && (
        <ul ref={lista} role="listbox" className="absolute left-0 right-0 top-10 z-30 max-h-60 overflow-y-auto rounded-lg bg-surface-container-lowest py-1 shadow-xl ring-1 ring-black/10">
          {filtradas.map((o, i) => (
            <li
              key={`${o.nome}-${o.detalhe ?? ''}`}
              role="option"
              aria-selected={i === sel}
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(o.nome)
              }}
              onMouseEnter={() => setSel(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[12px] font-semibold uppercase ${i === sel ? 'bg-primary/10 text-primary' : 'text-on-surface'}`}
            >
              <span className="truncate">{o.nome}</span>
              {o.detalhe && <span className={`shrink-0 text-[10px] font-medium normal-case ${o.detalhe === 'novo' ? 'text-[#b45309]' : 'text-outline'}`}>{o.detalhe}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
