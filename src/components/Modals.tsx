import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  MODALIDADES,
  RESULTADOS,
  type CategoriaCfg,
  type Edital,
  type EditalInput,
  type Modalidade,
  type Papel,
  type Portal,
  type PublicUser,
  type Resultado,
  type StatusCfg,
  type Transicao,
  type ImpugnacaoCfg,
  type ImpugStatusCfg,
  type EditalImpugnacao,
} from '../shared'
import type { NewUser, UserPatch } from '../lib/api'
import { brl, fmtTs, moneyToInput, parseMoney, regrasDoPortal, statusInfo } from '../lib/utils'
import { DateInput, TimeInput } from './Inputs'

export const input =
  'w-full h-9 px-3 rounded-lg bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary'
export const labelCls = 'font-label-sm text-label-sm text-outline uppercase tracking-wider'
export const btnPrimary = 'rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary disabled:opacity-60'
export const btnGhost = 'rounded-lg bg-surface-container-low px-4 py-2 font-label-md text-label-md text-primary'

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  )
}

export function Modal({
  title,
  icon,
  onClose,
  wide,
  children,
}: {
  title: string
  icon: string
  onClose: () => void
  wide?: boolean
  children: ReactNode
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={`max-h-[90vh] w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} overflow-y-auto rounded-xl bg-surface-container-lowest p-space-lg shadow-xl`}>
        <div className="mb-space-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">{icon}</span>
            <h2 className="font-headline-sm text-headline-sm text-primary">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Actions({ onClose, busy, submit, danger }: { onClose: () => void; busy: boolean; submit: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-space-sm pt-space-sm">
      <button type="button" onClick={onClose} className={btnGhost}>
        Cancelar
      </button>
      <button
        type="submit"
        disabled={busy}
        className={`rounded-lg px-4 py-2 font-label-md text-label-md text-white disabled:opacity-60 ${danger ? 'bg-error' : 'bg-primary'}`}
      >
        {busy ? 'Salvando…' : submit}
      </button>
    </div>
  )
}

// ---------- Mudança de status (botões Avançar / Negativo) ----------
export function TransicaoModal({
  edital,
  transicao,
  statuses,
  impugnacoes,
  impugStatuses,
  onSave,
  onClose,
}: {
  edital: Edital
  transicao: Transicao
  statuses: StatusCfg[]
  impugnacoes: ImpugnacaoCfg[]
  impugStatuses: ImpugStatusCfg[]
  onSave: (v: { motivo?: string; valor?: number; impugRespostas?: Record<string, string> }) => Promise<boolean>
  onClose: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [resp, setResp] = useState<Record<string, string>>(() => Object.fromEntries(edital.impugnacoes.map((i) => [i.id, i.status])))
  const [valor, setValor] = useState(moneyToInput(transicao.exige === 'valorGanho' ? edital.valorGanho : edital.valorHomologado))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const de = statuses.find((s) => s.id === transicao.de)?.nome ?? transicao.de
  const para = statuses.find((s) => s.id === transicao.para)?.nome ?? transicao.para
  const comValor = transicao.exige === 'valorGanho' || transicao.exige === 'valorHomologado'
  const comImpugs = transicao.exige === 'impugnacoes' && edital.impugnacoes.length > 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    let v: number | undefined
    if (comValor) {
      const n = parseMoney(valor)
      if (n === null || !(n > 0)) return setErr('Informe o valor total (maior que zero). Ex.: 15000, 15.000,50')
      v = n
    }
    if (comImpugs && edital.impugnacoes.some((i) => !resp[i.id])) return setErr('Informe o resultado de todas as impugnações.')
    setErr(null)
    setBusy(true)
    const ok = await onSave(transicao.exige === 'motivo' ? { motivo: motivo.trim() } : comValor ? { valor: v } : comImpugs ? { impugRespostas: resp } : {})
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal title={transicao.rotulo} icon={transicao.negativo ? 'block' : 'arrow_circle_right'} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-space-md">
        <p className="text-body-sm text-on-surface-variant">
          Edital <b>{edital.num || `#${edital.id}`}</b>
          {edital.orgao ? ` • ${edital.orgao}` : ''}. O status muda de <b>{de}</b> para <b>{para}</b> e fica registrado no histórico.
        </p>
        {transicao.exige === 'motivo' && (
          <Field label="Motivo *">
            <textarea required autoFocus rows={4} maxLength={500} className={`${input} h-auto py-2`} placeholder="Descreva o motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </Field>
        )}
        {comValor && (
          <Field label={transicao.exige === 'valorGanho' ? 'Valor total ganho (R$) *' : 'Valor total homologado (R$) *'}>
            <input required autoFocus inputMode="decimal" autoComplete="off" className={input} placeholder="Ex.: 15.000,50" value={valor} onChange={(e) => setValor(e.target.value)} />
          </Field>
        )}
        {comImpugs && (
          <div className="flex flex-col gap-space-sm">
            <span className={labelCls}>Resultado das impugnações *</span>
            {edital.impugnacoes.map((i) => {
              const cfg = impugnacoes.find((x) => x.id === i.id)
              return (
                <div key={i.id} className="flex flex-col gap-1 rounded-lg bg-surface-container-low p-space-sm">
                  <span className="flex items-center gap-1.5 font-label-md text-label-md font-semibold">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cfg?.cor ?? '#64748b' }} />
                    {cfg?.nome ?? i.id}
                  </span>
                  <select required className={input} value={resp[i.id] ?? ''} onChange={(e) => setResp((p) => ({ ...p, [i.id]: e.target.value }))}>
                    <option value="">Selecione…</option>
                    {impugStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              )
            })}
            {impugStatuses.length === 0 && <span className="text-[12px] text-error">Nenhum status de impugnação cadastrado (Configurações → Impugnações).</span>}
          </div>
        )}
        {err && <div className="rounded-lg bg-error-container/50 px-3 py-2 text-body-sm font-medium text-on-error-container">{err}</div>}
        <Actions onClose={onClose} busy={busy} submit="Confirmar" danger={transicao.negativo} />
      </form>
    </Modal>
  )
}

// ---------- Novo / editar edital ----------
export function EditalModal({
  initial,
  categorias,
  portais,
  statuses,
  impugnacoes,
  impugStatuses,
  onSave,
  onClose,
}: {
  initial?: Edital
  categorias: CategoriaCfg[]
  portais: Portal[]
  statuses: StatusCfg[]
  impugnacoes: ImpugnacaoCfg[]
  impugStatuses: ImpugStatusCfg[]
  onSave: (v: EditalInput) => Promise<boolean>
  onClose: () => void
}) {
  const [imps, setImps] = useState<EditalImpugnacao[]>(initial?.impugnacoes ?? [])
  const [listaImp, setListaImp] = useState(false)
  const alternarImp = (id: string) => setImps((l) => (l.some((i) => i.id === id) ? l.filter((i) => i.id !== id) : [...l, { id, status: '' }]))
  const [f, setF] = useState({
    // ao cadastrar a categoria começa vazia (para ninguém esquecer); ao editar mantém a que já está salva
    cat: initial?.cat ?? '',
    mod: (initial?.mod ?? 0) as Modalidade,
    num: initial?.num ?? '',
    uasg: initial?.uasg ?? '',
    orgao: initial?.orgao ?? '',
    cidade: initial?.cidade ?? '',
    uf: initial?.uf ?? '',
    valorGanho: moneyToInput(initial?.valorGanho ?? 0),
    valorHomologado: moneyToInput(initial?.valorHomologado ?? 0),
    portal: initial?.portal ?? '',
    data: initial?.data ?? '',
    hora: initial?.hora ?? '',
    status: initial?.status ?? 'PREP',
    resultado: (initial?.resultado ?? '') as Resultado,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))
  const [err, setErr] = useState<string | null>(null)

  // o portal escolhido define quais campos aparecem e quais são obrigatórios
  const regras = regrasDoPortal(portais, f.portal)
  const show = (k: keyof typeof regras) => regras[k] !== 'oculto'
  const req = (k: keyof typeof regras) => regras[k] === 'obrigatorio'
  const lbl = (text: string, k: keyof typeof regras) => (req(k) ? `${text} *` : text)
  // portal que já não está cadastrado (excluído/renomeado) continua aparecendo no edital que o usa
  const portalOrfao = f.portal && !portais.some((p) => p.nome === f.portal)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const valorGanho = parseMoney(f.valorGanho)
    if (valorGanho === null) return setErr('Valor ganho inválido. Use só números, por exemplo 15000, 15.000,50 ou 15000.50.')
    if (initial && req('valorGanho') && !(valorGanho > 0)) return setErr('Informe o valor ganho (campo obrigatório para este portal).')
    const valorHomologado = parseMoney(f.valorHomologado)
    if (valorHomologado === null) return setErr('Valor homologado inválido. Use só números, por exemplo 15000 ou 15.000,50.')
    setErr(null)
    setBusy(true)
    const ok = await onSave({ ...f, impugnacoes: imps, valorGanho, valorHomologado, uf: f.uf.toUpperCase() })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title={initial ? 'Editar Edital' : 'Novo Edital / Registro'} icon="post_add" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-space-md">
        <Field label="Portal da licitação">
          <select className={input} value={f.portal} onChange={(e) => set('portal', e.target.value)}>
            <option value="">Não informado</option>
            {portalOrfao && <option value={f.portal}>{f.portal} (não cadastrado)</option>}
            {portais.map((p) => (
              <option key={p.id} value={p.nome}>{p.nome}</option>
            ))}
          </select>
          <span className="text-[11px] text-outline">Os campos abaixo mudam conforme o portal. * = obrigatório.</span>
        </Field>
        <Field label="Categoria *">
          <select required className={input} value={f.cat} onChange={(e) => set('cat', e.target.value)}>
            <option value="">Selecione a categoria…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </Field>
        {show('mod') && (
          <Field label="Modalidade">
            <select className={input} value={f.mod} onChange={(e) => set('mod', Number(e.target.value) as Modalidade)}>
              {MODALIDADES.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </Field>
        )}
        {show('num') && (
          <Field label={lbl('Nº do Edital', 'num')}>
            <input required={req('num')} className={input} placeholder="PE 001/2026" value={f.num} onChange={(e) => set('num', e.target.value)} />
          </Field>
        )}
        {show('uasg') && (
          <Field label={lbl('UASG / Nº de identificação', 'uasg')}>
            <input required={req('uasg')} className={input} placeholder="Ex.: 158123 ou 158.123-4" value={f.uasg} onChange={(e) => set('uasg', e.target.value)} />
            <span className="text-[11px] text-outline">Aceita qualquer formato: números, decimais, traços e letras.</span>
          </Field>
        )}
        {show('orgao') && (
          <Field label={lbl('Órgão Comprador', 'orgao')} className="col-span-2">
            <input required={req('orgao')} className={input} value={f.orgao} onChange={(e) => set('orgao', e.target.value)} />
          </Field>
        )}
        {show('cidade') && (
          <Field label={lbl('Cidade', 'cidade')}>
            <input required={req('cidade')} maxLength={80} className={input} placeholder="Ex.: Londrina" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} />
          </Field>
        )}
        {show('uf') && (
          <Field label={lbl('UF', 'uf')}>
            <input required={req('uf')} maxLength={2} className={`${input} uppercase`} placeholder="PR" value={f.uf} onChange={(e) => set('uf', e.target.value)} />
          </Field>
        )}
        {show('data') && (
          <Field label={lbl('Data limite', 'data')}>
            <DateInput required={req('data')} className={input} value={f.data} onChange={(v) => set('data', v)} />
          </Field>
        )}
        {show('hora') && (
          <Field label={lbl('Horário (24h)', 'hora')}>
            <TimeInput required={req('hora')} className={input} value={f.hora} onChange={(v) => set('hora', v)} />
          </Field>
        )}
        <div className="col-span-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={labelCls}>Impugnações{imps.length ? ` (${imps.length})` : ''}</span>
            <button
              type="button"
              onClick={() => setListaImp((v) => !v)}
              title="Adicionar impugnações feitas"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary hover:bg-primary-hover"
            >
              <span className="material-symbols-outlined text-[18px]">{listaImp ? 'close' : 'add'}</span>
            </button>
          </div>
          {listaImp && (
            <div className="rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
              {impugnacoes.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">Nenhuma impugnação cadastrada. O administrador cadastra em Configurações → Impugnações.</p>
              ) : (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                  {impugnacoes.map((c) => {
                    const on = imps.some((i) => i.id === c.id)
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => alternarImp(c.id)}
                          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left font-label-md text-label-md ${on ? 'bg-primary-container font-semibold text-on-primary-container' : 'bg-surface-container-lowest hover:bg-surface-container'}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">{on ? 'check_box' : 'check_box_outline_blank'}</span>
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.cor }} />
                          {c.nome}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="flex justify-end pt-space-xs">
                <button type="button" onClick={() => setListaImp(false)} className={btnGhost}>Concluir</button>
              </div>
            </div>
          )}
          {imps.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {imps.map((i) => {
                const c = impugnacoes.find((x) => x.id === i.id)
                const st = impugStatuses.find((x) => x.id === i.status)
                return (
                  <span key={i.id} className="flex items-center gap-1.5 rounded-full py-0.5 pl-2.5 pr-1 text-[12px] font-semibold" style={{ background: `${c?.cor ?? '#64748b'}22`, color: c?.cor ?? '#64748b' }}>
                    {c?.nome ?? i.id}
                    {st && <span className="rounded-full px-1.5 text-[10px] font-bold text-white" style={{ background: st.cor }}>{st.nome}</span>}
                    <button type="button" aria-label="Remover" onClick={() => alternarImp(i.id)} className="flex h-4 w-4 items-center justify-center rounded-full hover:bg-black/10">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </span>
                )
              })}
            </div>
          ) : (
            !listaImp && <span className="text-[12px] text-outline">Nenhuma impugnação. Use o + para adicionar as que você fez.</span>
          )}
        </div>
        {initial && (
          <Field label="Status atual">
            <div className="flex h-9 items-center gap-2 rounded-lg bg-surface-container-low px-3">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: statusInfo(statuses, initial.status).cor }} />
              <span className="font-semibold">{statusInfo(statuses, initial.status).nome}</span>
            </div>
            <span className="text-[11px] text-outline">O status muda pelos botões Avançar / Negativo da tabela.</span>
          </Field>
        )}
        {initial && show('valorGanho') && (
          <Field label={lbl('Valor ganho (R$)', 'valorGanho')}>
            <input
              inputMode="decimal"
              autoComplete="off"
              required={req('valorGanho')}
              className={input}
              placeholder="Ex.: 15.000,50"
              value={f.valorGanho}
              onChange={(e) => set('valorGanho', e.target.value)}
            />
            <span className="text-[11px] text-outline">Aceita centavos. Deixe vazio enquanto não ganhou.</span>
          </Field>
        )}
        {initial && (
          <Field label="Valor homologado (R$)">
            <input
              inputMode="decimal"
              autoComplete="off"
              className={input}
              placeholder="Ex.: 15.000,50"
              value={f.valorHomologado}
              onChange={(e) => set('valorHomologado', e.target.value)}
            />
            <span className="text-[11px] text-outline">Preenchido ao homologar; use aqui só para corrigir.</span>
          </Field>
        )}
        {initial && show('resultado') && (
          <Field label="Resultado da licitação">
            <select
              className={`${input} font-semibold ${f.resultado === 'GANHAMOS' ? 'text-green-700' : f.resultado === 'PERDEMOS' ? 'text-red-700' : ''}`}
              value={f.resultado}
              onChange={(e) => set('resultado', e.target.value as Resultado)}
            >
              <option value="">Em andamento</option>
              <option value="GANHAMOS">{RESULTADOS.GANHAMOS}</option>
              <option value="PERDEMOS">{RESULTADOS.PERDEMOS}</option>
            </select>
          </Field>
        )}
        {err && <div className="col-span-2 rounded-lg bg-error-container/50 px-3 py-2 text-body-sm font-medium text-on-error-container">{err}</div>}
        <div className="col-span-2">
          <Actions onClose={onClose} busy={busy} submit="Salvar" />
        </div>
      </form>
    </Modal>
  )
}

