import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { linhaCompleta, type Edital, type PrecifCatalogo, type PrecifLinha, type PrecifProcesso, type PrecifProcessoInput } from '../../shared'
import { api, ApiError } from '../../lib/api'
import { fmtTs } from '../../lib/utils'
import { chave, exportarCompleta, exportarDisputa, exportarProposta, fmt2, fmtBrl, importarQuantidades, resumirLotes, situacao, variacao } from '../../lib/precos'
import { input, labelCls } from '../Modals'
import { ArredondamentoSelect, Interruptor, MargemInput } from './campos'
import EditalPicker from './EditalPicker'
import LinhaItem, { CORES_SITUACAO, type IndiceCatalogo } from './LinhaItem'

type Gravacao = 'salvo' | 'pendente' | 'salvando' | 'erro' | 'conflito'

interface Props {
  inicial: PrecifProcesso
  catalogo: PrecifCatalogo
  onCatalogo: (c: PrecifCatalogo) => void
  editais: Edital[]
  notify: (msg: string, error?: boolean) => void
  onErro: (e: unknown) => void
  onSair: () => void
}

const AUTOSAVE_MS = 1500

const dadosDe = (p: PrecifProcesso): PrecifProcessoInput => ({
  nome: p.nome,
  editalId: p.editalId,
  margem: p.margem,
  arredondamento: p.arredondamento,
  globais: p.globais,
  linhas: p.linhas,
})

function pendenciasDe(l: PrecifLinha): string[] {
  const out: string[] = []
  if (!l.modelo.trim()) out.push('Modelo')
  if (!l.marca.trim()) out.push('Marca')
  if (!(l.qtde > 0)) out.push('Quantidade')
  if (!(l.custo > 0)) out.push('Custo')
  return out
}

export function rotuloEdital(e: Edital) {
  return `${e.num || `#${e.id}`}${e.orgao ? ` — ${e.orgao}` : ''}${e.uf ? ` (${e.uf})` : ''}`
}

