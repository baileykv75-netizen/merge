import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, startEncounter, advanceEncounter, closeEncounter, encounterView, restoreGame, battle } from '../assets/scripts/core/game-core.ts';
const now = Date.UTC(2026, 10, 27);
test('播放中重载恢复到同一事件，播放和关闭结果不会重复扣体力或发奖', () => {
  let state = newGame(123, now);
  startEncounter(state, 1, now);
  const economic = s => JSON.stringify({gold:s.gold,ore:s.ore,energy:s.energy,bag:s.bag,unlocked:s.stageUnlocked,daily:s.daily});
  const settled = economic(state);
  advanceEncounter(state); advanceEncounter(state);
  const view = encounterView(state);
  state = restoreGame(JSON.parse(JSON.stringify(state)), now);
  assert.ok(state); assert.deepEqual(encounterView(state), view);
  assert.throws(() => startEncounter(state, 1, now), /当前战斗/);
  assert.throws(() => battle(state, 1, now), /当前战斗/);
  assert.throws(() => closeEncounter(state), /尚未结束/);
  while(advanceEncounter(state)) {}
  const end = encounterView(state);
  assert.equal(end.done, true); assert.equal(end.heroHp, end.result.heroHp);
  assert.equal(economic(state), settled);
  for(let i=0;i<5;i++) advanceEncounter(state);
  closeEncounter(state); closeEncounter(state);
  assert.equal(economic(state), settled);
  startEncounter(state, 1, now);
  assert.equal(state.energy, 28);
});
test('失败也能恢复结算页，不开放下一关', () => {
  const state = newGame(5, now);
  state.stageUnlocked = 10;
  for(const slot of Object.keys(state.equipped)) state.equipped[slot] = null;
  startEncounter(state,10,now);
  assert.equal(state.encounter.result.won,false);
  while(advanceEncounter(state)) {}
  const restored = restoreGame(JSON.parse(JSON.stringify(state)),now);
  assert.ok(restored); assert.equal(encounterView(restored).done,true);
  assert.equal(restored.bestStage,0);
  assert.equal(encounterView(restored).heroHp,0);
});
test('无效播放游标或事件拒绝加载，旧版没有播放记录的存档仍可用', () => {
  const s = newGame(9,now); assert.ok(restoreGame(s,now));
  startEncounter(s,1,now);
  const a = structuredClone(s); a.encounter.cursor=99999;
  assert.equal(restoreGame(a,now),null);
  const b = structuredClone(s); b.encounter.result.events[0].type='unknown';
  assert.equal(restoreGame(b,now),null);
  const c = structuredClone(s); c.encounter.result.events[0].maxHp=-1;
  assert.equal(restoreGame(c,now),null);
});
