# Personal Organization Manager v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a v1 do organizador pessoal: um app local, aberto direto do disco, com Quadro, Hoje, Agenda, Checkpoint, Perfil e Ajustes.

**Architecture:** Scripts clássicos sob o global `App` (módulos ES não funcionam em `file://`). Regras puras em `js/logic`, testadas com Node; estado e persistência em `js/data`; telas em `js/ui`, que redesenham a partir do `store`.

**Tech Stack:** HTML, CSS e JavaScript puros; IndexedDB; File System Access API; `node --test`; `playwright-core` só para verificação, instalado fora do repo.

**Spec:** `docs/superpowers/specs/2026-11-05-personal-organization-manager-design.md`

## Global Constraints

- Sem build e sem dependências em produção; tudo funciona aberto de `file://` e sem internet.
- Toda a interface em português do Brasil.
- Datas são strings locais `AAAA-MM-DD`. Nunca usar `new Date('AAAA-MM-DD')` nem `toISOString()` para obter um dia: isso desloca a data no fuso do Brasil.
- Regras em `js/logic` não acessam DOM nem o relógio: recebem `today` como parâmetro.
- A linha de uma demanda mostra só checkbox, etiqueta, título e prazo.
- Nenhum nome de cliente ou dado pessoal no código. `.gitignore` já exclui `organizador-dados*.json` e `.superpowers/`.
- Texto do usuário entra no DOM só por `textContent` ou pelo helper `App.h`, nunca por `innerHTML`.
- Respeitar `prefers-reduced-motion`; foco de teclado visível; `Esc` fecha painéis e diálogos.
- Cada arquivo segue o padrão:

```js
(function (root) {
  const api = { /* ... */ };
  root.App = root.App || {};
  root.App.nome = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
```

## Review Focus

1. Título ou cliente com HTML ou símbolos (`TETA`, `<b>x</b>`): aparece literal, sem quebrar a tela nem executar nada. Teste na Task 6.
2. Virada de mês e fuso: "todo dia 31" em fevereiro e datas perto da meia-noite no fuso UTC-3 não mudam de dia. Teste na Task 1.
3. Foto muito grande, ou espaço do navegador esgotado: a foto é reduzida, e a falha de gravação vira mensagem visível, sem perder os dados atuais. Teste na Task 4.
4. Arquivo de importação inválido ou de outro formato: recusado, com os dados atuais intactos. Teste na Task 4.
5. Excluir setor ou sessão com demandas: rotinas e compromissos saem, pontuais continuam no Histórico, nenhuma tela quebra por referência perdida. Teste na Task 3.

---

### Task 1: Datas e recorrência

**Files:**
- Create: `js/logic/dates.js`, `js/logic/recurrence.js`
- Test: `tests/recurrence.test.js`

**Interfaces:**
- Produces:
  - `App.dates`: `toISO(date: Date) -> string`, `fromISO(iso) -> Date` (local), `addDays(iso, n) -> string`, `weekday(iso) -> 0..6`, `lastDayOfMonth(year, month1to12) -> number`, `compare(a, b) -> -1|0|1`.
  - `App.recurrence`:
    - `nextOccurrence(freq, afterISO) -> iso`: primeira ocorrência estritamente depois de `afterISO`.
    - `occursOn(freq, iso) -> boolean`
    - `rotinaStatus(item, today) -> { state: 'done'|'due'|'overdue'|'upcoming', date: iso }`
    - `completeRotina(item, today) -> item` e `undoRotina(item) -> item`: retornam novo objeto.
  - Campos da rotina: `freq { type:'daily'|'weekly'|'monthly', weekday?, day? }`, `startDate`, `doneThrough: iso|null`, `completions: [{ occurrence, doneOn, prevDoneThrough }]`.

- [ ] **Step 1: Escrever os testes que falham**

Casos obrigatórios (`today` sempre explícito):

