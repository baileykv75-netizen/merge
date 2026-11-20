import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, makeItem, synthesize, equip, enhance, battle,
  heroStats, toggleLock, restoreGame,
} from '../assets/scripts/core/game-core.ts';

test('五件同品质装备合成一件高品质，扣费且保留同部位', () => {
  const state = newGame(123);
  state.bag = Array.from({ length: 5 }, () => makeItem(state, 'common', 'weapon'));
  const ids = state.bag.map((item) => item.id);
  const goldBefore = state.gold;
  const result = synthesize(state, ids);
  assert.equal(result.rarity, 'fine');
  assert.equal(result.slot, 'weapon');
  assert.deepEqual(state.bag.map((item) => item.id), [result.id]);
  assert.equal(state.gold, goldBefore - 40);
});

test('合成出错时材料和货币保持原样', () => {
  const state = newGame(234);
  state.bag = Array.from({ length: 5 }, () => makeItem(state));
  const ids = state.bag.map((item) => item.id);
  toggleLock(state, ids[0]);
  const snapshot = JSON.stringify(state);
  assert.throws(() => synthesize(state, ids), /锁定/);
  assert.equal(JSON.stringify(state), snapshot);
  toggleLock(state, ids[0]);
  state.bag[4].rarity = 'rare';
  const mixedSnapshot = JSON.stringify(state);
  assert.throws(() => synthesize(state, ids), /同品质/);
  assert.equal(JSON.stringify(state), mixedSnapshot);
});

test('穿戴和强化真正改变战斗属性', () => {
  const state = newGame(345);
  const better = makeItem(state, 'rare', 'weapon');
  state.bag.push(better);
  const before = heroStats(state).attack;
  equip(state, better.id);
  assert.ok(heroStats(state).attack > before);
  const afterEquip = heroStats(state).attack;
  enhance(state, 'weapon');
  assert.ok(heroStats(state).attack > afterEquip);
  assert.ok(state.bag.some((item) => item.slot === 'weapon'));
});

test('战斗消耗体力，胜利才开放下一关且发放装备', () => {
  const state = newGame(456);
  const energyBefore = state.energy;
  const result = battle(state, 1);
  assert.equal(state.energy, energyBefore - 1);
  if (result.won) {
    assert.equal(state.stageUnlocked, 2);
    assert.equal(result.rewards.items.length, 2);
    assert.equal(state.bag.length, 2);
  } else {
    assert.equal(state.stageUnlocked, 1);
    assert.equal(result.rewards.items.length, 0);
  }
  assert.ok(result.events.length > 0);
});

test('存档版本校验拒绝损坏数据', () => {
  const state = newGame(567);
  assert.deepEqual(restoreGame(JSON.parse(JSON.stringify(state))), state);
  assert.equal(restoreGame({ ...state, version: 999 }), null);
  assert.equal(restoreGame({ ...state, bag: 'oops' }), null);
});
