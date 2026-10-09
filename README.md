# Editais Chevomais

Central de registro e acompanhamento de editais (Tintas e Pneus), com **login por usuário** e
**dados compartilhados**: todos enxergam e alteram os mesmos editais, e a tela de cada pessoa se
atualiza sozinha quando outro usuário muda algo.

Front-end em **Vite + React + TypeScript + Tailwind**. A API roda em Node puro (sem Express, sem banco
externo) e guarda tudo no arquivo `data/db.json` por meio do `server/db.ts`.

## Como rodar

Requisitos: Node 18 ou superior.

```bash
npm install
npm run dev        # desenvolvimento: site em http://localhost:5173 (API em :3001)
```

### Para o time usar (um computador faz o papel de servidor)

```bash
npm install
npm run build      # confere os tipos e gera a pasta dist/
npm start          # site + API em http://localhost:3001
```

Ao iniciar, o terminal mostra os endereços, por exemplo:

```
Neste computador: http://localhost:3001
Na rede:          http://192.168.0.15:3001   <- é este que os colegas abrem no navegador
```

- Os colegas precisam estar na mesma rede e a porta 3001 precisa estar liberada no firewall do
  computador servidor (no Windows, aparece um aviso do firewall na primeira vez: permita).
- Para mudar a porta: `PORT=4000 npm start` (PowerShell: `$env:PORT=4000; npm start`).
- Para aceitar só acessos deste computador: `HOST=127.0.0.1 npm start`.
- O servidor precisa ficar ligado para os outros acessarem. Os dados ficam no computador dele.

## Primeiro acesso, usuários e permissões

1. Na primeira vez que abrir, aparece **"Primeiro acesso"**: crie o administrador (nome, cargo, usuário e senha).
2. Depois, o administrador cadastra os demais em **Usuários** (menu lateral): login, nome, cargo, senha e permissão.
3. Cada pessoa entra com o próprio usuário e senha.

| | Usuário | Administrador |
| --- | :---: | :---: |
| Ver, cadastrar, editar e excluir editais e retificações (dados compartilhados) | sim | sim |
| Mudar o próprio nome, cargo e senha | sim | sim |
| Criar, editar, redefinir senha e excluir usuários | não | sim |
| Apagar **todos** os editais de uma vez | não | sim |

Cada edital e cada retificação guardam **quem cadastrou e quem alterou por último** (aparece na tabela,
no painel de retificações e no histórico).

### Vários usuários ao mesmo tempo

- A tela consulta o servidor a cada ~4 segundos (a consulta é leve) e também ao voltar para a aba.
  O que um usuário faz aparece para os outros sem recarregar a página.
- Se duas pessoas editam o **mesmo edital** ao mesmo tempo, quem salvar depois recebe um aviso dizendo
  quem alterou, a tela é atualizada e é possível revisar e salvar de novo. Ninguém sobrescreve sem querer.
- Se a conexão com o servidor cair, aparece um aviso no topo e a tela volta ao normal sozinha.

### Esqueci a senha do administrador

Pare o servidor (Ctrl+C) e rode, na pasta do projeto:

```bash
npm run reset-password -- <usuario> <nova-senha>
```

Depois suba o servidor de novo. (Os outros administradores também podem redefinir a senha de qualquer
usuário em **Usuários → editar**.)

## Onde ficam os dados

Tudo em **`data/db.json`** (editais, retificações, usuários e sessões). Por isso os dados sobrevivem a
limpar o cache, trocar de navegador e reiniciar o servidor.

O `server/db.ts` ainda cuida de:

- **gravação atômica** (escreve em arquivo temporário e renomeia — queda de energia não corrompe);
- **backup automático**: a versão anterior fica em `data/db.bak.json` a cada gravação;
- **escritas em fila**: dois cliques ao mesmo tempo nunca sobrescrevem um ao outro;
- **arquivo corrompido**: guarda uma cópia (`db.corrompido-*.json`) e sobe vazio, sem apagar o original;
- **permissão restrita** no arquivo (só o dono lê), pois ele contém os hashes das senhas.

Para guardar em outra pasta: `DATA_DIR=D:\Backup\chevomais npm start`.
Para fazer backup ou trocar de computador, copie a pasta `data/` (com o servidor parado ou não).

> O `.gitignore` ignora `data/*.json` para que editais e senhas não vão para o Git por engano.

## Segurança (o que está pronto e o que depende de você)

- Senhas guardadas com **scrypt** e sal individual; nunca em texto, nunca enviadas ao navegador.
- Sessão por token aleatório em cookie **HttpOnly** (o JavaScript da página não consegue ler); no servidor
  fica só o hash do token. Validade de 30 dias; sair, trocar a senha ou ser excluído encerra as sessões.
- Bloqueio temporário após muitas senhas erradas (proteção contra tentativa e erro).
- Todas as rotas de dados exigem login; as de usuários exigem administrador (conferido no servidor, não só na tela).
- O acesso por rede local usa **HTTP simples**: serve para a rede interna da empresa. Para publicar na
  internet, coloque atrás de HTTPS (proxy reverso como Nginx/Caddy) e rode com `COOKIE_SECURE=1`.

## Estrutura