```js
const m31 = { type: 'monthly', day: 31 };
assert.equal(nextOccurrence(m31, '2026-01-31'), '2026-02-28');
assert.equal(nextOccurrence(m31, '2028-01-31'), '2028-02-29'); // bissexto
assert.equal(nextOccurrence({ type: 'weekly', weekday: 1 }, '2026-11-02'), '2026-11-09');
assert.equal(addDays('2026-11-30', 1), '2026-12-01');
assert.equal(toISO(new Date(2026, 10, 5, 23, 30)), '2026-11-05'); // perto da meia-noite local

// diária não acumula
rotinaStatus(daily({ startDate: '2026-11-01' }), '2026-11-05'); // { state:'due', date:'2026-11-05' }
// semanal atrasada: vários ciclos viram uma pendência, com a data mais antiga
rotinaStatus(weeklySeg({ startDate: '2026-10-01' }), '2026-11-05'); // { state:'overdue', date:'2026-10-05' }
// concluir acerta todos os ciclos até hoje
rotinaStatus(completeRotina(weeklySeg({ startDate: '2026-10-01' }), '2026-11-05'), '2026-11-05'); // { state:'done', date:'2026-11-09' }
// volta sozinha na data seguinte
rotinaStatus(completeRotina(weeklySeg({ startDate: '2026-10-01' }), '2026-11-05'), '2026-11-09'); // { state:'due', date:'2026-11-09' }
// rotina nova com data futura
rotinaStatus(monthly5({ startDate: '2026-11-06' }), '2026-11-06'); // { state:'upcoming', date:'2026-12-05' }
// desfazer restaura o atraso
rotinaStatus(undoRotina(completeRotina(weeklySeg({ startDate: '2026-10-01' }), '2026-11-05')), '2026-11-05'); // { state:'overdue', date:'2026-10-05' }
```

Concluir uma rotina `upcoming` adianta um ciclo: `doneThrough` passa a ser a próxima data.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/`
Expected: FAIL, módulos inexistentes.

- [ ] **Step 3: Implementar `dates.js` e `recurrence.js`**

Âncora de `rotinaStatus`: `doneThrough`, ou o dia anterior a `startDate`. Primeira ocorrência depois da âncora maior que `today`: `done` se há `completions`, senão `upcoming`. Igual a `today`: `due`. Menor: `overdue`, exceto na diária, que usa `today` como data e nunca atrasa.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic tests
git commit -m "feat: regras de datas e recorrência"
```

### Task 2: Pendências, adição rápida e hábitos

**Files:**
- Create: `js/logic/pending.js`, `js/logic/quickadd.js`, `js/logic/habits.js`
- Test: `tests/pending.test.js`, `tests/quickadd.test.js`, `tests/habits.test.js`

**Interfaces:**
- Consumes: `App.dates`, `App.recurrence`.
- Produces:
  - `App.pending`:
    - `pendingByDay(items, today) -> [{ date, items[] }]`, dia mais recente primeiro.
    - `todayList(items, today) -> item[]`
    - `dayProgress(items, today) -> { done, total }`
    - `historyByDay(items) -> [{ date, done[], moved[], deleted[] }]`, dia mais recente primeiro.
  - `App.quickadd.parse(text) -> { clientName: string|null, title: string } | null`
  - `App.habits`: `isFulfilled(habit, value) -> boolean`, `streak(habit, log, today) -> number`, `lastDays(habit, log, today, n=7) -> [{ date, fulfilled }]`.
  - Entrada de log da demanda: `{ day: iso, at: isoDatetime, action: 'created'|'done'|'moved'|'deleted', from?, to? }`.

- [ ] **Step 1: Escrever os testes que falham**

```js
assert.deepEqual(parse('ACME - enviar boletos'), { clientName: 'ACME', title: 'enviar boletos' });
assert.deepEqual(parse('ACME - revisar - urgente'), { clientName: 'ACME', title: 'revisar - urgente' }); // só o primeiro separador
assert.deepEqual(parse('pagar-contas'), { clientName: null, title: 'pagar-contas' }); // hífen sem espaços
assert.deepEqual(parse('  - sem cliente '), { clientName: null, title: '- sem cliente' });
assert.deepEqual(parse('ACME - '), { clientName: null, title: 'ACME -' });
assert.equal(parse('   '), null);
```

`pendingByDay`: inclui pontual aberta com `dueDate < today`, agrupada por `dueDate`. Exclui `dueDate` nula, data de hoje, futura, concluída, excluída, rotina e compromisso.

`todayList`: rotinas `due` e `overdue`, rotinas concluídas hoje (`completions` com `doneOn === today`), compromissos do dia, pontuais com `dueDate === today` (abertas ou concluídas). Exclui pontual atrasada, excluída e compromisso excluído.

