-- Tabelas do Precificador (marcas, modelos e processos de precificação).
-- O servidor cria estas tabelas sozinho na primeira vez que o Precificador é aberto;
-- este arquivo serve para criar à mão, se preferir:
--   psql "$DATABASE_URL" -f server/sql/precificador.sql
-- Mantenha igual ao SCHEMA_SQL de server/precificador.ts.

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
