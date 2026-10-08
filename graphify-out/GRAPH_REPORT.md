# Graph Report - editais-dashboard  (2026-10-08)

## Corpus Check
- 34 files · ~33,262 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .css 1, .tsbuildinfo 1)

## Summary
- 409 nodes · 953 edges · 15 communities (12 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `02098a4e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db.ts
- package.json
- Modals.tsx
- Dashboard.tsx
- shared.ts
- compilerOptions
- compilerOptions
- compilerOptions
- index.ts
- Editais Chevomais
- Admin.tsx
- FluxoEditor.tsx

## God Nodes (most connected - your core abstractions)
1. `Dashboard()` - 27 edges
2. `Edital` - 20 edges
3. `ValidationError` - 19 edges
4. `CategoriaCfg` - 18 edges
5. `compilerOptions` - 18 edges
6. `StatusCfg` - 17 edges
7. `compilerOptions` - 15 edges
8. `react` - 14 edges
9. `EditalModal()` - 14 edges
10. `todayIso()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `parseEdital()` --calls--> `horaValida()`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `parseEdital()` --calls--> `isoValida()`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `CategoriaCfg`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `Edital`  [EXTRACTED]
  server/db.ts → src/shared.ts
- `DbFile` --references--> `ImpugnacaoCfg`  [EXTRACTED]
  server/db.ts → src/shared.ts

## Import Cycles
- None detected.

## Communities (15 total, 3 thin omitted)

### Community 0 - "db.ts"
Cohesion: 0.06
Nodes (63): actorIn(), addLog(), addSession(), AuthError, BAK_FILE, BRL, CAMPOS, ChaveItens (+55 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (39): dependencies, react, react-dom, devDependencies, autoprefixer, concurrently, postcss, tailwindcss (+31 more)

### Community 2 - "Modals.tsx"
Cohesion: 0.12
Nodes (33): ItemForm(), PortaisModal(), PortalForm(), brToIso(), DateInput(), MaskedInput(), Props, TimeInput() (+25 more)

### Community 3 - "Dashboard.tsx"
Cohesion: 0.08
Nodes (49): CalendarView(), nomePortal(), BotaoFluxo(), DateCell(), EditalTable(), FluxoBotoes(), PAGE_SIZES, StatusCell() (+41 more)

### Community 4 - "shared.ts"
Cohesion: 0.08
Nodes (32): react, App(), AuthScreen(), Props, UserFormValue, api, ApiError, NewUser (+24 more)

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
Cohesion: 0.09
Nodes (20): ConflictError, db, dbPath, UserRecord, attempts, Ctx, DIST, getCookie() (+12 more)

### Community 12 - "Editais Chevomais"
Cohesion: 0.17
Nodes (11): API, Como rodar, Editais Chevomais, Esqueci a senha do administrador, Estrutura, Observações, Onde ficam os dados, Para o time usar (um computador faz o papel de servidor) (+3 more)

### Community 13 - "Admin.tsx"
Cohesion: 0.10
Nodes (41): DbFile, CfgMode, CORES, Item, ListaOrdenavel(), PortalMode, REGRA_LABEL, resumo() (+33 more)

### Community 14 - "FluxoEditor.tsx"
Cohesion: 0.19
Nodes (13): borda(), chave(), FluxoEditor(), Geo, geometria(), layoutAutomatico(), Pos, Pt (+5 more)

## Knowledge Gaps
- **127 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `shared.ts` to `package.json`, `Modals.tsx`, `Dashboard.tsx`, `Admin.tsx`, `FluxoEditor.tsx`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _127 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0601404741000878 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Modals.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11740890688259109 - nodes in this community are weakly interconnected._
- **Should `Dashboard.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08299240210403273 - nodes in this community are weakly interconnected._
- **Should `shared.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08461538461538462 - nodes in this community are weakly interconnected._