`dayProgress`: conta sobre `todayList`.

`historyByDay`: agrupa as entradas de `log` das pontuais pelo campo `day`; `created` não aparece.

`isFulfilled`: check com `true`; counter com `value >= goal`; list com todos os `listItems` marcados; `undefined` retorna `false` nos três.

`streak`: dias seguidos terminando hoje. Se hoje ainda não foi cumprido, conta a partir de ontem, sem zerar a sequência.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/`
Expected: FAIL.

- [ ] **Step 3: Implementar os três módulos**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic tests
git commit -m "feat: regras de pendências, adição rápida e hábitos"
```

### Task 3: Estado e ações

**Files:**
- Create: `js/data/seed.js`, `js/data/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: `App.dates`, `App.recurrence`, `App.quickadd`.
- Produces:
  - `App.seed.initialState({ start: 'exemplo'|'vazio', name? }) -> state`, no formato da seção 7.2 da spec, com `version: 1`. Cor de destaque padrão `#f2b872`, tema `dark`, fonte `Manrope`, tamanho `100`. Hábitos iniciais: Água (counter, meta 8), Treino (check), Refeições (list: Café, Almoço, Jantar).
  - `App.createStore(state, { now = () => new Date() }) -> store`:
    - Base: `getState()`, `subscribe(fn) -> unsubscribe`, `today() -> iso`, `undo() -> boolean`, `canUndo()`, `replaceState(state)`.
    - Demandas: `quickAdd({ kind, sectorId, text }) -> item|null`, `addCompromisso({ sectorId, title, start, durationMin = 60 }) -> item`, `updateItem(id, patch)`, `toggleItem(id)`, `deleteItem(id)`, `movePontual(id, iso|null)`, `moveDay(fromIso, toIso)`, `deleteDay(fromIso)`, `clearHistory()`.
    - Organização: `addSession(name)`, `updateSession(id, patch)`, `deleteSession(id)`, `addSector(sessionId, name)`, `updateSector(id, patch)`, `deleteSector(id)`, `reorder(collection, id, newIndex)`, `updateClient(id, patch)`.
    - Hábitos: `addHabitGroup(name)`, `updateHabitGroup(id, patch)`, `deleteHabitGroup(id)`, `addHabit(groupId, fields)`, `updateHabit(id, patch)`, `deleteHabit(id)`, `setHabitValue(habitId, iso, value)`.
    - Geral: `setSettings(patch)`, `setProfile(patch)`.
  - `clearHistory` apaga entradas de `log` das pontuais e remove as pontuais com `deletedAt`.
  - `undo` cobre a última ação destrutiva ou em lote: `deleteItem`, `moveDay`, `deleteDay`, `deleteSector`, `deleteSession`, `movePontual`.

- [ ] **Step 1: Escrever os testes que falham**

Com `now` fixo em `new Date(2026, 10, 5, 10, 0)`:

```js
store.quickAdd({ kind: 'pontual', sectorId: s, text: 'acme - enviar boletos' });
store.quickAdd({ kind: 'pontual', sectorId: s, text: 'ACME - outra' });
// um único cliente, nome 'ACME', com color preenchida; pontual com dueDate '2026-11-05' e log 'created'
store.quickAdd({ kind: 'rotina', sectorId: s, text: 'conciliar' });
// freq { type:'daily' }, startDate de hoje

store.movePontual(id, '2026-11-10'); // log { action:'moved', from:'2026-11-05', to:'2026-11-10', day:'2026-11-05' }
store.movePontual(id, null);         // dueDate null
store.deleteItem(id); store.undo();  // deletedAt volta a ausente, log sem 'deleted'
store.toggleItem(pontualId);         // doneAt e log 'done'; de novo: remove doneAt e a entrada 'done'
store.moveDay('2026-11-03', '2026-11-05'); store.undo(); // volta ao estado anterior
store.deleteSector(s);
// rotinas e compromissos de s removidos; pontuais com deletedAt e sectorId null, ainda em historyByDay
store.clearHistory(); // pontuais excluídas somem; historyByDay vazio
assert.deepEqual(App.seed.initialState({ start: 'vazio' }).sectors.map(x => x.name), ['Geral', 'Geral', 'Geral']);
// initialState({start:'exemplo'}): Trabalho com Financeiro, Comercial, Operações, Vendas, Suporte
assert.equal(App.seed.initialState({ start: 'exemplo' }).clients.length, 0);
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/`
Expected: FAIL.

