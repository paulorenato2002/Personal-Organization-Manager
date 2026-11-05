const test = require('node:test');
const assert = require('node:assert/strict');
const seed = require('../js/data/seed.js');
const { createStore } = require('../js/data/store.js');
const { historyByDay, pendingByDay, activityLog } = require('../js/logic/pending.js');

const NOW = () => new Date(2026, 10, 5, 10, 0);

function setup(start = 'vazio') {
  const store = createStore(seed.initialState({ start }), { now: NOW });
  const sectorId = store.getState().sectors[0].id;
  return { store, sectorId };
}
const item = (store, id) => store.getState().items.find((i) => i.id === id);

test('modelo padrão traz setores, clientes e tarefas fictícios', () => {
  const s = seed.initialState({ start: 'exemplo', name: 'Ana', today: '2026-11-05' });
  assert.equal(s.version, 2);
  assert.equal(s.profile.name, 'Ana');
  assert.deepEqual(s.sessions.map((x) => x.name), ['Trabalho', 'Pessoal', 'Projetos']);
  const trabalho = s.sessions[0].id;
  assert.deepEqual(s.sectors.filter((x) => x.sessionId === trabalho).map((x) => x.name), ['Financeiro', 'Comercial', 'Operações']);
  assert.ok(s.clients.length >= 2);
  assert.ok(s.items.some((i) => i.kind === 'rotina'));
  assert.ok(s.items.some((i) => i.kind === 'compromisso'));
  assert.ok(s.items.filter((i) => i.kind === 'pontual').every((i) => i.dueDate === '2026-11-05'));
  assert.ok(s.items.every((i) => s.sectors.some((x) => x.id === i.sectorId)));
  assert.equal(s.settings.accent, '#f2b872');
  assert.equal(s.settings.theme, 'dark');
  const agua = s.habits.find((h) => h.name === 'Água');
  assert.deepEqual([agua.type, agua.goal, agua.step, agua.unit, agua.startDate], ['counter', 3000, 500, 'ml', '2026-11-05']);
  assert.ok(s.habits.some((h) => h.type === 'check'));
  assert.ok(s.habits.some((h) => h.type === 'list'));
});

test('migração adapta dados da versão anterior', () => {
  const old = {
    ...seed.initialState({ start: 'vazio', today: '2026-11-05' }),
    version: 1,
    habits: [{ id: 'w', groupId: 'g', name: 'Água', type: 'counter', goal: 8, order: 0 }, { id: 'c', groupId: 'g', name: 'Treino', type: 'check', order: 1 }],
    habitLog: { '2026-11-02': { w: 3 }, '2026-11-04': { w: 8 } },
  };
  const next = seed.migrate(old, '2026-11-05');
  assert.equal(next.version, 2);
  assert.deepEqual([next.habits[0].step, next.habits[0].unit, next.habits[0].startDate], [1, '', '2026-11-02']);
  assert.equal(next.habits[1].startDate, '2026-11-05');
  assert.equal(seed.migrate(next, '2026-12-01').habits[0].startDate, '2026-11-02');
});

test('estado inicial vazio tem um setor Geral por sessão', () => {
  const s = seed.initialState({ start: 'vazio' });
  assert.deepEqual(s.sectors.map((x) => x.name), ['Geral', 'Geral', 'Geral']);
});

test('adição rápida cria e reaproveita o cliente, ignorando maiúsculas', () => {
  const { store, sectorId } = setup();
  const a = store.quickAdd({ kind: 'pontual', sectorId, text: 'acme - enviar boletos' });
  const b = store.quickAdd({ kind: 'pontual', sectorId, text: 'ACME - outra' });
  const { clients } = store.getState();
  assert.equal(clients.length, 1);
  assert.equal(clients[0].name, 'ACME');
  assert.ok(clients[0].color);
  assert.equal(a.clientId, clients[0].id);
  assert.equal(b.clientId, clients[0].id);
  assert.equal(a.dueDate, '2026-11-05');
  assert.equal(a.log[0].action, 'created');
});

test('adição rápida de texto vazio não cria nada', () => {
  const { store, sectorId } = setup();
  assert.equal(store.quickAdd({ kind: 'pontual', sectorId, text: '  ' }), null);
  assert.equal(store.getState().items.length, 0);
});

test('adição dentro do cliente usa o texto inteiro como título', () => {
  const { store, sectorId } = setup();
  const client = store.addClient('ACME');
  const a = store.quickAdd({ kind: 'pontual', sectorId, clientId: client.id, text: ' revisar - urgente ' });
  assert.equal(a.title, 'revisar - urgente');
  assert.equal(a.clientId, client.id);
  assert.equal(store.getState().clients.length, 1);
  const r = store.quickAdd({ kind: 'rotina', sectorId, clientId: client.id, text: 'conferir' });
  assert.equal(r.clientId, client.id);
  assert.deepEqual(r.freq, { type: 'daily' });
  assert.equal(store.quickAdd({ kind: 'pontual', sectorId, clientId: client.id, text: '  ' }), null);
});