// ---------- Registrar retificação ----------
export function RetifModal({
  editais,
  initialId,
  onSave,
  onClose,
}: {
  editais: Edital[]
  initialId?: number
  onSave: (id: number, v: { desc: string; data: string; hora: string }) => Promise<boolean>
  onClose: () => void
}) {
  const [id, setId] = useState<number>(initialId ?? editais[0].id)
  const [desc, setDesc] = useState('')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [busy, setBusy] = useState(false)

  // ao trocar de edital, preenche com a data/hora atuais dele (só quando o edital muda)
  useEffect(() => {
    const ed = editais.find((e) => e.id === id)
    setData(ed?.data ?? '')
    setHora(ed?.hora ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSave(id, { desc, data, hora })
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Modal title="Registrar Retificação" icon="published_with_changes" onClose={onClose}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-space-md">
        <Field label="Edital" className="col-span-2">
          <select className={input} value={id} onChange={(e) => setId(Number(e.target.value))}>
            {editais.map((e) => (
              <option key={e.id} value={e.id}>{e.num} — {e.orgao}</option>
            ))}
          </select>
        </Field>
        <Field label="Descrição da alteração" className="col-span-2">
          <textarea
            required
            rows={3}
            className={`${input} h-auto py-2`}
            placeholder="Ex.: Retificação 03 — inclusão de novo anexo técnico"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Field>
        <Field label="Nova data limite (opcional)">
          <DateInput className={input} value={data} onChange={setData} />
        </Field>
        <Field label="Novo horário 24h (opcional)">
          <TimeInput className={input} value={hora} onChange={setHora} />
        </Field>
        <div className="col-span-2">
          <Actions onClose={onClose} busy={busy} submit="Registrar" danger />
        </div>
      </form>
    </Modal>
  )
}

// ---------- Histórico ----------
export function HistModal({ edital, onClose }: { edital: Edital; onClose: () => void }) {
  return (
    <Modal title={`Histórico — ${edital.num}`} icon="history" onClose={onClose}>
      <p className="text-body-sm text-on-surface-variant">
        {edital.orgao}
      </p>
      <p className="mb-space-md mt-1 text-[11px] text-outline">
        Cadastrado por {edital.criadoPor || '—'}
        {edital.atualizadoEm ? ` • Última alteração por ${edital.atualizadoPor || '—'} em ${fmtTs(edital.atualizadoEm)}` : ''}
      </p>
      <h4 className="mb-space-xs font-label-sm text-label-sm font-bold uppercase tracking-wider text-outline">
        Registro de alterações ({edital.log.length})
      </h4>
      <ul className="mb-space-md flex flex-col gap-space-sm">
        {edital.log.length === 0 && <li className="py-2 text-outline">Nenhuma alteração registrada.</li>}
        {[...edital.log].reverse().map((l, i) => (
          <li key={`${l.ts}-${i}`} className="rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
            <div className="font-label-md text-label-md font-bold text-primary">
              {fmtTs(l.ts)} • {l.por || '—'}
              <span className="ml-1 font-normal text-on-surface-variant">
                {l.acao === 'criou' ? 'cadastrou o edital' : l.acao === 'retificou' ? 'registrou uma retificação' : 'alterou'}
              </span>
            </div>
            {l.obs && (
              <div className="mt-0.5 text-body-sm italic text-on-surface-variant">
                {l.acao === 'alterou' ? 'Motivo: ' : ''}“{l.obs}”
              </div>
            )}
            {l.mudancas.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-body-sm">
                {l.mudancas.map((m, j) => (
                  <li key={j}>
                    <b>{m.campo}:</b> <span className="text-outline line-through">{m.de}</span> → <b>{m.para}</b>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <h4 className="mb-space-xs font-label-sm text-label-sm font-bold uppercase tracking-wider text-outline">Retificações</h4>
      <div className="flex flex-col gap-space-sm">
        {edital.retifs.length === 0 && (
          <div className="py-4 text-center text-outline">Nenhuma retificação registrada para este edital.</div>
        )}
        {[...edital.retifs].reverse().map((r) => (
          <div key={r.ts} className="rounded-lg border border-surface-container bg-surface-container-low p-space-sm">
            <div className="flex justify-between">
              <span className="font-label-md text-label-md font-bold text-primary">
                {fmtTs(r.ts)}
                {r.por ? ` • ${r.por}` : ''}
              </span>
              <span className={`font-data-mono text-[11px] font-bold ${r.dias > 0 ? 'text-error' : 'text-secondary'}`}>
                {r.dias > 0 ? `+${r.dias} dias` : 'Data mantida'}
              </span>
            </div>
            <div className="mt-1 text-body-sm">{r.desc}</div>
          </div>
        ))}
      </div>
      <div className="flex justify-end pt-space-md">
        <button type="button" onClick={onClose} className={btnPrimary}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Relatório ----------
export function ReportModal({ editais, statuses, onExport, onClose }: { editais: Edital[]; statuses: StatusCfg[]; onExport: () => void; onClose: () => void }) {
  const sum = (a: Edital[]) => a.reduce((s, x) => s + x.valorGanho, 0)
  return (
    <Modal title="Relatório Resumido" icon="query_stats" onClose={onClose}>
      <table className="w-full text-body-md">
        <thead>
          <tr className="font-label-sm text-label-sm uppercase text-outline">
            <th className="text-left">Status</th>
            <th className="text-right">Editais</th>
            <th className="text-right">Valor ganho</th>
          </tr>
        </thead>
        <tbody>
          {statuses.map((s) => {
            const l = editais.filter((x) => x.status === s.id)
            return (
              <tr key={s.id}>
                <td className="py-1">{s.nome}</td>
                <td className="text-right font-data-mono">{l.length}</td>
                <td className="text-right font-data-mono">{brl(sum(l))}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t font-bold">
            <td className="pt-2">Total</td>
            <td className="pt-2 text-right font-data-mono">{editais.length}</td>
            <td className="pt-2 text-right font-data-mono">{brl(sum(editais))}</td>
          </tr>
        </tfoot>
      </table>
      <div className="flex justify-end gap-space-sm pt-space-md">
        <button type="button" onClick={onExport} className={btnGhost}>
          Exportar CSV
        </button>
        <button type="button" onClick={onClose} className={btnPrimary}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}

// ---------- Meu perfil e senha ----------
export function ProfileModal({
  me,
  onSaveProfile,
  onChangePassword,
  onUsers,
  onClearAll,
  onLogout,
  onClose,
}: {
  me: PublicUser
  onSaveProfile: (v: { nome: string; cargo: string }) => Promise<boolean>
  onChangePassword: (v: { atual: string; nova: string }) => Promise<boolean>
  onUsers: () => void
  onClearAll: () => void
  onLogout: () => void
  onClose: () => void
}) {
  const [nome, setNome] = useState(me.nome)
  const [cargo, setCargo] = useState(me.cargo)
  const [busy, setBusy] = useState(false)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [conf, setConf] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [pwBusy, setPwBusy] = useState(false)
  const admin = me.papel === 'admin'

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    await onSaveProfile({ nome: nome.trim(), cargo: cargo.trim() })
    setBusy(false)
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (nova !== conf) return setPwErr('A confirmação não confere com a nova senha.')
    setPwErr(null)
    setPwBusy(true)
    const ok = await onChangePassword({ atual, nova })
    setPwBusy(false)
    if (ok) {
      setAtual('')
      setNova('')
      setConf('')
    }
  }

  return (
    <Modal title="Meu perfil e senha" icon="manage_accounts" onClose={onClose}>
      <p className="mb-space-md text-body-sm text-on-surface-variant">
        Conectado como <strong>@{me.usuario}</strong> • {admin ? 'Administrador' : 'Usuário'}
      </p>

      <form onSubmit={saveProfile} className="grid grid-cols-1 gap-space-md">
        <Field label="Nome">
          <input required maxLength={80} className={input} value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Cargo">
          <input maxLength={80} className={input} placeholder="Ex.: Analista de Licitações" value={cargo} onChange={(e) => setCargo(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </div>
      </form>

      <form onSubmit={savePassword} className="mt-space-lg grid grid-cols-1 gap-space-md border-t border-surface-container pt-space-md">
        <h3 className="font-label-md text-label-md font-bold uppercase text-primary">Alterar senha</h3>
        <Field label="Senha atual">
          <input required type="password" autoComplete="current-password" className={input} value={atual} onChange={(e) => setAtual(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-space-md">
          <Field label="Nova senha (mín. 6)">
            <input required type="password" autoComplete="new-password" className={input} value={nova} onChange={(e) => setNova(e.target.value)} />
          </Field>
          <Field label="Confirmar nova senha">
            <input required type="password" autoComplete="new-password" className={input} value={conf} onChange={(e) => setConf(e.target.value)} />
          </Field>
        </div>
        {pwErr && <div className="text-body-sm font-medium text-error">{pwErr}</div>}
        <p className="text-[11px] text-outline">Ao trocar a senha, os outros aparelhos em que você está conectado são desconectados.</p>
        <div className="flex justify-end">
          <button type="submit" disabled={pwBusy} className={btnPrimary}>
            {pwBusy ? 'Salvando…' : 'Alterar senha'}
          </button>
        </div>
      </form>

      <div className="mt-space-lg flex flex-wrap items-center justify-between gap-space-sm border-t border-surface-container pt-space-md">
        <button type="button" onClick={onLogout} className={btnGhost}>
          Sair desta conta
        </button>
        {admin && (
          <button type="button" onClick={onUsers} className={btnGhost}>
            Gerenciar usuários
          </button>
        )}
      </div>

      {admin && (
        <div className="mt-space-lg border-t border-surface-container pt-space-md">
          <h3 className="font-label-md text-label-md font-bold uppercase text-error">Zona de perigo (administrador)</h3>
          <p className="mb-space-sm mt-1 text-body-sm text-on-surface-variant">
            Remove todos os editais e retificações de <strong>todos os usuários</strong>. Contas e senhas são mantidas.
          </p>
          <button
            type="button"
            onClick={onClearAll}
            className="rounded-lg bg-error-container/40 px-4 py-2 font-label-md text-label-md font-bold text-error hover:bg-error-container/60"
          >
            Apagar todos os editais
          </button>
        </div>
      )}
    </Modal>
  )
}

// ---------- Usuários (administrador) ----------
interface UserFormValue {
  usuario: string
  nome: string
  cargo: string
  senha: string
  papel: Papel
  portais: number[] | null
}

function UserForm({
  initial,
  portais,
  onSubmit,
  onCancel,
}: {
  initial?: PublicUser
  portais: Portal[]
  onSubmit: (v: UserFormValue) => Promise<boolean>
  onCancel: () => void
}) {
  const editing = !!initial
  const [f, setF] = useState<UserFormValue>({
    usuario: initial?.usuario ?? '',
    nome: initial?.nome ?? '',
    cargo: initial?.cargo ?? '',
    senha: '',
    papel: initial?.papel ?? 'usuario',
    portais: initial?.portais ?? null,
  })
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof UserFormValue>(k: K, v: UserFormValue[K]) => setF((p) => ({ ...p, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const ok = await onSubmit(f)
    setBusy(false)
    if (ok) onCancel()
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-space-md">
      <Field label="Usuário (login)">
        <input
          required
          disabled={editing}
          autoCapitalize="none"
          className={`${input} disabled:opacity-60`}
          placeholder="ex.: joao.silva"
          value={f.usuario}
          onChange={(e) => set('usuario', e.target.value)}
        />
      </Field>
      <Field label="Permissão">
        <select className={input} value={f.papel} onChange={(e) => set('papel', e.target.value as Papel)}>
          <option value="usuario">Usuário (vê e edita os editais)</option>
          <option value="admin">Administrador (também gerencia usuários)</option>
        </select>
      </Field>
      <Field label="Nome">
        <input required maxLength={80} className={input} value={f.nome} onChange={(e) => set('nome', e.target.value)} />
      </Field>
      <Field label="Cargo">
        <input maxLength={80} className={input} value={f.cargo} onChange={(e) => set('cargo', e.target.value)} />
      </Field>
      {f.papel === 'usuario' && (
        <div className="col-span-2 flex flex-col gap-2 rounded-lg border border-surface-container p-space-sm">
          <span className={labelCls}>Portais que este usuário enxerga</span>
          <label className="flex cursor-pointer items-center gap-2 text-body-sm">
            <input type="radio" name="portais-modo" checked={f.portais === null} onChange={() => set('portais', null)} />
            Todos os portais (inclusive os cadastrados no futuro)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-body-sm">
            <input type="radio" name="portais-modo" checked={f.portais !== null} onChange={() => set('portais', f.portais ?? [])} />
            Somente os selecionados
          </label>
          {f.portais !== null && (
            <div className="grid grid-cols-2 gap-1 pl-6">
              {portais.length === 0 && <span className="col-span-2 text-body-sm text-outline">Nenhum portal cadastrado.</span>}
              {portais.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 text-body-sm">
                  <input
                    type="checkbox"
                    checked={f.portais!.includes(p.id)}
                    onChange={(e) => set('portais', e.target.checked ? [...f.portais!, p.id] : f.portais!.filter((x) => x !== p.id))}
                  />
                  {p.nome}
                </label>
              ))}
            </div>
          )}
          <span className="text-[11px] text-outline">
            O usuário só vê esses portais e os editais deles (e editais sem portal). Administradores sempre veem tudo.
          </span>
        </div>
      )}
      <Field label={editing ? 'Nova senha (deixe vazio para manter)' : 'Senha (mín. 6)'} className="col-span-2">
        <input
          required={!editing}
          type="password"
          autoComplete="new-password"
          className={input}
          value={f.senha}
          onChange={(e) => set('senha', e.target.value)}
        />
      </Field>
      <div className="col-span-2">
        <Actions onClose={onCancel} busy={busy} submit={editing ? 'Salvar' : 'Criar usuário'} />
      </div>
    </form>
  )
}

type UsersMode = { k: 'list' } | { k: 'new' } | { k: 'edit'; user: PublicUser }

export function UsersModal({
  me,
  users,
  portais,
  onCreate,
  onUpdate,
  onDelete,
  onClose,
}: {
  me: PublicUser
  users: PublicUser[]
  portais: Portal[]
  onCreate: (v: NewUser) => Promise<boolean>
  onUpdate: (id: number, v: UserPatch) => Promise<boolean>
  onDelete: (u: PublicUser) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<UsersMode>({ k: 'list' })
  const back = () => setMode({ k: 'list' })

  if (mode.k === 'new') {
    return (
      <Modal title="Novo usuário" icon="person_add" onClose={onClose}>
        <UserForm portais={portais} onSubmit={(v) => onCreate(v)} onCancel={back} />
      </Modal>
    )
  }
  if (mode.k === 'edit') {
    const target = mode.user
    return (
      <Modal title={`Editar @${target.usuario}`} icon="manage_accounts" onClose={onClose}>
        <UserForm
          initial={target}
          portais={portais}
          onSubmit={(v) =>
            onUpdate(target.id, { nome: v.nome, cargo: v.cargo, papel: v.papel, portais: v.portais, ...(v.senha ? { senha: v.senha } : {}) })
          }
          onCancel={back}
        />
      </Modal>
    )
  }

  return (
    <Modal title="Usuários" icon="group" onClose={onClose}>
      <p className="mb-space-md text-body-sm text-on-surface-variant">
        Todos os usuários enxergam e editam os mesmos editais. Só administradores gerenciam contas.
      </p>
      <div className="flex flex-col divide-y divide-surface-container-low rounded-lg border border-surface-container">
        {users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-space-sm p-space-sm">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-label-md text-label-md font-bold text-primary">{u.nome}</span>
                {u.papel === 'admin' && (
                  <span className="rounded bg-secondary-container/40 px-1.5 text-[10px] font-bold text-on-secondary-container">ADMIN</span>
                )}
                {u.id === me.id && <span className="rounded bg-surface-container px-1.5 text-[10px] font-bold text-on-surface">VOCÊ</span>}
                {u.papel !== 'admin' && u.portais !== null && (
                  <span className="rounded bg-surface-container px-1.5 text-[10px] font-bold text-on-surface">{u.portais.length} PORTAL(IS)</span>
                )}
              </div>
              <div className="truncate text-body-sm text-outline">
                @{u.usuario}
                {u.cargo ? ` • ${u.cargo}` : ''}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" title="Editar / redefinir senha" onClick={() => setMode({ k: 'edit', user: u })} className="rounded p-1.5 text-primary hover:bg-surface-container">
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              {u.id !== me.id && (
                <button type="button" title="Excluir usuário" onClick={() => onDelete(u)} className="rounded p-1.5 text-error hover:bg-error-container/40">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between pt-space-md">
        <button type="button" onClick={() => setMode({ k: 'new' })} className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md text-on-primary">
          <span className="material-symbols-outlined text-[18px]">person_add</span> Novo usuário
        </button>
        <button type="button" onClick={onClose} className={btnGhost}>
          Fechar
        </button>
      </div>
    </Modal>
  )
}