- [ ] **Step 3: Implementar `seed.js` e `store.js`**

Undo guarda uma cópia JSON de `items` e `sectors` e `sessions`, sem imagens de `settings` e `profile`. Cor de cliente sai de uma paleta fixa de 8 cores, em rodízio. IDs com `crypto.randomUUID()`.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/data tests
git commit -m "feat: estado do app e ações"
```

### Task 4: Persistência, imagens e prova em file://

**Files:**
- Create: `js/data/persist.js`, `js/data/images.js`, `index.html`, `js/main.js`
- Test: `tests/persist.test.js`, `<scratchpad>/ui/persist-check.js`

**Interfaces:**
- Consumes: `App.createStore`.
- Produces:
  - `App.persist`:
    - `validateImport(obj) -> { ok: true } | { ok: false, error: string }`, função pura.
    - `load() -> Promise<state|null>`, `save(state) -> Promise<void>`
    - `attach(store)`: salva até 2 segundos depois de cada mudança.
    - `chooseFolder() -> Promise<boolean>`, `reconnectFolder() -> Promise<boolean>`
    - `exportFile(state)`, `importFile(file) -> Promise<state>`, que rejeita com mensagem em português.
    - `onStatus(fn)`, com `{ state: 'saved'|'saving'|'error', file: 'off'|'on'|'needs-permission', message? }`.
    - `isFileSyncAvailable() -> boolean`.
  - `App.images.resize(file, maxPx) -> Promise<dataUrl>`, com lado maior limitado a `maxPx`. Valores: `App.images.SIZES = { wallpaper: 1920, cover: 600, avatar: 256 }`.
  - `index.html` carrega os scripts na ordem de dependência.

- [ ] **Step 1: Escrever os testes que falham de `validateImport`**

Recusa: `null`, `[]`, `{}`, `version` maior que a atual, `items` que não é lista, `sessions` ausente. Aceita `App.seed.initialState({ start: 'vazio' })`.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/persist.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `persist.js`, `images.js`, `index.html` mínimo e `main.js`**

Banco `organizador`, stores `state` e `handles`. Arquivo `organizador-dados.json` gravado por `createWritable`. Falha de IndexedDB ou de arquivo vira status `error` com mensagem, e o estado em memória é mantido. Sem suporte à API, `file` fica `off`. Importar baixa antes um backup dos dados atuais.

- [ ] **Step 4: Rodar os testes de Node**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Instalar a verificação fora do repo**

Run: `npm install playwright-core --prefix <scratchpad>/ui`
Expected: instalação sem erro. Usar `executablePath` do Chrome já instalado (`C:\Program Files\Google\Chrome\Application\chrome.exe`).

- [ ] **Step 6: Provar a persistência em `file://`**

`persist-check.js` abre `file:///.../index.html` com perfil persistente, altera o estado por `App.store`, aguarda o salvamento, fecha o navegador, reabre e confirma que o dado voltou. Depois, redimensiona uma imagem de 4000 x 3000 gerada em canvas e confirma lado maior de 1920. Depois, força falha em `indexedDB.open` e confirma status `error`.
Run: `node <scratchpad>/ui/persist-check.js`
Expected: `IDB OK`, `RESIZE OK`, `ERRO VISIVEL OK`.

- [ ] **Step 7: Provar a gravação do arquivo**

O diálogo de pasta exige uma pessoa. Pedir ao usuário: abrir `index.html` no Chrome, clicar no botão de pasta e escolher uma pasta de teste fora do repo. Confirmar que `organizador-dados.json` apareceu e que contém a alteração. Se falhar, avisar o usuário e seguir com exportar e importar como garantia, como a spec prevê.

- [ ] **Step 8: Commit**

```bash
git add js index.html tests
git commit -m "feat: persistência em IndexedDB e arquivo"
```

### Task 5: Casca visual, temas e primeira abertura

**Files:**
- Create: `css/tokens.css`, `css/app.css`, `fonts/*`, `js/ui/h.js`, `js/ui/shell.js`, `js/ui/onboarding.js`
- Modify: `index.html`, `js/main.js`

