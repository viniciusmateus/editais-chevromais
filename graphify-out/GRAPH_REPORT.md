# Graph Report - editais-dashboard  (2026-10-09)

## Corpus Check
- 44 files · ~46,845 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .css 1)

## Summary
- 514 nodes · 1313 edges · 20 communities (17 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4f0c3892`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- package.json
- shared.ts
- utils.ts
- api.ts
- compilerOptions
- compilerOptions
- compilerOptions
- precificador.ts
- Editais Chevomais
- Dashboard.tsx
- ValidationError
- view
- normalize
- migrate-to-postgres.ts
- Inputs.tsx
- SituacaoBar.tsx

## God Nodes (most connected - your core abstractions)
1. `Dashboard()` - 29 edges
2. `ValidationError` - 24 edges
3. `Edital` - 24 edges
4. `ProcessoEditor()` - 23 edges
5. `react` - 19 edges
6. `CategoriaCfg` - 18 edges
7. `compilerOptions` - 18 edges
8. `StatusCfg` - 17 edges
9. `compilerOptions` - 15 edges
10. `EditalModal()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `parseEdital()` --calls--> `horaValida()`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `parseEdital()` --calls--> `isoValida()`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `CategoriaCfg`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `Edital`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `EmpresaCfg`  [EXTRACTED]
  server/db.ts → src/shared.ts

## Import Cycles
- None detected.

## Communities (20 total, 3 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.07
Nodes (30): addLog(), addSession(), BAK_FILE, BRL, CAMPOS, ChaveItens, conferirEdital(), DB_FILE (+22 more)

### Community 1 - "package.json"
Cohesion: 0.04
Nodes (46): dependencies, pg, react, react-dom, xlsx, devDependencies, autoprefixer, concurrently (+38 more)

### Community 2 - "shared.ts"
Cohesion: 0.07
Nodes (65): DbFile, CfgMode, CORES, Item, ListaOrdenavel(), PortalMode, REGRA_LABEL, resumo() (+57 more)

### Community 3 - "utils.ts"
Cohesion: 0.10
Nodes (39): CalendarView(), DIAS, DIAS_LONGOS, keyDe(), MESES, nomePortal(), pad(), PALETA (+31 more)

### Community 4 - "api.ts"
Cohesion: 0.13
Nodes (20): react, App(), AuthScreen(), Props, UserFormValue, CatalogoPage(), Coluna(), Item (+12 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 7 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 8 - "precificador.ts"
Cohesion: 0.06
Nodes (34): ConflictError, db, dbPath, ForbiddenError, UserRecord, attempts, Ctx, DIST (+26 more)

### Community 12 - "Editais Chevomais"
Cohesion: 0.15
Nodes (12): API, Como rodar, Editais Chevomais, Esqueci a senha do administrador, Estrutura, Observações, Onde ficam os dados, Para o time usar (um computador faz o papel de servidor) (+4 more)

### Community 13 - "Dashboard.tsx"
Cohesion: 0.06
Nodes (90): ItemForm(), PortaisModal(), PortalForm(), ConfigPage(), ListaConfig(), FilterBar(), DateInput(), MaskedInput() (+82 more)

### Community 14 - "ValidationError"
Cohesion: 0.15
Nodes (14): cleanPapel(), cleanPerfil(), cleanPerfilUser(), cleanPortaisUser(), cleanRegras(), cleanSenha(), cleanUsuario(), conferirImpugs() (+6 more)

### Community 15 - "view"
Cohesion: 0.21
Nodes (13): actorIn(), AuthError, cleanCor(), editarItem(), enxerga(), excluirItem(), NotFoundError, ordenarItens() (+5 more)

### Community 16 - "normalize"
Cohesion: 0.29
Nodes (12): cleanRegrasLenient(), criarItem(), emptyDb(), fluxoInicial(), lerTransicoes(), load(), loadPg(), mutate() (+4 more)

### Community 17 - "migrate-to-postgres.ts"
Cohesion: 0.24
Nodes (8): DATABASE_URL, encerrar(), ensureSchema(), getPool(), pgLerBruto(), pgSalvarBruto(), file, force

### Community 18 - "Inputs.tsx"
Cohesion: 0.28
Nodes (5): brToIso(), Props, toTime(), horaValida(), isoValida()

### Community 19 - "SituacaoBar.tsx"
Cohesion: 0.83
Nodes (3): CardInfo, Props, Visao

## Knowledge Gaps
- **143 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+138 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 176 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `api.ts` to `package.json`, `shared.ts`, `utils.ts`, `Dashboard.tsx`, `Inputs.tsx`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `ProcessoEditor()` (e.g. with `pendenciasDe()` and `linhaCompleta()`) actually correct?**
  _`ProcessoEditor()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _143 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06825396825396825 - nodes in this community are weakly interconnected._
- **Why does `pg` connect `package.json` to `db.ts`, `precificador.ts`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `shared.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0730593607305936 - nodes in this community are weakly interconnected._