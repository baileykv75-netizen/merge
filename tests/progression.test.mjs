import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, syncTime, ENERGY_INTERVAL, ENERGY_CAP, idleReward, claimIdle,
  claimDaily, upgradeTalent, heroStats, makeItem, salvage, battle, restoreGame } from '../assets/scripts/core/game-core.ts';

const T = Date.UTC(2026, 10, 27, 3);
test('体力按剩余时间恢复，满体力时不储存额外恢复次数', () => {
  const s = newGame(1, T); s.energy = 0;
  syncTime(s, T + ENERGY_INTERVAL - 1); assert.equal(s.energy, 0);
  syncTime(s, T + ENERGY_INTERVAL); assert.equal(s.energy, 1);
  syncTime(s, T + 100 * ENERGY_INTERVAL); assert.equal(s.energy, ENERGY_CAP);
  s.energy -= 1;
  syncTime(s, T + 100 * ENERGY_INTERVAL + 1); assert.equal(s.energy, ENERGY_CAP - 1);
  syncTime(s, T); assert.equal(s.energy, ENERGY_CAP - 1);
});

test('离线收益封顶八小时，重复领取和回拨不会重复发奖', () => {
  const s = newGame(2, T);
  const later = T + 24 * 3600000;
  assert.equal(idleReward(s, later).minutes, 480);
  assert.deepEqual(claimIdle(s, later), { minutes: 480, gold: 960, ore: 96 });
  const gold = s.gold;
  assert.throws(() => claimIdle(s, later), /每分钟/);
  assert.throws(() => claimIdle(s, T), /每分钟/);
  assert.equal(s.gold, gold);
});

test('频繁领取与一次领取获得相同金币铁矿，跨存档保留零头', () => {
  let a = newGame(3, T); const b = newGame(3, T);
  for (let i = 1; i <= 7; i++) {
    claimIdle(a, T + i * 60000);
    a = restoreGame(JSON.parse(JSON.stringify(a)), T + i * 60000);
    assert.ok(a);
  }
  claimIdle(b, T + 7 * 60000);
  assert.equal(a.gold, b.gold); assert.equal(a.ore, b.ore);
});

test('每日奖励要求进度且不可重复领取，UTC+8跨日只刷新一次', () => {
  const s = newGame(4, T);
  assert.throws(() => claimDaily(s, 'wins', T), /未完成/);
  s.daily.wins = 3;
  claimDaily(s, 'wins', T);
  assert.throws(() => claimDaily(s, 'wins', T), /已领取/);
  syncTime(s, Date.UTC(2026, 10, 27, 16));
  assert.equal(s.daily.wins, 0); assert.deepEqual(s.daily.claimed, []);
  s.daily.wins = 1; syncTime(s, T); assert.equal(s.daily.wins, 1);
});

test('训练真实提升属性，缺少货币时不扣款不升级', () => {
  const s = newGame(5, T); const before = heroStats(s);
  upgradeTalent(s, 'attack');
  assert.equal(heroStats(s).attack, before.attack + 2);
  const snapshot = JSON.stringify(s);
  assert.throws(() => upgradeTalent(s, 'attack'), /金币不足/);
  assert.equal(JSON.stringify(s), snapshot);
});

test('分解保护锁定装备，满背包战斗奖励转为铁矿', () => {
  const s = newGame(6, T);
  s.bag = Array.from({ length: 100 }, () => makeItem(s));
  s.bag[0].locked = true;
  const before = JSON.stringify(s);
  assert.throws(() => salvage(s, [s.bag[0].id, s.bag[1].id]), /锁定/);
  assert.equal(JSON.stringify(s), before);
  const result = battle(s, 1, T);
  assert.equal(result.won, true); assert.equal(s.bag.length, 100);
  assert.equal(result.rewards.items.length, 0); assert.equal(result.rewards.recycled, 2);
  assert.equal(result.rewards.ore, 14);
});

test('旧存档迁移保持装备货币，不凭空赠送离线收益；损坏物品被拒绝', () => {
  const s = newGame(7, T); s.version = 1;
  for (const k of ['clock','energyAt','idleAt','idleOreRemainder','talents','daily']) delete s[k];
  const restored = restoreGame(s, T);
  assert.ok(restored); assert.equal(restored.version, 4);
  assert.equal(restored.gold, s.gold); assert.deepEqual(restored.equipped, s.equipped);
  assert.equal(idleReward(restored, T).gold, 0);
  const corrupt = structuredClone(restored); corrupt.equipped.weapon.attack = null;
  assert.equal(restoreGame(corrupt, T), null);
  const duplicate = structuredClone(restored); duplicate.bag.push(duplicate.equipped.weapon);
  assert.equal(restoreGame(duplicate, T), null);
});

test('装备词条提供对应战斗属性', () => {
  const s = newGame(8, T); const base = heroStats(s);
  s.equipped.weapon.affix = '暴击'; assert.ok(heroStats(s).crit > base.crit);
  s.equipped.weapon.affix = '生命恢复'; assert.equal(heroStats(s).regen, 2);
  s.equipped.weapon.affix = '元素抗性'; assert.equal(heroStats(s).resist, 0.05);
});