**Interfaces:**
- Consumes: `App.store`, `App.persist`, `App.seed`.
- Produces:
  - `App.h(tag, attrs, ...children) -> Element`: texto vira nó de texto; atributos `onX` viram listeners.
  - `App.shell`: `register(viewName, { render(container, store) })`, `navigate(viewName)`, `currentSession() -> id`, `setSession(id)`, `toast(message, { undo? })`, `applySettings(settings)`.
  - Views: `quadro`, `hoje`, `agenda`, `checkpoint`, `perfil`, `ajustes`.
  - Variáveis CSS: `--accent`, `--font`, `--font-scale`, `--glass`, `--text`, `--muted`, `--radius: 20px`, `--scrim`.
  - `App.persist.attach` ligado em `main.js`; `App.store` criado em `main.js`.

- [ ] **Step 1: Baixar as fontes**

Run: `npm pack @fontsource-variable/manrope @fontsource-variable/instrument-sans @fontsource-variable/fraunces` em `<scratchpad>/fonts`.
Copiar só os `.woff2` do subconjunto latino para `fonts/`, com a licença OFL de cada uma.

- [ ] **Step 2: Implementar `tokens.css`, `app.css`, `h.js`, `shell.js`**

Valores do mockup aprovado em `.superpowers/brainstorm/.../visual-3-versoes.html`, bloco `.b`: gradiente de fundo, vidro `rgba(16,24,27,.55)` com `blur(20px)`, borda `rgba(255,255,255,.08)`, destaque `#f2b872`, menu em pílula. O tema claro usa vidro claro. `--scrim` fica entre o fundo e os cards para manter o texto legível com qualquer foto. Menu: Quadro, Hoje, Agenda, Checkpoint, seletor de sessão, busca, indicador de salvamento e avatar. Abaixo de 1024 px, as colunas se empilham.

- [ ] **Step 3: Implementar `onboarding.js`**

Aparece quando `App.persist.load()` retorna `null`. Campos e ordem: nome, "Com setores de exemplo" ou "Vazio", botão de pasta com "Pular" (some se `isFileSyncAvailable()` for falso).

- [ ] **Step 4: Verificar no Chrome**

Script em `<scratchpad>/ui/shell-check.js`: primeira abertura aparece; escolher "Vazio" leva ao Quadro; reabrir não mostra a primeira abertura; navegar pelas quatro abas; `setSettings({ theme:'light' })` muda `--text`; nenhuma mensagem de erro no console. Tirar captura de tela e conferir com o mockup B.
Expected: todas as verificações passam.

- [ ] **Step 5: Commit**

```bash
git add css fonts js index.html
git commit -m "feat: casca visual, temas e primeira abertura"
```

### Task 6: Quadro e painel de detalhes

**Files:**
- Create: `js/ui/board.js`, `js/ui/panel.js`, `js/ui/search.js`
- Modify: `css/app.css`, `index.html`

**Interfaces:**
- Consumes: `App.h`, `App.shell`, `App.store`, `App.recurrence`, `App.pending.dayProgress`.
- Produces: `App.panel.open(itemId)`, `App.panel.close()`, `App.search.openClient(clientId)`, `App.ui.itemRow(item, store) -> Element`, usada também por Hoje e Agenda.

- [ ] **Step 1: Implementar `board.js`**

Conforme a seção 3.1 da spec: saudação com símbolo, progresso, cards com duas colunas e adição rápida. Pontual atrasada com marca discreta. Compromisso na coluna Pontuais até `start + durationMin` passar. Setor: criar, renomear, reordenar e excluir, com confirmação quando tem demandas.

- [ ] **Step 2: Implementar `panel.js`**

Conforme a seção 3.6. Fecha com `Esc` e clique fora. Frequência: diária; semanal com dia da semana; mensal com dia de 1 a 31. Excluir mostra toast com desfazer.

- [ ] **Step 3: Implementar `search.js`**

Busca no menu e clique na etiqueta abrem a mesma lista: resultados em todas as sessões, agrupados por setor, sem itens excluídos.

- [ ] **Step 4: Verificar no Chrome**