```
server/
  db.ts              banco: leitura/gravação do data/db.json, usuários, sessões, regras (retificação, prazos)
  index.ts           API (node:http) e, em produção, serve a pasta dist/
  precificador.ts    Precificador: tabelas próprias no PostgreSQL (marcas, modelos, processos)
  sql/               SQL das tabelas do Precificador (criadas sozinhas; o arquivo é para criar à mão)
  reset-password.ts  redefine senha pelo terminal
src/
  shared.ts          tipos e constantes usados pelo front e pela API
  App.tsx            porta de entrada: primeiro acesso, login ou painel
  Dashboard.tsx      painel (filtros, tabela, modais, sincronização ao vivo)
  lib/api.ts         chamadas à API
  lib/utils.ts       datas, moeda, filtro de período, exportar CSV
  lib/precos.ts      cálculos do Precificador e leitura/gravação das planilhas .xlsx
  components/        Sidebar, Header, FilterBar, Kpis, RegionPanel, RetifPanel, EditalTable, Modals, AuthScreens
  components/precificador/  telas do Precificador e de Marcas e Modelos
tailwind.config.js   cores do tema (paleta clara)
data/                db.json é criado aqui na primeira gravação
```

## Precificador (menu Disputa)

Precificação de itens de editais, com processos salvos no servidor (qualquer usuário continua de onde outro parou).

1. **Novo processo**: importe a planilha de itens do edital. Primeira linha com os títulos *Lote*, *Item*, *Valor de referência*
   e, se tiver, *Quantidade* e *Descrição* (sem títulos: A = lote, B = item, C = referência, D = quantidade). Dá para vincular a um edital.
2. Em cada item: **Modelo** → **Marca** (sugestões do catálogo, mais usados primeiro; o que não existe aparece em laranja como "novo")
   → **Custo** (aceita contas, ex.: `120+15,5`). Enter no custo vai para o custo da linha seguinte.
3. **Preço** = custo × (1 + margem), arredondado para cima no centavo — ou, se escolhido, R$ 0,10 abaixo de R$ 100 e R$ 1 acima.
   Verde: até a referência; amarelo: até 10% acima; vermelho: mais que isso.
4. Cada lote é **Unitário** (disputa pela soma dos unitários) ou **Global** (soma de unitário × quantidade).
   Lotes com mais de um item começam como Global.
5. **Exportar**: Proposta, Disputa (as duas regras da planilha antiga: o que passa 10% da referência fica de fora; na proposta
   vai o maior entre preço e referência, e item sem referência vai com 3× o preço) ou a planilha completa para conferência.
   Ao exportar, marcas/modelos novos entram no catálogo e o uso de cada um é contado (uma vez por processo).

O processo grava sozinho ~1,5 s depois de cada alteração. Se duas pessoas editarem o mesmo processo, quem gravar depois vê um
aviso e escolhe entre recarregar ou gravar por cima. **Marcas e Modelos** (menu Disputa) é o catálogo: cadastrar, renomear,
excluir e importar planilha com as colunas *Marca* e *Modelo*. Excluir processos, marcas e modelos segue a permissão "excluir"
do perfil do usuário.

**Banco:** o Precificador exige PostgreSQL (`DATABASE_URL`). Ele usa tabelas próprias — `precif_marcas`, `precif_modelos` e
`precif_processos` — criadas automaticamente na primeira vez que a tela é aberta. Para criar à mão:
`psql "$DATABASE_URL" -f server/sql/precificador.sql`.

## API

| Método | Rota | Quem | O que faz |
| --- | --- | --- | --- |
| GET | `/api/auth/status` | todos | diz se precisa do primeiro acesso e quem está logado |
| POST | `/api/auth/setup` | todos (só 1ª vez) | cria o administrador |
| POST | `/api/auth/login` · `/api/auth/logout` | todos | entrar / sair |
| GET | `/api/state` (`?since=<rev>`) | logado | estado completo; com `since` devolve só `{ unchanged: true }` se nada mudou |
| PUT | `/api/me` · POST `/api/me/password` | logado | perfil e troca de senha |
| POST | `/api/users` · PUT/DELETE `/api/users/:id` | admin | gerenciar usuários |
| POST | `/api/editais` | logado | cria edital |
| PUT | `/api/editais/:id` | logado | altera campos (parcial; `v` opcional detecta edição simultânea) |
| POST | `/api/editais/delete` | logado | exclui `{ ids }` |
| POST | `/api/editais/:id/retifs` | logado | registra retificação (calcula dias de prorrogação e muda o status) |
| DELETE | `/api/editais` | admin | apaga todos os editais |
| GET · POST | `/api/precificador/processos` | logado | lista (resumo) / cria processo |
| GET · PUT · DELETE | `/api/precificador/processos/:id` | logado (excluir: perfil) | abre / grava (`v` detecta edição simultânea) / exclui |
| POST | `/api/precificador/processos/:id/registrar-uso` | logado | põe marcas/modelos novos no catálogo e conta o uso |
| GET | `/api/precificador/catalogo` | logado | marcas e modelos |
| POST · PUT · DELETE | `/api/precificador/marcas[/:id]` · `/modelos[/:id]` | logado (excluir: perfil) | cadastro do catálogo |
| POST | `/api/precificador/catalogo/importar` | logado | importa pares `{ marca, modelo }` |

## Observações

- Os dados do `code.html` antigo ficavam no `localStorage` do navegador e **não são importados**.
- Se vier de uma versão anterior deste projeto (com `data/db.json` sem usuários), os editais são mantidos
  e o "Primeiro acesso" já vem com o nome e o cargo que estavam salvos.
- **Cadastro do edital:** a UASG / identificação aceita qualquer número ou texto. O **portal** é escolhido numa lista
  (Comprasnet, Licitações-e, BLL e outros) ou digitado em "Outro". No lugar do valor estimado há o **valor ganho**, que
  aceita centavos (`15000`, `15.000,50` ou `15000.50`); deixe vazio enquanto não ganhou.
- O antigo campo "valor estimado" foi removido. Valores estimados que existissem num `data/db.json` antigo são descartados
  na próxima gravação — faça uma cópia da pasta `data/` antes de atualizar se quiser guardá-los.