/** Edição de um processo: grava sozinho alguns segundos depois de cada alteração. */
export default function ProcessoEditor({ inicial, catalogo, onCatalogo, editais, notify, onErro, onSair }: Props) {
  const [proc, setProc] = useState(inicial)
  const [gravacao, setGravacao] = useState<Gravacao>('salvo')
  const gravacaoRef = useRef(gravacao)
  gravacaoRef.current = gravacao
  const [pendAtual, setPendAtual] = useState(0)
  const [irPara, setIrPara] = useState('')
  const [menuExport, setMenuExport] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const procRef = useRef(proc)
  procRef.current = proc
  const sujo = useRef(false)
  const emAndamento = useRef<Promise<boolean> | null>(null)

  // ---------- gravação ----------
  const salvar = useCallback(async (): Promise<boolean> => {
    while (emAndamento.current) await emAndamento.current
    if (!sujo.current) return true
    const run = (async () => {
      sujo.current = false
      const snap = procRef.current
      setGravacao('salvando')
      try {
        const novo = await api.precifSalvarProcesso(snap.id, { ...dadosDe(snap), v: snap.v })
        procRef.current = { ...procRef.current, v: novo.v }
        setProc((cur) => ({ ...cur, v: novo.v, atualizadoPor: novo.atualizadoPor, atualizadoEm: novo.atualizadoEm }))
        setGravacao(sujo.current ? 'pendente' : 'salvo')
        return true
      } catch (e) {
        sujo.current = true
        setGravacao(e instanceof ApiError && e.status === 409 ? 'conflito' : 'erro')
        onErro(e)
        return false
      }
    })()
    emAndamento.current = run
    try {
      return await run
    } finally {
      emAndamento.current = null
    }
  }, [onErro])

  /** Toda alteração passa por aqui: marca como pendente e o efeito abaixo agenda a gravação. */
  const alterar = useCallback((fn: (p: PrecifProcesso) => PrecifProcesso) => {
    sujo.current = true
    setGravacao((g) => (g === 'conflito' ? g : 'pendente'))
    setProc(fn)
  }, [])

  useEffect(() => {
    if (!sujo.current || gravacao === 'conflito' || gravacao === 'salvando') return
    const t = setTimeout(() => void salvar(), gravacao === 'erro' ? 8000 : AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [proc, gravacao, salvar])

  // saiu da tela pelo menu lateral com alteração pendente: grava antes de sumir (exceto em conflito, que precisa de decisão)
  useEffect(
    () => () => {
      if (sujo.current && gravacaoRef.current !== 'conflito') void salvar()
    },
    [salvar],
  )

  // fechar a aba com alteração não gravada: o navegador pergunta antes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (sujo.current || emAndamento.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [])

  const recarregar = async () => {
    try {
      const atual = await api.precifProcesso(proc.id)
      sujo.current = false
      setProc(atual)
      setGravacao('salvo')
      notify('Processo recarregado com a versão do servidor.')
    } catch (e) {
      onErro(e)
    }
  }

  const sobrescrever = async () => {
    try {
      const atual = await api.precifProcesso(proc.id)
      procRef.current = { ...procRef.current, v: atual.v }
      setProc((cur) => ({ ...cur, v: atual.v }))
      sujo.current = true
      setGravacao('pendente')
      if (await salvar()) notify('Suas alterações foram gravadas por cima da outra versão.')
    } catch (e) {
      onErro(e)
    }
  }

  const sair = async () => {
    if (gravacao === 'conflito' && !confirm('Há alterações que não foram gravadas por conflito com outro usuário. Sair e descartá-las?')) return
    if (gravacao !== 'conflito' && !(await salvar()) && !confirm('Não foi possível gravar as últimas alterações. Sair mesmo assim?')) return
    onSair()
  }

  // ---------- edição ----------
  const mudarLinha = useCallback(
    (i: number, patch: Partial<PrecifLinha>) =>
      alterar((p) => {
        const linhas = p.linhas.slice()
        linhas[i] = { ...linhas[i], ...patch }
        return { ...p, linhas }
      }),
    [alterar],
  )

  const alternarGlobal = (lote: string) =>
    alterar((p) => ({ ...p, globais: p.globais.includes(lote) ? p.globais.filter((g) => g !== lote) : [...p.globais, lote] }))

  const importarQtd = async (file: File) => {
    try {
      const mapa = await importarQuantidades(file)
      const qtdDe = (l: PrecifLinha) => mapa.get(`${chave(l.lote)}|${chave(l.item)}`)
      const n = procRef.current.linhas.filter((l) => qtdDe(l) !== undefined).length
      if (!n) return notify('Nenhum lote/item da planilha corresponde aos deste processo.', true)
      alterar((p) => ({ ...p, linhas: p.linhas.map((l) => ({ ...l, qtde: qtdDe(l) ?? l.qtde })) }))
      notify(`Quantidade atualizada em ${n} item(ns).`)
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Não foi possível ler a planilha.', true)
    }
  }

  // ---------- índices ----------
  const cat = useMemo<IndiceCatalogo>(() => {
    const nomeMarca = new Map(catalogo.marcas.map((m) => [m.id, m.nome]))
    const porModelo = new Map<string, { uso: number; marcas: string[] }>()
    for (const md of catalogo.modelos) {
      let e = porModelo.get(md.nome)
      if (!e) porModelo.set(md.nome, (e = { uso: 0, marcas: [] }))
      e.uso += md.uso
      const m = nomeMarca.get(md.marcaId)
      if (m && !e.marcas.includes(m)) e.marcas.push(m)
    }
    const modelos = [...porModelo.entries()]
      .sort((a, b) => b[1].uso - a[1].uso || a[0].localeCompare(b[0]))
      .map(([nome, e]) => ({ nome, detalhe: e.marcas.length === 1 ? e.marcas[0] : `${e.marcas.length} marcas` }))
    return {
      modelos,
      marcasDoModelo: new Map([...porModelo.entries()].map(([k, e]) => [k, e.marcas])),
      marcas: catalogo.marcas.map((m) => ({ nome: m.nome })),
      marcasSet: new Set(catalogo.marcas.map((m) => m.nome)),
    }
  }, [catalogo])

  const pendencias = useMemo(() => proc.linhas.map(pendenciasDe), [proc.linhas])
  const comPendencia = useMemo(() => pendencias.flatMap((p, i) => (p.length ? [i] : [])), [pendencias])
  const lotes = useMemo(() => resumirLotes(proc), [proc])
  const totalGeral = useMemo(() => [...lotes.values()].reduce((a, r) => ({ v: a.v + r.somaTotal, ref: a.ref + r.refTotal }), { v: 0, ref: 0 }), [lotes])
  const concluidos = proc.linhas.filter(linhaCompleta).length
  const progresso = proc.linhas.length ? Math.round((concluidos / proc.linhas.length) * 100) : 0

  useEffect(() => {
    if (pendAtual >= comPendencia.length) setPendAtual(Math.max(comPendencia.length - 1, 0))
  }, [comPendencia.length, pendAtual])

  const mostrarLinha = (i: number) => {
    const el = document.getElementById(`linha-${i}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-primary')
    setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 1400)
    setIrPara(String(i + 1))
    ;(el.querySelector('input') as HTMLInputElement | null)?.focus({ preventScroll: true })
  }
  const navegarPend = (passo: number) => {
    if (!comPendencia.length) return
    const n = (pendAtual + passo + comPendencia.length) % comPendencia.length
    setPendAtual(n)
    mostrarLinha(comPendencia[n])
  }

  // ---------- exportação ----------
  const exportar = async (tipo: 'proposta' | 'disputa' | 'ambas' | 'completa') => {
    setMenuExport(false)
    if (tipo !== 'completa' && comPendencia.length && !confirm(`${comPendencia.length} item(ns) ainda têm pendências e ficam de fora da exportação. Exportar assim mesmo?`)) return
    setOcupado(true)
    try {
      if (!(await salvar())) return
      const dados = dadosDe(procRef.current)
      const feitos: string[] = []
      if (tipo === 'proposta' || tipo === 'ambas') {
        const n = await exportarProposta(dados)
        feitos.push(n ? `proposta (${n} itens)` : 'proposta: nenhum item dentro dos limites')
      }
      if (tipo === 'disputa' || tipo === 'ambas') {
        const n = await exportarDisputa(dados)
        feitos.push(n ? `disputa (${n} lotes)` : 'disputa: nenhum lote dentro dos limites')
      }
      if (tipo === 'completa') feitos.push(`planilha completa (${await exportarCompleta(dados)} itens)`)
      if (tipo !== 'completa') onCatalogo(await api.precifRegistrarUso(proc.id)) // marcas/modelos novos entram no catálogo
      notify(`Exportado: ${feitos.join(' • ')}.`)
    } catch (e) {
      onErro(e)
    } finally {
      setOcupado(false)
    }
  }


  const rotuloGravacao: Record<Gravacao, { txt: string; cls: string; icon: string }> = {
    salvo: { txt: `Salvo${proc.atualizadoPor ? ` • ${proc.atualizadoPor}, ${fmtTs(proc.atualizadoEm)}` : ''}`, cls: 'text-secondary', icon: 'cloud_done' },
    pendente: { txt: 'Alterações não salvas…', cls: 'text-outline', icon: 'cloud_upload' },
    salvando: { txt: 'Salvando…', cls: 'text-outline', icon: 'sync' },
    erro: { txt: 'Erro ao salvar — tentando de novo', cls: 'text-error', icon: 'cloud_off' },
    conflito: { txt: 'Conflito com outro usuário', cls: 'text-error', icon: 'warning' },
  }
  const rg = rotuloGravacao[gravacao]

  return (
    <div className="flex flex-col gap-space-sm">
      {/* barra de controle */}
      <div className="sticky top-16 z-20 -mx-gutter flex flex-col gap-space-sm bg-surface/95 px-gutter pb-space-sm pt-space-sm backdrop-blur">
        <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md shadow-sm">
          <div className="flex flex-wrap items-center gap-space-sm">
            <button type="button" onClick={() => void sair()} className="flex items-center gap-1 rounded-lg px-2 py-1.5 font-label-md text-label-md text-primary hover:bg-surface-container-low" title="Salvar e voltar para a lista">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span> Processos
            </button>
            <input
              value={proc.nome}
              maxLength={160}
              onChange={(e) => alterar((p) => ({ ...p, nome: e.target.value }))}
              onBlur={() => !proc.nome.trim() && alterar((p) => ({ ...p, nome: 'Processo sem nome' }))}
              className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-headline-sm text-headline-sm text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none focus:ring-1 focus:ring-secondary"
              aria-label="Nome do processo"
            />
            <span className={`flex items-center gap-1 text-body-sm ${rg.cls}`}>
              <span className={`material-symbols-outlined text-[16px] ${gravacao === 'salvando' ? 'animate-spin' : ''}`}>{rg.icon}</span>
              {rg.txt}
            </span>
          </div>

          {gravacao === 'conflito' && (
            <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container">
              <span>Outra pessoa gravou este processo enquanto você editava. Suas últimas alterações ainda não foram salvas.</span>
              <span className="flex gap-space-sm">
                <button type="button" onClick={() => void recarregar()} className="rounded-lg bg-white/70 px-3 py-1 font-label-md text-label-md hover:bg-white">
                  Descartar as minhas e recarregar
                </button>
                <button type="button" onClick={() => void sobrescrever()} className="rounded-lg bg-error px-3 py-1 font-label-md text-label-md text-on-error">
                  Gravar as minhas por cima
                </button>
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-space-md">
            <label className="flex w-28 flex-col gap-1">
              <span className={labelCls}>Margem</span>
              <MargemInput value={proc.margem} onChange={(margem) => alterar((p) => ({ ...p, margem }))} />
            </label>
            <label className="flex w-60 flex-col gap-1">
              <span className={labelCls}>Arredondamento</span>
              <ArredondamentoSelect value={proc.arredondamento} onChange={(arredondamento) => alterar((p) => ({ ...p, arredondamento }))} />
            </label>
            <label className="flex min-w-[220px] flex-1 flex-col gap-1">
              <span className={labelCls}>Edital vinculado</span>
              <EditalPicker editais={editais} value={proc.editalId} onChange={(editalId) => alterar((p) => ({ ...p, editalId }))} dica={proc.nome} />
            </label>
            <div className="flex w-44 flex-col gap-1">
              <span className={`${labelCls} flex justify-between`}>
                <span>Progresso</span>
                <span className="text-primary">
                  {concluidos}/{proc.linhas.length}
                </span>
              </span>
              <div className="flex h-9 items-center">
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container">
                  <div className="h-full rounded-full bg-secondary transition-all" style={{ width: `${progresso}%` }} />
                </div>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-space-sm">
              <label className="flex cursor-pointer items-center gap-1 rounded-lg bg-surface-container-low px-space-md py-2 font-label-md text-label-md text-primary hover:bg-surface-container" title="Planilha com Lote, Item e Quantidade">
                <span className="material-symbols-outlined text-[18px]">upload_file</span> Importar quantidades
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void importarQtd(f)
                  }}
                />
              </label>
              <div className="relative">
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => setMenuExport((v) => !v)}
                  className="flex items-center gap-1 rounded-lg bg-primary px-space-md py-2 font-label-md text-label-md text-on-primary hover:bg-primary-hover disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span> {ocupado ? 'Exportando…' : 'Exportar'}
                  <span className="material-symbols-outlined text-[18px]">expand_more</span>
                </button>
                {menuExport && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuExport(false)} />
                    <div className="absolute right-0 top-11 z-40 w-72 overflow-hidden rounded-xl bg-surface-container-lowest py-1 shadow-xl ring-1 ring-black/10">
                      {(
                        [
                          ['ambas', 'Proposta + Disputa', 'As duas planilhas para o portal'],
                          ['proposta', 'Proposta', 'Lote, item, marca, modelo e valor'],
                          ['disputa', 'Disputa', 'Valor limite por lote'],
                          ['completa', 'Planilha completa', 'Tudo o que foi preenchido, para conferência'],
                        ] as const
                      ).map(([k, t, d]) => (
                        <button key={k} type="button" onClick={() => void exportar(k)} className="flex w-full flex-col px-4 py-2 text-left hover:bg-primary/10">
                          <span className="font-label-md text-label-md text-on-surface">{t}</span>
                          <span className="text-[11px] text-outline">{d}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* pendências */}
        {comPendencia.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg bg-[#fff7ed] px-space-md py-1.5 text-body-sm text-[#9a3412]">
            <span className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span className="truncate">
                <b>{comPendencia.length}</b> pendência(s) • {pendAtual + 1} de {comPendencia.length}: lote {proc.linhas[comPendencia[pendAtual]]?.lote}, item{' '}
                {proc.linhas[comPendencia[pendAtual]]?.item} — falta {pendencias[comPendencia[pendAtual]]?.join(', ')}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <button type="button" onClick={() => navegarPend(-1)} className="rounded-lg bg-white/70 px-2 py-0.5 font-label-md text-label-md hover:bg-white">
                ‹ Anterior
              </button>
              <button type="button" onClick={() => navegarPend(1)} className="rounded-lg bg-white/70 px-2 py-0.5 font-label-md text-label-md hover:bg-white">
                Próxima ›
              </button>
              <IrPara irPara={irPara} setIrPara={setIrPara} total={proc.linhas.length} onIr={mostrarLinha} />
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-space-sm rounded-lg bg-secondary-container px-space-md py-1.5 text-body-sm text-on-secondary-container">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">task_alt</span> Tudo preenchido — pode exportar.
            </span>
            <IrPara irPara={irPara} setIrPara={setIrPara} total={proc.linhas.length} onIr={mostrarLinha} />
          </div>
        )}
      </div>

      {/* cabeçalho das colunas */}
      <div className="hidden grid-cols-[92px_minmax(0,1.3fr)_minmax(0,1fr)_72px_104px_118px_150px] gap-x-space-sm px-space-sm font-label-sm text-label-sm uppercase text-outline md:grid">
        <span>Item</span>
        <span>Modelo</span>
        <span>Marca</span>
        <span className="text-center">Qtd.</span>
        <span className="text-right">Ref. unit.</span>
        <span className="text-right">Custo</span>
        <span className="text-right">Preço unit. / total</span>
      </div>

      {/* linhas agrupadas por lote */}
      <div className="flex flex-col gap-1 pb-space-xl">
        {proc.linhas.map((l, i) => {
          const novoLote = i === 0 || proc.linhas[i - 1].lote !== l.lote
          const r = lotes.get(l.lote)!
          const sit = situacao(r.disputa, r.refDisputa)
          const vr = variacao(r.disputa, r.refDisputa)
          return (
            <Fragment key={i}>
              {novoLote && (
                <div className="mt-space-sm flex flex-wrap items-center justify-between gap-space-sm rounded-lg bg-surface-container px-space-md py-1.5">
                  <span className="flex items-center gap-space-md">
                    <span className="font-label-md text-label-md font-bold uppercase text-on-surface">Lote {l.lote}</span>
                    <span className="text-body-sm text-outline">{r.itens} item(ns)</span>
                    <span className="flex items-center gap-1.5 text-body-sm">
                      <span className={r.global ? 'text-outline' : 'font-semibold text-on-surface'}>Unitário</span>
                      <Interruptor ligado={r.global} onClick={() => alternarGlobal(l.lote)} title="Disputa pelo valor unitário ou pelo valor global do lote" />
                      <span className={r.global ? 'font-semibold text-on-surface' : 'text-outline'}>Global</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-space-md text-body-sm">
                    <span className="text-outline">
                      Ref.: <span className="font-data-mono">{fmtBrl(r.refDisputa)}</span>
                    </span>
                    <span className={`rounded-lg px-2 py-0.5 font-data-mono font-bold ${CORES_SITUACAO[sit]}`} title={r.global ? 'Soma de unitário × quantidade' : 'Soma dos valores unitários'}>
                      Disputa {fmtBrl(r.disputa)}
                      {vr !== null && <span className="ml-1 text-[11px] font-semibold">({vr > 0 ? '+' : ''}{fmt2(vr)}%)</span>}
                    </span>
                  </span>
                </div>
              )}
              <LinhaItem
                index={i}
                total={proc.linhas.length}
                linha={l}
                margem={proc.margem}
                arred={proc.arredondamento}
                cat={cat}
                pendencias={pendencias[i]}
                onChange={mudarLinha}
              />
            </Fragment>
          )
        })}

        <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm rounded-xl bg-primary px-space-lg py-space-md text-on-primary">
          <span className="font-label-md text-label-md uppercase">Total geral (unitário × quantidade)</span>
          <span className="flex items-center gap-space-lg">
            <span className="text-body-sm opacity-80">Ref.: {fmtBrl(totalGeral.ref)}</span>
            <span className="font-data-mono text-[18px] font-bold">{fmtBrl(totalGeral.v)}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function IrPara({ irPara, setIrPara, total, onIr }: { irPara: string; setIrPara: (v: string) => void; total: number; onIr: (i: number) => void }) {
  return (
    <span className="ml-space-sm flex items-center gap-1 text-body-sm">
      Ir para
      <input
        value={irPara}
        inputMode="numeric"
        onChange={(e) => setIrPara(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => {
          const n = Number(irPara)
          if (e.key === 'Enter' && n >= 1 && n <= total) onIr(n - 1)
        }}
        className="h-6 w-14 rounded bg-white/80 text-center font-data-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
        placeholder="nº"
      />
      <span className="opacity-70">/ {total}</span>
    </span>
  )
}
