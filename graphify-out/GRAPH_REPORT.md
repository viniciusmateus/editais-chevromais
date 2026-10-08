# Graph Report - editais-dashboard  (2026-10-08)

## Corpus Check
- 32 files · ~27,306 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .tsbuildinfo 1)

## Summary
- 370 nodes · 794 edges · 18 communities (15 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a7e582d4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- package.json
- Modals.tsx
- utils.ts
- shared.ts
- compilerOptions
- compilerOptions
- compilerOptions
- index.ts
- Editais Chevomais
- ValidationError
- Inputs.tsx
- normalize
- AuthError
- reset-password.ts

## God Nodes (most connected - your core abstractions)
1. `Dashboard()` - 24 edges
2. `Edital` - 18 edges
3. `CategoriaCfg` - 18 edges
4. `compilerOptions` - 18 edges
5. `StatusCfg` - 17 edges
6. `compilerOptions` - 15 edges
7. `ValidationError` - 13 edges
8. `EditalModal()` - 13 edges
9. `compilerOptions` - 13 edges
10. `react` - 12 edges

## Surprising Connections (you probably didn't know these)
- `UserRecord` --inherits--> `PublicUser`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `CategoriaCfg`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `Edital`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `Portal`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `StatusCfg`  [EXTRACTED]
  server/db.ts → src/shared.ts

## Import Cycles
- None detected.

## Communities (18 total, 3 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.10
Nodes (24): addLog(), addSession(), BAK_FILE, BRL, CAMPOS, DB_FILE, diffEdital(), DUMMY_SALT (+16 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (39): dependencies, react, react-dom, devDependencies, autoprefixer, concurrently, postcss, tailwindcss (+31 more)

### Community 2 - "Modals.tsx"
Cohesion: 0.13
Nodes (36): ItemForm(), PortaisModal(), PortalForm(), ConfigPage(), Tab, FilterBar(), Header(), Props (+28 more)

### Community 3 - "utils.ts"
Cohesion: 0.10
Nodes (47): DbFile, CalendarView(), DIAS, DIAS_LONGOS, keyDe(), MESES, nomePortal(), pad() (+39 more)

### Community 4 - "shared.ts"
Cohesion: 0.06
Nodes (56): react, App(), CfgMode, CORES, Item, ListaOrdenavel(), PortalMode, REGRA_LABEL (+48 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 6 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 7 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+6 more)

### Community 8 - "index.ts"
Cohesion: 0.10
Nodes (18): ConflictError, NotFoundError, UserRecord, attempts, Ctx, DIST, getCookie(), handleApi() (+10 more)

### Community 12 - "Editais Chevomais"
Cohesion: 0.17
Nodes (11): API, Como rodar, Editais Chevomais, Esqueci a senha do administrador, Estrutura, Observações, Onde ficam os dados, Para o time usar (um computador faz o papel de servidor) (+3 more)

### Community 13 - "ValidationError"
Cohesion: 0.20
Nodes (10): cleanCor(), cleanPapel(), cleanPortaisUser(), cleanRegras(), cleanSenha(), cleanUsuario(), novasRegras(), reordenar() (+2 more)

### Community 14 - "Inputs.tsx"
Cohesion: 0.27
Nodes (6): parseEdital(), brToIso(), Props, toTime(), horaValida(), isoValida()

### Community 15 - "normalize"
Cohesion: 0.28
Nodes (9): cleanRegrasLenient(), emptyDb(), fluxoInicial(), lerTransicoes(), load(), mutate(), normalize(), persist() (+1 more)

### Community 16 - "AuthError"
Cohesion: 0.33
Nodes (6): actorIn(), AuthError, conferirEdital(), ForbiddenError, regrasDo(), camposFaltando()

### Community 17 - "reset-password.ts"
Cohesion: 0.50
Nodes (3): db, dbPath, [usuario, senha]

## Knowledge Gaps
- **126 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 151 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `shared.ts` to `package.json`, `Modals.tsx`, `utils.ts`, `Inputs.tsx`?**
  _High betweenness centrality (0.160) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Modals.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `utils.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09831649831649832 - nodes in this community are weakly interconnected._
- **Should `shared.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055944055944055944 - nodes in this community are weakly interconnected._