/**
 * precificador.ts — marcas, modelos e processos de precificação.
 *
 * Diferente do resto do sistema (um documento jsonb em app_state), estes dados ficam em tabelas
 * próprias no PostgreSQL: o catálogo de marcas/modelos pode ter milhares de linhas e os processos
 * trazem a planilha inteira do edital — não faz sentido mandá-los na sincronização de 4 em 4 segundos.
 * As tabelas são criadas sozinhas na primeira chamada (o mesmo SQL está em server/sql/precificador.sql).
 */
import type pg from 'pg'
import { ConflictError, DATABASE_URL, ForbiddenError, NotFoundError, ValidationError, db, getPool, type UserRecord } from './db'
import {
  linhaCompleta,
  type Arredondamento,
  type PrecifCatalogo,
  type PrecifLinha,
  type PrecifMarca,
  type PrecifModelo,
  type PrecifProcesso,
  type PrecifProcessoInput,
  type PrecifProcessoResumo,
} from '../src/shared'

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS precif_marcas (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  uso integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS precif_marcas_nome_uk ON precif_marcas (upper(nome));

CREATE TABLE IF NOT EXISTS precif_modelos (
  id serial PRIMARY KEY,
  marca_id integer NOT NULL REFERENCES precif_marcas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  uso integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS precif_modelos_uk ON precif_modelos (marca_id, upper(nome));
CREATE INDEX IF NOT EXISTS precif_modelos_marca_idx ON precif_modelos (marca_id);

CREATE TABLE IF NOT EXISTS precif_processos (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  edital_id integer,
  margem numeric(8,2) NOT NULL DEFAULT 0,
  arredondamento text NOT NULL DEFAULT 'centavo',
  globais jsonb NOT NULL DEFAULT '[]'::jsonb,
  linhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  v integer NOT NULL DEFAULT 1,
  uso_registrado boolean NOT NULL DEFAULT false,
  criado_por text NOT NULL DEFAULT '',
  atualizado_por text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS precif_processos_atualizado_idx ON precif_processos (atualizado_em DESC);
`

const MAX_LINHAS = 5000
const MAX_IMPORT = 50_000

let pronto: Promise<void> | null = null
/** Garante as tabelas (uma vez por execução do servidor; tenta de novo se falhar). */
async function pool(): Promise<pg.Pool> {
  if (!DATABASE_URL) throw new ValidationError('O Precificador precisa do PostgreSQL: defina DATABASE_URL no .env.')
  pronto ??= getPool()
    .query(SCHEMA_SQL)
    .then(() => undefined)
    .catch((e) => {
      pronto = null
      throw e
    })
  await pronto
  return getPool()
}

/** Executa várias consultas numa transação. */
async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await (await pool()).connect()
  try {
    await c.query('BEGIN')
    const r = await fn(c)
    await c.query('COMMIT')
    return r
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    c.release()
  }
}

const who = (u: UserRecord) => u.nome || u.usuario

/** Nome de marca/modelo: maiúsculo, sem espaços repetidos. */
function nomeCat(v: unknown, campo: string): string {
  const s = (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().toUpperCase()
  if (!s) throw new ValidationError(`Informe o nome ${campo}`)
  if (s.length > 120) throw new ValidationError(`Nome ${campo} muito longo`)
  return s
}

const ehDuplicado = (e: unknown) => (e as { code?: string })?.code === '23505'

async function exigeExcluir(user: UserRecord): Promise<void> {
  if (!(await db.perms(user)).excluir) throw new ForbiddenError('Seu perfil não permite excluir.')
}

// ---------- validação do processo ----------
const num = (v: unknown, min: number, max: number): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : 0
}
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v : v == null ? '' : String(v)).trim().slice(0, max)

function lerLinhas(v: unknown): PrecifLinha[] {
  if (!Array.isArray(v)) throw new ValidationError('Linhas inválidas')
  if (v.length > MAX_LINHAS) throw new ValidationError(`O processo pode ter no máximo ${MAX_LINHAS} itens`)
  return v.map((l: any) => ({
    lote: texto(l?.lote, 40),
    item: texto(l?.item, 40),
    descricao: texto(l?.descricao, 500),
    ref: Math.round(num(l?.ref, 0, 1e10) * 100) / 100,
    qtde: Math.round(num(l?.qtde, 0, 1e9)),
    custo: Math.round(num(l?.custo, 0, 1e10) * 100) / 100,
    marca: texto(l?.marca, 120).toUpperCase(),
    modelo: texto(l?.modelo, 120).toUpperCase(),
  }))
}

function lerProcesso(body: any): PrecifProcessoInput {
  if (!body || typeof body !== 'object') throw new ValidationError('Corpo inválido')
  const nome = texto(body.nome, 160)
  if (!nome) throw new ValidationError('Informe o nome do processo')
  const editalId = body.editalId == null || body.editalId === '' ? null : Number(body.editalId)
  if (editalId !== null && !Number.isInteger(editalId)) throw new ValidationError('Edital inválido')
  const arredondamento: Arredondamento = body.arredondamento === 'dezena' ? 'dezena' : 'centavo'
  const linhas = lerLinhas(body.linhas ?? [])
  const lotes = new Set(linhas.map((l) => l.lote))
  const lidos: string[] = (Array.isArray(body.globais) ? (body.globais as unknown[]) : []).map((g) => texto(g, 40))
  const globais = [...new Set(lidos)].filter((g) => lotes.has(g))
  return { nome, editalId, margem: Math.round(num(body.margem, 0, 99999) * 100) / 100, arredondamento, globais, linhas }
}

const ts = (d: Date | string) => new Date(d).getTime()

function processoDaLinha(r: any): PrecifProcesso {
  return {
    id: r.id,
    nome: r.nome,
    editalId: r.edital_id,
    margem: Number(r.margem),
    arredondamento: r.arredondamento === 'dezena' ? 'dezena' : 'centavo',
    globais: Array.isArray(r.globais) ? r.globais : [],
    linhas: Array.isArray(r.linhas) ? r.linhas : [],
    v: r.v,
    usoRegistrado: r.uso_registrado,
    criadoPor: r.criado_por,
    atualizadoPor: r.atualizado_por,
    criadoEm: ts(r.criado_em),
    atualizadoEm: ts(r.atualizado_em),
  }
}

/** Cria a marca (se não existir) e devolve o id. */
async function garantirMarca(c: pg.PoolClient, nome: string): Promise<number> {
  const r = await c.query(
    `INSERT INTO precif_marcas (nome) VALUES ($1)
     ON CONFLICT ((upper(nome))) DO UPDATE SET nome = precif_marcas.nome
     RETURNING id`,
    [nome],
  )
  return r.rows[0].id
}

async function garantirModelo(c: pg.PoolClient, marcaId: number, nome: string): Promise<number> {
  const r = await c.query(
    `INSERT INTO precif_modelos (marca_id, nome) VALUES ($1, $2)
     ON CONFLICT (marca_id, (upper(nome))) DO UPDATE SET nome = precif_modelos.nome
     RETURNING id`,
    [marcaId, nome],
  )
  return r.rows[0].id
}

export const precificador = {
  // ===== catálogo =====
  async catalogo(): Promise<PrecifCatalogo> {
    const p = await pool()
    const [m, md] = await Promise.all([
      p.query('SELECT id, nome, uso FROM precif_marcas ORDER BY uso DESC, nome'),
      p.query('SELECT id, marca_id, nome, uso FROM precif_modelos ORDER BY uso DESC, nome'),
    ])
    return {
      marcas: m.rows.map((r): PrecifMarca => ({ id: r.id, nome: r.nome, uso: r.uso })),
      modelos: md.rows.map((r): PrecifModelo => ({ id: r.id, marcaId: r.marca_id, nome: r.nome, uso: r.uso })),
    }
  },

  async criarMarca(body: any): Promise<PrecifCatalogo> {
    const nome = nomeCat(body?.nome, 'da marca')
    try {
      await (await pool()).query('INSERT INTO precif_marcas (nome) VALUES ($1)', [nome])
    } catch (e) {
      if (ehDuplicado(e)) throw new ValidationError('Já existe uma marca com esse nome')
      throw e
    }
    return this.catalogo()
  },

  async editarMarca(id: number, body: any): Promise<PrecifCatalogo> {
    const nome = nomeCat(body?.nome, 'da marca')
    try {
      const r = await (await pool()).query('UPDATE precif_marcas SET nome = $2 WHERE id = $1', [id, nome])
      if (!r.rowCount) throw new NotFoundError('Marca não encontrada')
    } catch (e) {
      if (ehDuplicado(e)) throw new ValidationError('Já existe uma marca com esse nome')
      throw e
    }
    return this.catalogo()
  },

  /** Exclui a marca e os modelos dela. Os processos guardam os nomes em texto e não são afetados. */
  async excluirMarca(user: UserRecord, id: number): Promise<PrecifCatalogo> {
    await exigeExcluir(user)
    const r = await (await pool()).query('DELETE FROM precif_marcas WHERE id = $1', [id])
    if (!r.rowCount) throw new NotFoundError('Marca não encontrada')
    return this.catalogo()
  },

  async criarModelo(body: any): Promise<PrecifCatalogo> {
    const nome = nomeCat(body?.nome, 'do modelo')
    const marcaId = Number(body?.marcaId)
    if (!Number.isInteger(marcaId)) throw new ValidationError('Escolha a marca do modelo')
    try {
      await (await pool()).query('INSERT INTO precif_modelos (marca_id, nome) VALUES ($1, $2)', [marcaId, nome])
    } catch (e) {
      if (ehDuplicado(e)) throw new ValidationError('Esta marca já tem um modelo com esse nome')
      if ((e as { code?: string })?.code === '23503') throw new NotFoundError('Marca não encontrada')
      throw e
    }
    return this.catalogo()
  },

  async editarModelo(id: number, body: any): Promise<PrecifCatalogo> {
    const nome = nomeCat(body?.nome, 'do modelo')
    try {
      const r = await (await pool()).query('UPDATE precif_modelos SET nome = $2 WHERE id = $1', [id, nome])
      if (!r.rowCount) throw new NotFoundError('Modelo não encontrado')
    } catch (e) {
      if (ehDuplicado(e)) throw new ValidationError('Esta marca já tem um modelo com esse nome')
      throw e
    }
    return this.catalogo()
  },

  async excluirModelo(user: UserRecord, id: number): Promise<PrecifCatalogo> {
    await exigeExcluir(user)
    const r = await (await pool()).query('DELETE FROM precif_modelos WHERE id = $1', [id])
    if (!r.rowCount) throw new NotFoundError('Modelo não encontrado')
    return this.catalogo()
  },

  /** Importa pares marca/modelo de uma planilha. O que já existe é ignorado. */
  async importarCatalogo(body: any): Promise<{ catalogo: PrecifCatalogo; marcasCriadas: number; modelosCriados: number; ignorados: number }> {
    const linhas: unknown[] = Array.isArray(body?.linhas) ? body.linhas : []
    if (!linhas.length) throw new ValidationError('Nenhuma linha para importar')
    if (linhas.length > MAX_IMPORT) throw new ValidationError(`Importe no máximo ${MAX_IMPORT} linhas por vez`)
    const pares = new Map<string, { marca: string; modelo: string }>()
    for (const l of linhas as any[]) {
      try {
        const marca = nomeCat(l?.marca, 'da marca')
        const modelo = nomeCat(l?.modelo, 'do modelo')
        pares.set(`${marca}\u0000${modelo}`, { marca, modelo })
      } catch {
        /* linha sem marca ou modelo: ignorada */
      }
    }
    const res = await tx(async (c) => {
      const antes = await c.query('SELECT (SELECT count(*) FROM precif_marcas)::int AS m, (SELECT count(*) FROM precif_modelos)::int AS md')
      const marcas = [...new Set([...pares.values()].map((p) => p.marca))]
      // tudo em lote: uma consulta para as marcas e outra para os modelos
      await c.query('INSERT INTO precif_marcas (nome) SELECT unnest($1::text[]) ON CONFLICT DO NOTHING', [marcas])
      const ids = await c.query('SELECT id, upper(nome) AS n FROM precif_marcas WHERE upper(nome) = ANY($1::text[])', [marcas])
      const idDe = new Map<string, number>(ids.rows.map((r) => [r.n, r.id]))
      const mIds: number[] = []
      const mNomes: string[] = []
      for (const p of pares.values()) {
        const id = idDe.get(p.marca)
        if (id) {
          mIds.push(id)
          mNomes.push(p.modelo)
        }
      }
      await c.query('INSERT INTO precif_modelos (marca_id, nome) SELECT * FROM unnest($1::int[], $2::text[]) ON CONFLICT DO NOTHING', [mIds, mNomes])
      const depois = await c.query('SELECT (SELECT count(*) FROM precif_marcas)::int AS m, (SELECT count(*) FROM precif_modelos)::int AS md')
      return { marcasCriadas: depois.rows[0].m - antes.rows[0].m, modelosCriados: depois.rows[0].md - antes.rows[0].md }
    })
    return { ...res, ignorados: linhas.length - res.modelosCriados, catalogo: await this.catalogo() }
  },

  // ===== processos =====
  async listarProcessos(): Promise<PrecifProcessoResumo[]> {
    const r = await (await pool()).query(
      'SELECT id, nome, edital_id, margem, linhas, criado_por, atualizado_por, atualizado_em FROM precif_processos ORDER BY atualizado_em DESC',
    )
    return r.rows.map((x) => {
      const linhas: PrecifLinha[] = Array.isArray(x.linhas) ? x.linhas : []
      return {
        id: x.id,
        nome: x.nome,
        editalId: x.edital_id,
        margem: Number(x.margem),
        total: linhas.length,
        concluidos: linhas.filter(linhaCompleta).length,
        criadoPor: x.criado_por,
        atualizadoPor: x.atualizado_por,
        atualizadoEm: ts(x.atualizado_em),
      }
    })
  },

  async obterProcesso(id: number): Promise<PrecifProcesso> {
    const r = await (await pool()).query('SELECT * FROM precif_processos WHERE id = $1', [id])
    if (!r.rows[0]) throw new NotFoundError('Processo não encontrado (pode ter sido excluído por outro usuário)')
    return processoDaLinha(r.rows[0])
  },

  async criarProcesso(user: UserRecord, body: any): Promise<PrecifProcesso> {
    const v = lerProcesso(body)
    const r = await (await pool()).query(
      `INSERT INTO precif_processos (nome, edital_id, margem, arredondamento, globais, linhas, criado_por, atualizado_por)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $7) RETURNING *`,
      [v.nome, v.editalId, v.margem, v.arredondamento, JSON.stringify(v.globais), JSON.stringify(v.linhas), who(user)],
    )
    return processoDaLinha(r.rows[0])
  },

  /** `body.v` é a versão que a tela estava editando; se outra pessoa gravou antes, responde conflito (409). */
  async salvarProcesso(user: UserRecord, id: number, body: any): Promise<PrecifProcesso> {
    const v = lerProcesso(body)
    const esperado = Number(body?.v)
    if (!Number.isInteger(esperado)) throw new ValidationError('Versão do processo ausente')
    const r = await (await pool()).query(
      `UPDATE precif_processos SET nome = $2, edital_id = $3, margem = $4, arredondamento = $5, globais = $6::jsonb, linhas = $7::jsonb,
         v = v + 1, atualizado_por = $8, atualizado_em = now()
       WHERE id = $1 AND v = $9 RETURNING *`,
      [id, v.nome, v.editalId, v.margem, v.arredondamento, JSON.stringify(v.globais), JSON.stringify(v.linhas), who(user), esperado],
    )
    if (r.rows[0]) return processoDaLinha(r.rows[0])
    const atual = await (await pool()).query('SELECT atualizado_por FROM precif_processos WHERE id = $1', [id])
    if (!atual.rows[0]) throw new NotFoundError('Processo não encontrado (pode ter sido excluído por outro usuário)')
    throw new ConflictError(`${atual.rows[0].atualizado_por || 'Outro usuário'} alterou este processo enquanto você editava. Recarregue para ver a versão atual.`)
  },

  async excluirProcesso(user: UserRecord, id: number): Promise<{ ok: true }> {
    await exigeExcluir(user)
    const r = await (await pool()).query('DELETE FROM precif_processos WHERE id = $1', [id])
    if (!r.rowCount) throw new NotFoundError('Processo não encontrado')
    return { ok: true }
  },

  /**
   * Chamado na exportação: põe no catálogo as marcas/modelos novos digitados no processo e,
   * na primeira exportação do processo, soma 1 ao uso de cada marca e modelo usados (ordena as sugestões).
   */
  async registrarUso(id: number): Promise<PrecifCatalogo> {
    await tx(async (c) => {
      const r = await c.query('SELECT linhas, uso_registrado FROM precif_processos WHERE id = $1 FOR UPDATE', [id])
      if (!r.rows[0]) throw new NotFoundError('Processo não encontrado')
      const linhas: PrecifLinha[] = Array.isArray(r.rows[0].linhas) ? r.rows[0].linhas : []
      const pares = new Map<string, { marca: string; modelo: string }>()
      for (const l of linhas) {
        if (l.marca?.trim() && l.modelo?.trim()) pares.set(`${l.marca}\u0000${l.modelo}`, { marca: l.marca.trim().toUpperCase(), modelo: l.modelo.trim().toUpperCase() })
      }
      const marcas = new Map<string, number>()
      const modelos = new Set<number>()
      for (const p of pares.values()) {
        const marcaId = marcas.get(p.marca) ?? (await garantirMarca(c, p.marca))
        marcas.set(p.marca, marcaId)
        modelos.add(await garantirModelo(c, marcaId, p.modelo))
      }
      if (!r.rows[0].uso_registrado && pares.size) {
        await c.query('UPDATE precif_marcas SET uso = uso + 1 WHERE id = ANY($1::int[])', [[...marcas.values()]])
        await c.query('UPDATE precif_modelos SET uso = uso + 1 WHERE id = ANY($1::int[])', [[...modelos]])
        await c.query('UPDATE precif_processos SET uso_registrado = true WHERE id = $1', [id])
      }
    })
    return this.catalogo()
  },
}
