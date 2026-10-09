import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { PrecifCatalogo } from '../../shared'
import { api } from '../../lib/api'
import { importarCatalogo } from '../../lib/precos'
import { input } from '../Modals'

interface Props {
  podeExcluir: boolean
  notify: (msg: string, error?: boolean) => void
  onErro: (e: unknown) => void
  onVoltar: () => void
}

interface Item {
  id: number
  nome: string
  uso: number
  extra?: number
}

const MAX_LISTA = 300

/** Uma coluna (marcas ou modelos): busca, cadastro, renomear e excluir na própria linha. */
function Coluna({
  titulo,
  itens,
  selecionado,
  onSelecionar,
  onCriar,
  onRenomear,
  onExcluir,
  desabilitada,
  vazio,
  extraLabel,
  placeholderNovo,
}: {
  titulo: string
  placeholderNovo: string
  itens: Item[]
  selecionado?: number | null
  onSelecionar?: (id: number) => void
  onCriar: (nome: string) => Promise<boolean>
  onRenomear: (id: number, nome: string) => Promise<boolean>
  onExcluir?: (it: Item) => void
  desabilitada?: boolean
  vazio: string
  extraLabel?: string
}) {
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState('')
  const [editando, setEditando] = useState<{ id: number; nome: string } | null>(null)

  const filtrados = useMemo(() => {
    const q = busca.trim().toUpperCase()
    return q ? itens.filter((i) => i.nome.includes(q)) : itens
  }, [itens, busca])

  const criar = async (e: FormEvent) => {
    e.preventDefault()
    if (novo.trim() && (await onCriar(novo))) setNovo('')
  }

  return (
    <section className={`flex min-h-[480px] flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm ${desabilitada ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm">
        <h2 className="font-label-md text-label-md font-bold uppercase text-primary">{titulo}</h2>
        <span className="font-data-mono text-[11px] text-outline">{itens.length}</span>
      </div>
      {desabilitada ? (
        <div className="m-space-md flex flex-1 items-center justify-center rounded-lg border border-dashed border-outline-variant text-body-sm text-outline">{vazio}</div>
      ) : (
        <>
          <form onSubmit={criar} className="flex gap-space-sm px-space-md pt-space-md">
            <input value={novo} onChange={(e) => setNovo(e.target.value.toUpperCase())} placeholder={placeholderNovo} className={`${input} uppercase`} maxLength={120} />
            <button type="submit" className="flex items-center rounded-lg bg-primary px-3 text-on-primary disabled:opacity-60" disabled={!novo.trim()} title="Adicionar">
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </form>
          <div className="relative px-space-md pt-space-sm">
            <span className="material-symbols-outlined pointer-events-none absolute left-[22px] top-1/2 mt-1 -translate-y-1/2 text-[18px] text-outline">search</span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" className={`${input} pl-9 uppercase`} />
          </div>
          <ul className="mt-space-sm max-h-[60vh] flex-1 overflow-y-auto px-space-sm pb-space-sm">
            {filtrados.length === 0 && <li className="p-space-md text-center text-body-sm text-outline">{busca ? 'Nada encontrado.' : 'Nenhum item.'}</li>}
            {filtrados.slice(0, MAX_LISTA).map((it) => {
              const sel = selecionado === it.id
              if (editando?.id === it.id) {
                return (
                  <li key={it.id} className="px-1 py-0.5">
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (await onRenomear(it.id, editando.nome)) setEditando(null)
                      }}
                      className="flex gap-1"
                    >
                      <input
                        autoFocus
                        value={editando.nome}
                        onChange={(e) => setEditando({ id: it.id, nome: e.target.value.toUpperCase() })}
                        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setEditando(null))}
                        className={`${input} uppercase`}
                        maxLength={120}
                      />
                      <button type="submit" className="rounded-lg bg-primary px-2 text-on-primary" title="Salvar">
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </button>
                      <button type="button" onClick={() => setEditando(null)} className="rounded-lg px-2 text-outline hover:bg-surface-container" title="Cancelar">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </form>
                  </li>
                )
              }
              return (
                <li key={it.id}>
                  <div
                    role={onSelecionar ? 'button' : undefined}
                    tabIndex={onSelecionar ? 0 : undefined}
                    onClick={() => onSelecionar?.(it.id)}
                    onKeyDown={(e) => e.key === 'Enter' && onSelecionar?.(it.id)}
                    className={`group flex items-center gap-space-sm rounded-lg px-space-sm py-1.5 ${onSelecionar ? 'cursor-pointer' : ''} ${
                      sel ? 'bg-primary-container text-on-primary-container' : 'hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate font-label-md text-[13px] uppercase">{it.nome}</span>
                    {it.extra !== undefined && (
                      <span className="rounded bg-surface-container px-1.5 font-data-mono text-[10px] text-on-surface" title={extraLabel}>
                        {it.extra}
                      </span>
                    )}
                    <span className="font-data-mono text-[10px] text-outline" title="Vezes usada em processos exportados">
                      ×{it.uso}
                    </span>
                    <span className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        title="Renomear"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditando({ id: it.id, nome: it.nome })
                        }}
                        className="rounded p-1 text-outline hover:bg-surface-container hover:text-primary"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {onExcluir && (
                        <button
                          type="button"
                          title="Excluir"
                          onClick={(e) => {
                            e.stopPropagation()
                            onExcluir(it)
                          }}
                          className="rounded p-1 text-outline hover:bg-error-container hover:text-error"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </span>
                  </div>
                </li>
              )
            })}
            {filtrados.length > MAX_LISTA && <li className="p-space-sm text-center text-[11px] text-outline">Mostrando {MAX_LISTA} de {filtrados.length}. Use a busca.</li>}
          </ul>
        </>
      )}
    </section>
  )
}

