# Editais Chevomais

Central de registro e acompanhamento de editais (Tintas e Pneus).
Front-end em **Vite + React + TypeScript + Tailwind**, API em **Express** e banco em **`server/db.ts`**
(arquivo JSON em disco — sem PostgreSQL e sem depender do cache do navegador).

## Como rodar

Requisitos: Node 18 ou superior.

```bash
npm install
npm run dev
```

Abra http://localhost:5173. O `npm run dev` sobe junto:

- a API em `http://localhost:3001` (`tsx watch server/index.ts`)
- o Vite em `http://localhost:5173` (já com proxy de `/api` para a API)

### Produção / uso diário (uma porta só)

```bash
npm run build   # confere os tipos e gera a pasta dist/
npm start       # API + site em http://localhost:3001
```

Para trocar a porta: `PORT=4000 npm start` (no PowerShell: `$env:PORT=4000; npm start`).

## Onde ficam os dados

Tudo é gravado em **`data/db.json`** (editais, retificações, nome e cargo). Por isso os dados:

- sobrevivem a limpar o cache/cookies, trocar de navegador e reiniciar o servidor;
- são compartilhados por qualquer navegador que abra o painel.

O `server/db.ts` ainda cuida de:

- **gravação atômica** (escreve em arquivo temporário e renomeia — queda de energia não corrompe);
- **backup automático**: a versão anterior fica em `data/db.bak.json` a cada gravação;
- **escritas em fila**: dois cliques ao mesmo tempo nunca sobrescrevem um ao outro;
- **arquivo corrompido**: guarda uma cópia (`db.corrompido-*.json`) e sobe vazio, sem apagar o original.

Para guardar os dados em outra pasta (ex.: OneDrive): `DATA_DIR=D:\Backup\editalsync npm start`.
Para fazer backup ou mudar de computador, basta copiar o `data/db.json`.

> O `.gitignore` ignora `data/*.json` para que seus editais não vão para o Git por engano.

## Nome e cargo

Clique no seu nome no canto superior direito (ou em **Configurações** no menu lateral) para
editar nome e cargo. Ficam salvos no `data/db.json`.

## Estrutura

```
server/
  db.ts            banco: leitura/gravação do data/db.json + validação + regras (retificação, prazos)
  index.ts         API Express (e serve o dist/ em produção)
src/
  shared.ts        tipos e constantes usados pelo front e pela API
  App.tsx          estado da tela, filtros, modais
  lib/api.ts       chamadas à API
  lib/utils.ts     datas, moeda, filtro de período, exportar CSV
  components/      Sidebar, Header, FilterBar, Kpis, RegionPanel, RetifPanel, EditalTable, Modals
data/              db.json é criado aqui na primeira gravação
```

## API

Todas as rotas devolvem o estado completo `{ settings, editais }` já gravado em disco.

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/api/state` | lê tudo |
| PUT | `/api/settings` | salva `{ nome, cargo }` |
| POST | `/api/editais` | cria edital |
| PUT | `/api/editais/:id` | altera campos do edital (parcial) |
| POST | `/api/editais/delete` | exclui `{ ids: number[] }` |
| POST | `/api/editais/:id/retifs` | registra retificação `{ desc, data?, hora? }` (calcula dias de prorrogação e muda o status para Retificado) |
| DELETE | `/api/editais` | apaga todos os editais (mantém nome e cargo) |

## Observação

Os dados do `code.html` antigo ficavam no `localStorage` do navegador e **não são importados** por este projeto.