Script `<scratchpad>/ui/board-check.js`:
- Adição rápida de `ACME - enviar boletos` mostra a etiqueta `ACME` e o título.
- Adição de `<b>x</b> - <img src=x onerror=alert(1)>` e de `TETA - Enviar imposto` mostra o texto literal, sem novos elementos `b` ou `img` na página.
- Marcar uma pontual tira ela do Quadro; desmarcar pelo Histórico fica para a Task 7.
- Trocar uma rotina para mensal, dia 31, salva e mostra a próxima data.
- Clicar em `ACME` lista as demandas de `ACME` em dois setores de sessões diferentes.
- Excluir e clicar em desfazer restaura a demanda.
- A linha da demanda contém só checkbox, etiqueta, título e prazo; notas não aparecem nela.

Expected: todas passam. Tirar captura e conferir com o mockup.

- [ ] **Step 5: Commit**

```bash
git add css js index.html
git commit -m "feat: quadro, painel de detalhes e busca"
```

### Task 7: Hoje, Pendências e Histórico

**Files:**
- Create: `js/ui/today.js`
- Modify: `css/app.css`, `index.html`

**Interfaces:**
- Consumes: `App.pending`, `App.store`, `App.ui.itemRow`, `App.shell.toast`.
- Produces: view `hoje`.

- [ ] **Step 1: Implementar as três abas**

Conforme as seções 3.2 e 5.2. Em Pendências, cada item tem Para hoje, Outra data, Excluir e Sem data; cada dia tem "Mover tudo para hoje" e "Excluir tudo", com toast de desfazer. No Histórico, cada dia lista concluídas, adiadas e excluídas; concluídas podem ser desmarcadas.

- [ ] **Step 2: Implementar a virada do dia**

Em `shell.js`: verificar `store.today()` ao voltar o foco e a cada minuto, e redesenhar se mudou.

- [ ] **Step 3: Verificar no Chrome**

Script `<scratchpad>/ui/today-check.js`, com `page.clock` do Playwright para avançar o relógio:
- Pontual criada no dia 5 e não feita aparece em Pendências no dia 6, no grupo do dia 5, com contador 1.
- "Para hoje" a coloca no checklist; o Histórico do dia 5 registra o adiamento.
- "Outra data" tira de Pendências; "Sem data" tira e mantém no Quadro; "Excluir" tira e registra.
- "Mover tudo" e desfazer voltam à relação anterior.
- Rotina diária não aparece em Pendências; semanal perdida aparece como atrasada em Hoje.
- Avançar a meia-noite com a aba aberta atualiza a tela sem recarregar.

Expected: todas passam.

- [ ] **Step 4: Commit**

```bash
git add css js index.html
git commit -m "feat: telas Hoje, Pendências e Histórico"
```

### Task 8: Agenda

**Files:**
- Create: `js/logic/agenda.js`, `js/ui/agenda.js`
- Modify: `css/app.css`, `index.html`
- Test: `tests/agenda.test.js`

**Interfaces:**
- Consumes: `App.recurrence.occursOn`, `App.store.addCompromisso`, `App.panel.open`.
- Produces:
  - `App.agenda.eventsBetween(items, startIso, endIso, today) -> { [iso]: item[] }`
  - `App.agenda.monthGrid(year, month1to12) -> iso[]`, semanas completas começando no domingo.
  - `App.agenda.weekDays(iso) -> iso[7]`
  - View `agenda`.

- [ ] **Step 1: Escrever os testes que falham**

