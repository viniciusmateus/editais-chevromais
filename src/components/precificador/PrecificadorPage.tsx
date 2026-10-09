import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { Arredondamento, Edital, PrecifCatalogo, PrecifLinha, PrecifProcesso, PrecifProcessoResumo } from '../../shared'
import { api } from '../../lib/api'
import { fmtTs } from '../../lib/utils'
import { fmt2, importarItens } from '../../lib/precos'
import { Actions, Field, Modal, btnPrimary, input } from '../Modals'
import { ArredondamentoSelect, Calculadora, MargemInput } from './campos'
import ProcessoEditor, { rotuloEdital } from './ProcessoEditor'

interface Props {
  editais: Edital[]
  podeExcluir: boolean
  notify: (msg: string, error?: boolean) => void
  /** trata erros da API (401 desloga; o resto vira aviso) */
  onErro: (e: unknown) => void
  /** abre a tela de marcas e modelos */
  onCatalogo: () => void
}

/** Precificador: lista de processos salvos, novo processo a partir da planilha do edital e calculadora rápida. */
export default function PrecificadorPage({ editais, podeExcluir, notify, onErro, onCatalogo }: Props) {
  const [catalogo, setCatalogo] = useState<PrecifCatalogo | null>(null)
  const [processos, setProcessos] = useState<PrecifProcessoResumo[] | null>(null)
  const [aberto, setAberto] = useState<PrecifProcesso | null>(null)
  const [novo, setNovo] = useState(false)
  const [busca, setBusca] = useState('')
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  const carregar = useCallback(() => {
    setErroCarga(null)
    Promise.all([api.precifCatalogo(), api.precifProcessos()])
      .then(([c, p]) => {
        setCatalogo(c)
        setProcessos(p)
      })
      .catch((e: Error) => {
        setErroCarga(e.message)
        onErro(e)
      })
  }, [onErro])
  useEffect(carregar, [carregar])

  const abrir = async (id: number) => {
    try {
      const [p, c] = await Promise.all([api.precifProcesso(id), api.precifCatalogo()])
      setCatalogo(c)
      setAberto(p)
      window.scrollTo({ top: 0 })
    } catch (e) {
      onErro(e)
    }
  }

  const excluir = async (p: PrecifProcessoResumo) => {
    if (!confirm(`Excluir o processo "${p.nome}"? Esta ação não pode ser desfeita.`)) return
    try {
      await api.precifExcluirProcesso(p.id)
      setProcessos((l) => l?.filter((x) => x.id !== p.id) ?? l)
      notify('Processo excluído.')
    } catch (e) {
      onErro(e)
    }
  }

  const editalDe = useMemo(() => new Map(editais.map((e) => [e.id, e])), [editais])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!processos) return []
    if (!q) return processos
    return processos.filter((p) => {
      const e = p.editalId !== null ? editalDe.get(p.editalId) : undefined
      return [p.nome, e?.num ?? '', e?.orgao ?? '', p.atualizadoPor].some((v) => v.toLowerCase().includes(q))
    })
  }, [processos, busca, editalDe])

  if (aberto && catalogo) {
    return (
      <ProcessoEditor
        key={aberto.id}
        inicial={aberto}
        catalogo={catalogo}
        onCatalogo={setCatalogo}
        editais={editais}
        notify={notify}
        onErro={onErro}
        onSair={() => {
          setAberto(null)
          carregar()
        }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div className="flex flex-col justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:flex-row xl:items-center">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-space-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
            <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">Disputa</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Precificador</h1>
          <p className="max-w-2xl text-body-md text-on-surface-variant">
            Importe a planilha de itens do edital, escolha modelo e marca, informe o custo e a margem: o sistema calcula os preços, compara com a referência e
            gera as planilhas de proposta e de disputa. Os processos ficam salvos no servidor e qualquer usuário pode continuar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            type="button"
            onClick={onCatalogo}
            className="flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-2 font-label-md text-label-md text-primary hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span> Marcas e modelos
          </button>
          <button
            type="button"
            onClick={() => setNovo(true)}
            disabled={!catalogo}
            className="flex items-center gap-space-xs rounded-lg bg-primary px-space-md py-2 font-label-md text-label-md text-on-primary shadow-sm hover:bg-primary-hover disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[18px]">upload_file</span> Novo processo (importar planilha)
          </button>
        </div>
      </div>

      {erroCarga && (
        <div className="flex items-center justify-between gap-space-md rounded-xl bg-error-container px-space-lg py-space-md text-body-md text-on-error-container">
          <span>{erroCarga}</span>
          <button type="button" onClick={carregar} className="rounded-lg bg-white/70 px-3 py-1 font-label-md text-label-md">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
        <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm xl:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <h2 className="flex items-center gap-2 font-headline-sm text-headline-sm text-primary">
              <span className="material-symbols-outlined">folder_open</span> Processos salvos
            </h2>
            <div className="relative w-72">
              <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">search</span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, edital ou usuário…" className={`${input} pl-9`} />
            </div>
          </div>

          {processos === null && !erroCarga && <div className="py-space-xl text-center text-outline">Carregando…</div>}
          {processos !== null && filtrados.length === 0 && (
            <div className="rounded-lg border border-dashed border-outline-variant p-space-xl text-center text-outline">
              {processos.length ? 'Nenhum processo encontrado.' : 'Nenhum processo ainda. Comece importando a planilha de itens de um edital.'}
            </div>
          )}
          <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
            {filtrados.map((p) => {
              const pct = p.total ? Math.round((p.concluidos / p.total) * 100) : 0
              const e = p.editalId !== null ? editalDe.get(p.editalId) : undefined
              return (
                <div key={p.id} className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-label-md text-[14px] font-bold text-on-surface" title={p.nome}>
                        {p.nome}
                      </h3>
                      <p className="truncate text-[12px] text-outline">{e ? `Edital ${rotuloEdital(e)}` : p.editalId !== null ? `Edital #${p.editalId} (excluído)` : 'Sem edital vinculado'}</p>
                    </div>
                    <span className="shrink-0 rounded bg-surface-container px-1.5 py-0.5 font-data-mono text-[11px] text-on-surface">{fmt2(p.margem)}%</span>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-outline">
                      <span>
                        {p.concluidos} de {p.total} itens
                      </span>
                      <span className={pct === 100 ? 'font-bold text-secondary' : 'font-semibold text-primary'}>{pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-container">
                      <div className={`h-full rounded-full ${pct === 100 ? 'bg-secondary' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-[11px] text-outline">
                    {p.atualizadoPor ? `${p.atualizadoPor} • ` : ''}
                    {fmtTs(p.atualizadoEm)}
                  </p>
                  <div className="mt-auto flex gap-space-sm">
                    <button type="button" onClick={() => void abrir(p.id)} className={`flex-1 ${btnPrimary}`}>
                      Continuar
                    </button>
                    {podeExcluir && (
                      <button type="button" onClick={() => void excluir(p)} title="Excluir processo" className="rounded-lg px-2 text-outline hover:bg-error-container hover:text-error">
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="flex flex-col gap-space-lg xl:col-span-4">
          <section className="flex flex-col gap-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
            <h2 className="flex items-center gap-2 font-headline-sm text-headline-sm text-primary">
              <span className="material-symbols-outlined">calculate</span> Calculadora rápida
            </h2>
            <Calculadora />
            <p className="text-[11px] text-outline">Preço = custo × (1 + margem). O custo aceita contas, ex.: 120+15,5.</p>
          </section>
          <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg text-body-sm text-on-surface-variant shadow-sm">
            <h2 className="flex items-center gap-2 font-label-md text-label-md uppercase text-primary">
              <span className="material-symbols-outlined text-[18px]">table_view</span> Planilha de itens
            </h2>
            <p>
              Primeira linha com os títulos <b>Lote</b>, <b>Item</b>, <b>Valor de referência</b> e, se tiver, <b>Quantidade</b> e <b>Descrição</b>. Sem títulos, o sistema usa as
              colunas A = lote, B = item, C = referência, D = quantidade.
            </p>
            <p>Lotes com mais de um item começam como <b>Global</b> (disputa pela soma de unitário × quantidade); dá para trocar em cada lote.</p>
          </section>
        </aside>
      </div>

      {novo && (
        <NovoProcessoModal
          editais={editais}
          onClose={() => setNovo(false)}
          onCriar={async (v) => {
            try {
              const p = await api.precifCriarProcesso(v)
              setNovo(false)
              setAberto(p)
              notify(`Processo criado com ${p.linhas.length} itens.`)
              return true
            } catch (e) {
              onErro(e)
              return false
            }
          }}
        />
      )}
    </div>
  )
}

function NovoProcessoModal({
  editais,
  onClose,
  onCriar,
}: {
  editais: Edital[]
  onClose: () => void
  onCriar: (v: { nome: string; editalId: number | null; margem: number; arredondamento: Arredondamento; globais: string[]; linhas: PrecifLinha[] }) => Promise<boolean>
}) {
  const [arquivo, setArquivo] = useState<{ nome: string; linhas: PrecifLinha[]; globais: string[] } | null>(null)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')
  const [editalId, setEditalId] = useState('')
  const [margem, setMargem] = useState(0)
  const [arred, setArred] = useState<Arredondamento>('centavo')
  const [busy, setBusy] = useState(false)
  const ordenados = useMemo(() => [...editais].sort((a, b) => b.id - a.id), [editais])

  const ler = async (f: File) => {
    setErro('')
    try {
      const r = await importarItens(f)
      const base = f.name.replace(/\.[^.]+$/, '')
      setArquivo({ nome: base, ...r })
      setNome((n) => n || base)
    } catch (e) {
      setArquivo(null)
      setErro(e instanceof Error ? e.message : 'Não foi possível ler a planilha.')
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!arquivo) return setErro('Escolha a planilha de itens.')
    setBusy(true)
    await onCriar({ nome: nome.trim() || arquivo.nome, editalId: editalId ? Number(editalId) : null, margem, arredondamento: arred, globais: arquivo.globais, linhas: arquivo.linhas })
    setBusy(false)
  }

  const lotes = arquivo ? new Set(arquivo.linhas.map((l) => l.lote)).size : 0

  return (
    <Modal title="Novo processo de precificação" icon="upload_file" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-1 gap-space-md">
        <Field label="Planilha de itens (.xlsx)" semLabel>
          <label className="flex cursor-pointer items-center gap-space-sm rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-space-md py-space-md hover:bg-surface-container">
            <span className="material-symbols-outlined text-primary">attach_file</span>
            <span className="text-body-md">
              {arquivo ? (
                <>
                  <b>{arquivo.nome}</b> — {arquivo.linhas.length} itens em {lotes} lote(s)
                </>
              ) : (
                'Clique para escolher o arquivo'
              )}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void ler(f)
              }}
            />
          </label>
        </Field>
        {erro && <p className="rounded-lg bg-error-container px-space-md py-space-sm text-body-sm text-on-error-container">{erro}</p>}
        <Field label="Nome do processo">
          <input required maxLength={160} className={input} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pregão 90012/2026 — Prefeitura de Curitiba" />
        </Field>
        <Field label="Edital vinculado (opcional)">
          <select className={input} value={editalId} onChange={(e) => setEditalId(e.target.value)}>
            <option value="">— Nenhum —</option>
            {ordenados.map((e) => (
              <option key={e.id} value={e.id}>
                {rotuloEdital(e)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field label="Margem">
            <MargemInput value={margem} onChange={setMargem} />
          </Field>
          <Field label="Arredondamento">
            <ArredondamentoSelect value={arred} onChange={setArred} />
          </Field>
        </div>
        <Actions onClose={onClose} busy={busy} submit="Criar e começar" />
      </form>
    </Modal>
  )
}