test('adição aceita data de entrega e, sem ela, usa hoje', () => {
  const { store, sectorId } = setup();
  const a = store.quickAdd({ kind: 'pontual', sectorId, text: 'x', dueDate: '2026-11-20' });
  assert.equal(a.dueDate, '2026-11-20');
  const b = store.quickAdd({ kind: 'pontual', sectorId, text: 'y' });
  assert.equal(b.dueDate, '2026-11-05');
  const r = store.quickAdd({ kind: 'rotina', sectorId, text: 'z', dueDate: '2026-11-20' });
  assert.equal(r.dueDate, undefined);
});

test('rotina nasce diária a partir de hoje', () => {
  const { store, sectorId } = setup();
  const r = store.quickAdd({ kind: 'rotina', sectorId, text: 'conciliar' });
  assert.deepEqual(r.freq, { type: 'daily' });
  assert.equal(r.startDate, '2026-11-05');
  assert.equal(r.doneThrough, null);
});

test('mover uma pontual registra o adiamento', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'pontual', sectorId, text: 'x' });
  store.movePontual(id, '2026-11-10');
  assert.equal(item(store, id).dueDate, '2026-11-10');
  const moved = item(store, id).log.find((e) => e.action === 'moved');
  assert.deepEqual([moved.from, moved.to, moved.day], ['2026-11-05', '2026-11-10', '2026-11-05']);
  store.movePontual(id, null);
  assert.equal(item(store, id).dueDate, null);
});

test('excluir e desfazer restaura a demanda e o registro', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'pontual', sectorId, text: 'x' });
  store.deleteItem(id);
  assert.ok(item(store, id).deletedAt);
  assert.equal(store.canUndo(), true);
  assert.equal(store.undo(), true);
  assert.equal(item(store, id).deletedAt, undefined);
  assert.equal(item(store, id).log.some((e) => e.action === 'deleted'), false);
});

test('desfazer depois de uma nova mudança não apaga o que veio depois', () => {
  const { store, sectorId } = setup();
  const a = store.quickAdd({ kind: 'pontual', sectorId, text: 'a' });
  store.deleteItem(a.id);
  const b = store.quickAdd({ kind: 'pontual', sectorId, text: 'b' });
  assert.equal(store.canUndo(), false);
  assert.equal(store.undo(), false);
  assert.ok(item(store, b.id));
  assert.ok(item(store, a.id).deletedAt);
});

test('concluir e desmarcar uma pontual ajusta o registro', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'pontual', sectorId, text: 'x' });
  store.toggleItem(id);
  assert.ok(item(store, id).doneAt);
  assert.equal(item(store, id).log.some((e) => e.action === 'done'), true);
  store.toggleItem(id);
  assert.equal(item(store, id).doneAt, undefined);
  assert.equal(item(store, id).log.some((e) => e.action === 'done'), false);
});

test('alternar uma rotina conclui e desfaz o ciclo', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'rotina', sectorId, text: 'x' });
  store.toggleItem(id);
  assert.equal(item(store, id).doneThrough, '2026-11-05');
  store.toggleItem(id);
  assert.equal(item(store, id).doneThrough, null);
});

test('mover e excluir um dia inteiro aceitam desfazer', () => {
  let current = new Date(2026, 10, 3, 10, 0);
  const store = createStore(seed.initialState({ start: 'vazio' }), { now: () => current });
  const sectorId = store.getState().sectors[0].id;
  store.quickAdd({ kind: 'pontual', sectorId, text: 'a' });
  store.quickAdd({ kind: 'pontual', sectorId, text: 'b' });
  current = new Date(2026, 10, 5, 10, 0);
  store.moveDay('2026-11-03', '2026-11-05');
  assert.equal(pendingByDay(store.getState().items, '2026-11-05').length, 0);
  store.undo();
  assert.equal(pendingByDay(store.getState().items, '2026-11-05')[0].items.length, 2);
  store.deleteDay('2026-11-03');
  assert.equal(pendingByDay(store.getState().items, '2026-11-05').length, 0);
  assert.equal(historyByDay(store.getState().items)[0].deleted.length, 2);
  store.undo();
  assert.equal(pendingByDay(store.getState().items, '2026-11-05')[0].items.length, 2);
});

test('excluir setor remove rotinas e compromissos e preserva pontuais no histórico', () => {
  const { store, sectorId } = setup();
  const pontual = store.quickAdd({ kind: 'pontual', sectorId, text: 'p' });
  store.quickAdd({ kind: 'rotina', sectorId, text: 'r' });
  store.addCompromisso({ sectorId, title: 'c', start: '2026-11-05T14:00' });
  store.deleteSector(sectorId);
  const { items, sectors } = store.getState();
  assert.equal(sectors.some((s) => s.id === sectorId), false);
  assert.deepEqual(items.map((i) => i.id), [pontual.id]);
  assert.ok(items[0].deletedAt);
  assert.equal(items[0].sectorId, null);
  assert.equal(historyByDay(items)[0].deleted[0].id, pontual.id);
  store.undo();
  assert.equal(store.getState().sectors.some((s) => s.id === sectorId), true);
  assert.equal(store.getState().items.length, 3);
});