`eventsBetween`: inclui compromissos, pontuais com data e rotinas nas datas em que ocorrem, sem rotinas antes de `startDate`; exclui itens com `deletedAt`. Rotina mensal dia 31 aparece em `2026-02-28`. `monthGrid(2026, 11)` começa em `2026-11-01` e termina em `2026-12-05`, com 35 dias.

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `node --test tests/agenda.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementar `js/logic/agenda.js`**

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `node --test tests/`
Expected: PASS.

- [ ] **Step 5: Implementar `js/ui/agenda.js`**

Conforme a seção 3.3. Grade de horas das 6h às 23h nas visões de semana e dia, com item sem hora em uma faixa no topo. Clicar no horário abre um formulário curto (título e setor) e depois cria o compromisso.

- [ ] **Step 6: Verificar no Chrome**

Script `<scratchpad>/ui/agenda-check.js`: alterna mês, semana e dia; clicar em um dia do mês abre a visão do dia; clicar em 14h cria um compromisso às 14h, que aparece em Hoje e no Quadro; clicar nele abre o painel.
Expected: todas passam.

- [ ] **Step 7: Commit**

```bash
git add css js index.html tests
git commit -m "feat: agenda de mês, semana e dia"
```

### Task 9: Checkpoint

**Files:**
- Create: `js/ui/checkpoint.js`
- Modify: `css/app.css`, `index.html`

**Interfaces:**
- Consumes: `App.habits`, `App.store` (ações de hábitos).
- Produces: view `checkpoint`.

- [ ] **Step 1: Implementar a tela**

Conforme a seção 3.4: grupos, os três tipos de hábito, 7 dias e sequência por hábito, navegação para dias anteriores com correção do registro, criar, editar e excluir hábitos e grupos.

- [ ] **Step 2: Verificar no Chrome**

Script `<scratchpad>/ui/checkpoint-check.js`: `+1` em Água até 8 marca o dia como cumprido; `-1` não fica abaixo de 0; Treino alterna com um clique; Refeições só cumpre com os três itens; voltar um dia e corrigir muda a sequência; criar um grupo e um hábito novo; recarregar e conferir que tudo continua.
Expected: todas passam.

- [ ] **Step 3: Commit**

```bash
git add css js index.html
git commit -m "feat: checkpoint de hábitos"
```

### Task 10: Perfil e Ajustes

**Files:**
- Create: `js/ui/profile.js`, `js/ui/settings.js`, `js/ui/emoji.js`
- Modify: `css/app.css`, `index.html`, `js/ui/shell.js`, `js/ui/board.js`

**Interfaces:**
- Consumes: `App.images.resize`, `App.images.SIZES`, `App.persist`, `App.store`, `App.shell.applySettings`.
- Produces: views `perfil` e `ajustes`; `App.ui.emojiPicker({ onPick }) -> Element`, usado para o símbolo pessoal e os ícones de sessão e setor.

- [ ] **Step 1: Implementar `emoji.js` e `profile.js`**

Conforme a seção 3.5. Coleção de cerca de 120 emojis, sem busca. Exatamente 3 campos de link. O avatar do menu mostra a foto, ou o símbolo, ou a inicial do nome.

- [ ] **Step 2: Implementar `settings.js`**

Conforme a seção 3.7, mais uma lista de clientes com nome e cor editáveis (`updateClient`, recusando nome repetido). A capa do setor aparece como fundo do cabeçalho do card, com `--scrim` para manter o texto legível. "Limpar histórico" e "Importar" pedem confirmação.

- [ ] **Step 3: Verificar no Chrome**

Script `<scratchpad>/ui/settings-check.js`:
- Foto de 4000 px vira avatar com no máximo 256 px; papel de parede aplica e sobrevive a recarregar.
- Tema, destaque, letra e tamanho mudam a tela na hora.
- Exportar, alterar um dado, importar o arquivo e conferir que o dado voltou.
- Importar um `.json` inválido mostra a mensagem e não altera nada.
- Criar uma sessão nova com ícone; excluir um setor com demandas pede confirmação, e Hoje e Agenda continuam abrindo.

Expected: todas passam.

- [ ] **Step 4: Commit**

```bash
git add css js index.html
git commit -m "feat: perfil e ajustes de personalização"
```

### Task 11: Acabamento e verificação final

**Files:**
- Create: `README.md`
- Modify: conforme o que a verificação apontar

- [ ] **Step 1: Escrever `README.md`**

Em português: o que é, como abrir (`index.html` no Chrome ou Edge), onde os dados ficam, como fazer backup e levar para outro PC, como rodar os testes (`node --test tests/`).

- [ ] **Step 2: Rodar tudo**

Run: `node --test tests/` e todos os scripts de `<scratchpad>/ui/`.
Expected: tudo passa, sem erros no console.

- [ ] **Step 3: Rodar no Edge**

Trocar `executablePath` para `msedge.exe` e rodar `shell-check.js`.
Expected: passa.

- [ ] **Step 4: Conferir que o repo não leva dados pessoais**

Run: `git grep -n -i -E "DELTA|GAMA|EPSILON|ZETA|ETA|TETA" -- . ":(exclude)docs"`
Expected: nenhum resultado.

- [ ] **Step 5: Tirar capturas para o usuário conferir**

Capturas de Quadro, Hoje, Agenda, Checkpoint e Perfil, no tema escuro e no claro, em `<scratchpad>/ui/shots`.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: instruções de uso"
```

O envio ao GitHub só acontece quando o usuário pedir.