/** Cadastro de marcas e modelos usado pelas sugestões do Precificador. */
export default function CatalogoPage({ podeExcluir, notify, onErro, onVoltar }: Props) {
  const [cat, setCat] = useState<PrecifCatalogo | null>(null)
  const [marcaSel, setMarcaSel] = useState<number | null>(null)
  const [importando, setImportando] = useState(false)

  const carregar = useCallback(() => {
    api.precifCatalogo().then(setCat).catch(onErro)
  }, [onErro])
  useEffect(carregar, [carregar])

  /** Executa a chamada, troca o catálogo pelo devolvido e avisa. */
  const fazer = async (fn: () => Promise<PrecifCatalogo>, ok: string): Promise<boolean> => {
    try {
      setCat(await fn())
      notify(ok)
      return true
    } catch (e) {
      onErro(e)
      return false
    }
  }

  const modelosPorMarca = useMemo(() => {
    const m = new Map<number, number>()
    for (const md of cat?.modelos ?? []) m.set(md.marcaId, (m.get(md.marcaId) ?? 0) + 1)
    return m
  }, [cat])

  const marcas: Item[] = useMemo(() => [...(cat?.marcas ?? [])].sort((a, b) => a.nome.localeCompare(b.nome)).map((m) => ({ ...m, extra: modelosPorMarca.get(m.id) ?? 0 })), [cat, modelosPorMarca])
  const modelos: Item[] = useMemo(() => (cat?.modelos ?? []).filter((m) => m.marcaId === marcaSel).sort((a, b) => a.nome.localeCompare(b.nome)), [cat, marcaSel])
  const marcaAtual = cat?.marcas.find((m) => m.id === marcaSel)

  useEffect(() => {
    if (cat && marcaSel !== null && !cat.marcas.some((m) => m.id === marcaSel)) setMarcaSel(null)
  }, [cat, marcaSel])

  const importar = async (f: File) => {
    setImportando(true)
    try {
      const linhas = await importarCatalogo(f)
      if (!linhas.length) return notify('A planilha não tem linhas com marca e modelo.', true)
      const r = await api.precifImportarCatalogo(linhas)
      setCat(r.catalogo)
      notify(`Importação concluída: ${r.marcasCriadas} marca(s) e ${r.modelosCriados} modelo(s) novos; ${r.ignorados} linha(s) já existiam ou estavam repetidas.`)
    } catch (e) {
      if (e instanceof Error && !('status' in e)) notify(e.message, true)
      else onErro(e)
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={onVoltar} className="flex w-fit items-center gap-1 font-label-sm text-label-sm uppercase tracking-widest text-secondary hover:underline">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span> Precificador
          </button>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Marcas e modelos</h1>
          <p className="max-w-2xl text-body-md text-on-surface-variant">
            Catálogo usado nas sugestões do Precificador (os mais usados aparecem primeiro). Marcas e modelos digitados num processo entram aqui sozinhos quando ele é
            exportado.
          </p>
        </div>
        <label
          className={`flex cursor-pointer items-center gap-space-xs rounded-lg bg-primary px-space-md py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-hover ${importando ? 'pointer-events-none opacity-60' : ''}`}
          title='Planilha com as colunas "Marca" e "Modelo"'
        >
          <span className="material-symbols-outlined text-[18px]">upload_file</span> {importando ? 'Importando…' : 'Importar planilha'}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void importar(f)
            }}
          />
        </label>
      </div>

      {!cat ? (
        <div className="py-space-xl text-center text-outline">Carregando…</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-space-lg md:grid-cols-2">
          <Coluna
            titulo="Marcas"
            placeholderNovo="Nova marca…"
            itens={marcas}
            selecionado={marcaSel}
            onSelecionar={setMarcaSel}
            extraLabel="Modelos cadastrados"
            vazio=""
            onCriar={(nome) => fazer(() => api.precifCriarMarca(nome), 'Marca cadastrada.')}
            onRenomear={(id, nome) => fazer(() => api.precifEditarMarca(id, nome), 'Marca renomeada.')}
            onExcluir={
              podeExcluir
                ? (it) => {
                    const n = modelosPorMarca.get(it.id) ?? 0
                    if (confirm(`Excluir a marca ${it.nome}${n ? ` e os ${n} modelo(s) dela` : ''}? Os processos já preenchidos não mudam.`)) {
                      void fazer(() => api.precifExcluirMarca(it.id), 'Marca excluída.')
                    }
                  }
                : undefined
            }
          />
          <Coluna
            key={marcaSel ?? 'nenhuma'}
            titulo={marcaAtual ? `Modelos — ${marcaAtual.nome}` : 'Modelos'}
            placeholderNovo="Novo modelo…"
            itens={modelos}
            desabilitada={!marcaAtual}
            vazio="Escolha uma marca para ver e cadastrar os modelos dela."
            onCriar={(nome) => (marcaSel === null ? Promise.resolve(false) : fazer(() => api.precifCriarModelo(marcaSel, nome), 'Modelo cadastrado.'))}
            onRenomear={(id, nome) => fazer(() => api.precifEditarModelo(id, nome), 'Modelo renomeado.')}
            onExcluir={
              podeExcluir
                ? (it) => {
                    if (confirm(`Excluir o modelo ${it.nome}?`)) void fazer(() => api.precifExcluirModelo(it.id), 'Modelo excluído.')
                  }
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}