test('excluir sessão remove os setores dela', () => {
  const { store, sectorId } = setup();
  const sessionId = store.getState().sessions[0].id;
  store.quickAdd({ kind: 'rotina', sectorId, text: 'r' });
  store.deleteSession(sessionId);
  const { sessions, sectors, items } = store.getState();
  assert.equal(sessions.some((s) => s.id === sessionId), false);
  assert.equal(sectors.some((s) => s.sessionId === sessionId), false);
  assert.equal(items.length, 0);
});

test('limpar histórico apaga excluídas e registros', () => {
  const { store, sectorId } = setup();
  const a = store.quickAdd({ kind: 'pontual', sectorId, text: 'a' });
  const b = store.quickAdd({ kind: 'pontual', sectorId, text: 'b' });
  store.deleteItem(a.id);
  store.toggleItem(b.id);
  store.clearHistory();
  assert.equal(item(store, a.id), undefined);
  assert.deepEqual(historyByDay(store.getState().items), []);
});

test('nome de cliente repetido é recusado', () => {
  const { store, sectorId } = setup();
  const a = store.quickAdd({ kind: 'pontual', sectorId, text: 'ACME - x' });
  const b = store.quickAdd({ kind: 'pontual', sectorId, text: 'BETA - y' });
  assert.equal(store.updateClient(b.clientId, { name: 'acme' }), false);
  assert.equal(store.updateClient(b.clientId, { name: 'betax' }), true);
  assert.equal(store.getState().clients.find((c) => c.id === b.clientId).name, 'BETAX');
  assert.ok(a.clientId);
});

test('trocar o cliente de uma demanda cria, reaproveita e limpa', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'pontual', sectorId, text: 'x' });
  store.setItemClient(id, 'beta');
  const beta = store.getState().clients.find((c) => c.name === 'BETA');
  assert.equal(item(store, id).clientId, beta.id);
  store.setItemClient(id, '  ');
  assert.equal(item(store, id).clientId, undefined);
  assert.equal(store.getState().clients.length, 1);
});

test('trocar o tipo preenche os campos do novo tipo', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'pontual', sectorId, text: 'x' });
  store.changeKind(id, 'rotina');
  assert.deepEqual(item(store, id).freq, { type: 'daily' });
  assert.equal(item(store, id).dueDate, undefined);
  store.changeKind(id, 'compromisso');
  assert.equal(item(store, id).start, '2026-11-05T09:00');
  assert.equal(item(store, id).freq, undefined);
});

test('hábitos guardam valor por dia', () => {
  const { store } = setup('exemplo');
  const agua = store.getState().habits[0];
  store.setHabitValue(agua.id, '2026-11-05', 3);
  assert.equal(store.getState().habitLog['2026-11-05'][agua.id], 3);
});

test('adicionar cliente recusa vazio e repetido', () => {
  const { store } = setup();
  const c = store.addClient('acme');
  assert.equal(c.name, 'ACME');
  assert.equal(store.addClient('Acme'), null);
  assert.equal(store.addClient('   '), null);
  assert.equal(store.getState().clients.length, 1);
});

test('excluir cliente tira a etiqueta das demandas', () => {
  const { store, sectorId } = setup();
  const a = store.quickAdd({ kind: 'pontual', sectorId, text: 'ACME - x' });
  store.deleteClient(a.clientId);
  assert.equal(store.getState().clients.length, 0);
  assert.equal(item(store, a.id).clientId, undefined);
});

test('rotina concluída entra no registro e desfazer tira', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'rotina', sectorId, text: 'x' });
  store.toggleItem(id);
  assert.equal(item(store, id).log.some((e) => e.action === 'done'), true);
  store.toggleItem(id);
  assert.equal(item(store, id).log.some((e) => e.action === 'done'), false);
});

test('limpar histórico também zera a atividade', () => {
  const { store, sectorId } = setup();
  const { id } = store.quickAdd({ kind: 'rotina', sectorId, text: 'x' });
  store.toggleItem(id);
  store.clearHistory();
  assert.deepEqual(activityLog(store.getState().items), []);
  assert.equal(item(store, id).doneThrough, '2026-11-05');
});

test('nova meta começa hoje', () => {
  const { store } = setup();
  const group = store.addHabitGroup('Saúde');
  const h = store.addHabit(group.id, { name: 'Ler', type: 'check' });
  assert.equal(h.startDate, '2026-11-05');
});

test('reordenar muda a posição e subscribe avisa', () => {
  const { store, sectorId } = setup('exemplo');
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  store.reorder('sectors', sectorId, 2);
  const session = store.getState().sectors.find((s) => s.id === sectorId).sessionId;
  const ordered = store.getState().sectors.filter((s) => s.sessionId === session).sort((a, b) => a.order - b.order);
  assert.equal(ordered[2].id, sectorId);
  assert.equal(calls, 1);
  off();
  store.setSettings({ theme: 'light' });
  assert.equal(calls, 1);
});
