// @ts-nocheck
/** 装备合成原型的跨平台规则。只使用标准 JavaScript，网页和 Cocos 共用。 */

export const SAVE_VERSION = 2;
export const ENERGY_CAP = 30;
export const ENERGY_INTERVAL = 5 * 60 * 1000;
export const OFFLINE_CAP = 8 * 60 * 60 * 1000;
export const TALENTS = [
  { id: 'attack', name: '武器训练', description: '每级攻击 +2', max: 20 },
  { id: 'health', name: '体魄训练', description: '每级生命 +15', max: 20 },
  { id: 'defense', name: '防御训练', description: '每级防御 +1', max: 20 },
];
export const DAILY_TASKS = [
  { id: 'wins', name: '赢得三场战斗', target: 3, gold: 150, ore: 12 },
  { id: 'merges', name: '完成一次装备合成', target: 1, gold: 100, ore: 10 },
  { id: 'upgrades', name: '强化一次装备', target: 1, gold: 90, ore: 15 },
];
export const SLOTS = ["weapon", "helmet", "armor", "boots", "ring", "amulet"];
export const SLOT_NAMES = {
  weapon: "武器", helmet: "头盔", armor: "护甲",
  boots: "战靴", ring: "戒指", amulet: "护符",
};
export const RARITIES = [
  { id: "common", name: "普通", color: "#a9b6c5", scale: 1 },
  { id: "fine", name: "精良", color: "#49d9a4", scale: 1.45 },
  { id: "rare", name: "稀有", color: "#55a9ff", scale: 2.05 },
  { id: "epic", name: "史诗", color: "#b778f0", scale: 2.9 },
  { id: "legendary", name: "传说", color: "#ffbb58", scale: 4.1 },
];

const ITEM_NOUNS = {
  weapon: ["精铁短剑", "猎手长枪", "裂岩战斧"],
  helmet: ["守望头盔", "游侠兜帽", "灰烬面甲"],
  armor: ["卫士战甲", "旅人外衣", "暮色胸甲"],
  boots: ["疾风战靴", "远行之靴", "夜行护足"],
  ring: ["微光指环", "银月戒指", "回响之环"],
  amulet: ["猎鹰护符", "潮汐吊坠", "辉石项链"],
};

/** @param {number} value */
const whole = (value) => Math.max(0, Math.floor(value));

/** @param {any} state */
function random(state) {
  state.seed = (Math.imul(state.seed >>> 0, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

/** @param {any} state @param {number} max */
function pick(state, max) { return Math.floor(random(state) * max); }

/** @param {any} state @param {string} rarity @param {string=} forcedSlot */
export function makeItem(state, rarity = "common", forcedSlot) {
  const rank = Math.max(0, RARITIES.findIndex((r) => r.id === rarity));
  const slot = forcedSlot || SLOTS[pick(state, SLOTS.length)];
  if (!SLOTS.includes(slot)) throw new Error("装备部位无效");
  const names = ITEM_NOUNS[slot];
  const scale = RARITIES[rank].scale;
  const roll = 0.85 + random(state) * 0.3;
  const primary = Math.round((5 + rank * 3) * scale * roll);
  const item = {
    id: `eq-${state.nextItemId++}`,
    name: names[pick(state, names.length)],
    slot,
    rarity: RARITIES[rank].id,
    level: 0,
    locked: false,
    attack: slot === "weapon" || slot === "ring" || slot === "amulet" ? primary : 0,
    health: slot === "armor" || slot === "helmet" || slot === "amulet" ? primary * 5 : 0,
    defense: slot === "boots" || slot === "helmet" || slot === "armor" ? Math.round(primary * 0.55) : 0,
    affix: rank >= 1 ? ["暴击", "生命恢复", "元素抗性"][pick(state, 3)] : null,
  };
  return item;
}

/** @param {number=} seed */
export function newGame(seed = Date.now(), now = Date.now()) {
  const state = {
    version: SAVE_VERSION,
    seed: seed >>> 0,
    nextItemId: 1,
    stageUnlocked: 1,
    bestStage: 0,
    gold: 120,
    ore: 25,
    energy: 30,
    bag: [],
    equipped: Object.fromEntries(SLOTS.map((slot) => [slot, null])),
    history: [],
    clock: now,
    energyAt: now,
    idleAt: now,
    idleOreRemainder: 0,
    talents: { attack: 0, health: 0, defense: 0 },
    daily: { day: dayKey(now), wins: 0, merges: 0, upgrades: 0, claimed: [] },
  };
  state.equipped.weapon = makeItem(state, "common", "weapon");
  state.equipped.armor = makeItem(state, "common", "armor");
  return state;
}

/** @param {any} item */
export function itemStats(item) {
  if (!item) return { attack: 0, health: 0, defense: 0 };
  const boost = 1 + (item.level || 0) * 0.12;
  return {
    attack: whole(item.attack * boost),
    health: whole(item.health * boost),
    defense: whole(item.defense * boost),
  };
}

/** @param {any} state */
export function heroStats(state) {
  const stats = { attack: 20, health: 150, defense: 3 };
  for (const item of Object.values(state.equipped)) {
    const part = itemStats(item);
    stats.attack += part.attack;
    stats.health += part.health;
    stats.defense += part.defense;
  }
  stats.attack += (state.talents?.attack || 0) * 2;
  stats.health += (state.talents?.health || 0) * 15;
  stats.defense += state.talents?.defense || 0;
  const affixes = Object.values(state.equipped).filter(Boolean).map(item => item.affix);
  stats.crit = Math.min(0.5, 0.05 + affixes.filter(x => x === '暴击').length * 0.04);
  stats.regen = affixes.filter(x => x === '生命恢复').length * 2;
  stats.resist = Math.min(0.4, affixes.filter(x => x === '元素抗性').length * 0.05);
  stats.power = stats.attack * 4 + stats.health + stats.defense * 6;
  return stats;
}

/** @param {any} state @param {string} id */
export function equip(state, id) {
  const index = state.bag.findIndex((item) => item.id === id);
  if (index < 0) throw new Error("背包中没有这件装备");
  const [selected] = state.bag.splice(index, 1);
  const old = state.equipped[selected.slot];
  state.equipped[selected.slot] = selected;
  if (old) state.bag.push(old);
  return selected;
}

/** @param {any} state @param {string} id */
export function toggleLock(state, id) {
  const item = state.bag.find((candidate) => candidate.id === id);
  if (!item) throw new Error("只能锁定背包中的装备");
  item.locked = !item.locked;
  return item.locked;
}

/** @param {any} state @param {string[]} ids */
export function synthesize(state, ids, now = Date.now()) {
  if (!Array.isArray(ids) || ids.length !== 5 || new Set(ids).size !== 5) {
    throw new Error("必须选择 5 件不同的装备");
  }
  const selected = ids.map((id) => state.bag.find((item) => item.id === id));
  if (selected.some((item) => !item)) throw new Error("材料必须都在背包中");
  if (selected.some((item) => item.locked)) throw new Error("锁定的装备不能用于合成");
  const rank = RARITIES.findIndex((rarity) => rarity.id === selected[0].rarity);
  if (rank < 0 || rank >= RARITIES.length - 1) throw new Error("该品质无法继续合成");
  if (selected.some((item) => item.rarity !== selected[0].rarity)) {
    throw new Error("必须选择同品质装备");
  }
  const cost = 40 * (rank + 1);
  if (state.gold < cost) throw new Error(`金币不足，需要 ${cost}`);
  const sharedSlot = selected.every((item) => item.slot === selected[0].slot)
    ? selected[0].slot : undefined;
  // 验证全部完成后再修改背包和货币，失败不会吞掉材料。
  syncTime(state, now);
  const result = makeItem(state, RARITIES[rank + 1].id, sharedSlot);
  state.bag = state.bag.filter((item) => !ids.includes(item.id));
  state.bag.push(result);
  state.gold -= cost;
  state.daily.merges += 1;
  state.history.unshift(`合成获得 ${RARITIES[rank + 1].name}·${result.name}`);
  state.history = state.history.slice(0, 20);
  return result;
}

/** @param {any} state @param {string} slot */
export function enhance(state, slot, now = Date.now()) {
  const item = state.equipped[slot];
  if (!item) throw new Error("请先穿戴装备");
  if (item.level >= 10) throw new Error("当前版本强化已达到上限");
  const ore = 10 * (item.level + 1);
  const gold = 30 * (item.level + 1);
  if (state.ore < ore || state.gold < gold) throw new Error(`强化需要铁矿 ${ore}、金币 ${gold}`);
  syncTime(state, now);
  state.ore -= ore;
  state.gold -= gold;
  item.level += 1;
  state.daily.upgrades += 1;
  state.history.unshift(`${item.name} 强化至 +${item.level}`);
  state.history = state.history.slice(0, 20);
  return item;
}

/** @param {any} state @param {number} stage */
export function battle(state, stage, now = Date.now()) {
  if (state.encounter) throw new Error('请先完成当前战斗');
  if (!Number.isInteger(stage) || stage < 1 || stage > 10 || stage > state.stageUnlocked) {
    throw new Error("关卡尚未开放");
  }
  syncTime(state, now);
  if (state.energy < 1) throw new Error("体力不足");
  state.energy -= 1;
  const hero = heroStats(state);
  let heroHp = hero.health;
  const events = [];
  const waveCount = stage < 4 ? 2 : stage < 8 ? 3 : 4;
  let won = true;
  for (let wave = 1; wave <= waveCount; wave++) {
    let enemyHp = 33 + stage * 13 + wave * 10;
    const enemyDamage = 3 + stage * 2 + wave;
    events.push({ type: "wave", wave, maxHp: enemyHp });
    let turn = 0;
    while (enemyHp > 0 && heroHp > 0 && turn < 100) {
      turn += 1;
      const skill = turn % 3 === 0;
      const critical = random(state) < hero.crit;
      const damage = Math.max(1, Math.round(hero.attack * (skill ? 1.7 : 1) * (critical ? 1.5 : 1) * (0.9 + random(state) * 0.2)));
      enemyHp = Math.max(0, enemyHp - damage);
      events.push({ type: "hero", wave, damage, skill, critical, enemyHp });
      if (enemyHp <= 0) break;
      const taken = Math.max(1, Math.round((enemyDamage * (0.9 + random(state) * 0.2) - hero.defense * 0.22) * (wave % 2 === 0 ? 1 - hero.resist : 1)));
      heroHp = Math.max(0, heroHp - taken);
      events.push({ type: "enemy", wave, damage: taken, heroHp });
      if (heroHp > 0 && hero.regen) {
        heroHp = Math.min(hero.health, heroHp + hero.regen);
        events.push({ type: 'heal', wave, heroHp, amount: hero.regen });
      }
    }
    if (heroHp <= 0 || turn >= 100) { won = false; break; }
  }
  const rewards = { gold: won ? 35 + stage * 18 : 10 + stage * 3, ore: won ? 3 + stage : 0, items: [] };
  state.gold += rewards.gold;
  state.ore += rewards.ore;
  if (won) {
    state.daily.wins += 1;
    for (let i = 0; i < 2; i++) {
      const rarity = stage >= 5 && random(state) < 0.18 ? "fine" : "common";
      const item = makeItem(state, rarity);
      if (state.bag.length < 100) {
        state.bag.push(item);
        rewards.items.push(item);
      } else {
        const refund = 5 * (RARITIES.findIndex(r => r.id === rarity) + 1);
        state.ore += refund;
        rewards.ore += refund;
        rewards.recycled = (rewards.recycled || 0) + 1;
      }
    }
    state.bestStage = Math.max(state.bestStage, stage);
    state.stageUnlocked = Math.min(10, Math.max(state.stageUnlocked, stage + 1));
  }
  state.history.unshift(`${won ? "通关" : "挑战失败"} 第 ${stage} 关，获得 ${rewards.gold} 金币`);
  state.history = state.history.slice(0, 20);
  return { won, stage, waveCount, heroHp, maxHeroHp: hero.health, events, rewards };
}

/** @param {unknown} value */
export function restoreGame(value, now = Date.now()) {
  if (!value || typeof value !== "object" || ![1, SAVE_VERSION].includes(value.version)) return null;
  if (!Array.isArray(value.bag) || !value.equipped || !Number.isInteger(value.seed)) return null;
  if (!Number.isInteger(value.stageUnlocked) || value.stageUnlocked < 1 || value.stageUnlocked > 10) return null;
  const validNumber = n => Number.isSafeInteger(n) && n >= 0;
  if (!['gold', 'ore', 'energy', 'bestStage', 'nextItemId'].every(k => validNumber(value[k]))) return null;
  if (value.energy > ENERGY_CAP || value.bestStage > 10 || value.nextItemId < 1 || value.bag.length > 100) return null;
  if (!Array.isArray(value.history) || value.history.some(x => typeof x !== 'string')) return null;
  const all = [...value.bag];
  for (const slot of SLOTS) {
    if (!(slot in value.equipped)) return null;
    const item = value.equipped[slot];
    if (item) { if (item.slot !== slot) return null; all.push(item); }
  }
  if (all.some(item => !item || typeof item.id !== 'string' || !/^eq-\d+$/.test(item.id)
    || Number(item.id.slice(3)) >= value.nextItemId || typeof item.name !== 'string'
    || !SLOTS.includes(item.slot) || !RARITIES.some(r => r.id === item.rarity)
    || !['level', 'attack', 'health', 'defense'].every(k => validNumber(item[k]))
    || item.level > 10 || typeof item.locked !== 'boolean'
    || ![null, '暴击', '生命恢复', '元素抗性'].includes(item.affix))) return null;
  if (new Set(all.map(x => x.id)).size !== all.length) return null;
  const state = JSON.parse(JSON.stringify(value));
  if (state.version === 1) {
    Object.assign(state, { version: SAVE_VERSION, clock: now, energyAt: now, idleAt: now, idleOreRemainder: 0,
      talents: { attack: 0, health: 0, defense: 0 },
      daily: { day: dayKey(now), wins: 0, merges: 0, upgrades: 0, claimed: [] } });
  }
  if (!['clock', 'energyAt', 'idleAt'].every(k => validNumber(state[k]))) return null;
  if (!validNumber(state.idleOreRemainder) || state.idleOreRemainder >= 5) return null;
  if (!state.talents || TALENTS.some(t => !validNumber(state.talents[t.id]) || state.talents[t.id] > t.max)) return null;
  const d = state.daily;
  if (!d || !validNumber(d.day) || !['wins', 'merges', 'upgrades'].every(k => validNumber(d[k]))
    || !Array.isArray(d.claimed) || new Set(d.claimed).size !== d.claimed.length
    || d.claimed.some(id => !DAILY_TASKS.some(t => t.id === id))) return null;
  if (state.encounter != null && !validEncounter(state.encounter)) return null;
  return state;
}

function validEncounter(encounter) {
  const r = encounter?.result;
  const nonnegative = x => Number.isSafeInteger(x) && x >= 0;
  if (!r || typeof r.won !== 'boolean' || !Number.isInteger(r.stage) || r.stage < 1 || r.stage > 10
    || !Number.isInteger(r.waveCount) || r.waveCount < 2 || r.waveCount > 4
    || !nonnegative(r.heroHp) || !nonnegative(r.maxHeroHp) || r.maxHeroHp < 1 || r.heroHp > r.maxHeroHp
    || !Array.isArray(r.events) || r.events.length > 1500 || !nonnegative(encounter.cursor)
    || encounter.cursor > r.events.length || !r.rewards || !nonnegative(r.rewards.gold)
    || !nonnegative(r.rewards.ore) || !Array.isArray(r.rewards.items)) return false;
  return r.events.every(e => e && Number.isInteger(e.wave) && e.wave >= 1 && e.wave <= r.waveCount && (
    e.type === 'wave' ? nonnegative(e.maxHp) && e.maxHp > 0 :
    e.type === 'hero' ? nonnegative(e.damage) && nonnegative(e.enemyHp) :
    e.type === 'enemy' ? nonnegative(e.damage) && nonnegative(e.heroHp) && e.heroHp <= r.maxHeroHp :
    e.type === 'heal' ? nonnegative(e.amount) && nonnegative(e.heroHp) && e.heroHp <= r.maxHeroHp : false));
}

// 开始时仅结算一次；后续播放、加速、恢复和确认结果均不再发奖。
export function startEncounter(state, stage, now = Date.now()) {
  if (state.encounter) throw new Error('请先完成当前战斗');
  const result = battle(state, stage, now);
  state.encounter = { result, cursor: 0 };
  return state.encounter;
}
export function advanceEncounter(state) {
  const current = state.encounter;
  if (!current || current.cursor >= current.result.events.length) return null;
  return current.result.events[current.cursor++];
}
export function closeEncounter(state) {
  if (!state.encounter) return;
  if (state.encounter.cursor < state.encounter.result.events.length) throw new Error('战斗尚未结束');
  state.encounter = null;
}
export function encounterView(state) {
  const c = state.encounter;
  if (!c) return null;
  const view = { heroHp: c.result.maxHeroHp, enemyHp: 0, enemyMaxHp: 1, wave: 1,
    attacks: 0, last: null, done: c.cursor === c.result.events.length, result: c.result };
  for (const e of c.result.events.slice(0, c.cursor)) {
    view.last = e; view.wave = e.wave;
    if (e.type === 'wave') { view.enemyHp = e.maxHp; view.enemyMaxHp = e.maxHp; view.attacks = 0; }
    if (e.type === 'hero') { view.enemyHp = e.enemyHp; view.attacks++; }
    if (e.type === 'enemy' || e.type === 'heal') view.heroHp = e.heroHp;
  }
  return view;
}

// 以 UTC+8 自然日刷新，时间回拨不会重新发奖励。
function dayKey(now) { return Math.floor((now + 8 * 3600000) / 86400000); }
export function syncTime(state, now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('时间无效');
  const current = Math.max(state.clock, now);
  state.clock = current;
  if (state.energy >= ENERGY_CAP) state.energyAt = current;
  else {
    const ticks = Math.max(0, Math.floor((current - state.energyAt) / ENERGY_INTERVAL));
    state.energy = Math.min(ENERGY_CAP, state.energy + ticks);
    state.energyAt = state.energy === ENERGY_CAP ? current : state.energyAt + ticks * ENERGY_INTERVAL;
  }
  if (dayKey(current) > state.daily.day) {
    state.daily = { day: dayKey(current), wins: 0, merges: 0, upgrades: 0, claimed: [] };
  }
  return state;
}
export function idleReward(state, now = Date.now()) {
  const elapsed = Math.min(OFFLINE_CAP, Math.max(0, Math.max(state.clock, now) - state.idleAt));
  const minutes = Math.floor(elapsed / 60000);
  return { minutes, gold: minutes * (2 + Math.floor(state.bestStage / 3)), ore: Math.floor((minutes + state.idleOreRemainder) / 5) };
}
export function claimIdle(state, now = Date.now()) {
  syncTime(state, now);
  const reward = idleReward(state, now);
  if (!reward.minutes) throw new Error('营地收益每分钟积累一次');
  state.gold += reward.gold;
  state.ore += reward.ore;
  state.idleOreRemainder = (state.idleOreRemainder + reward.minutes) % 5;
  state.idleAt = state.clock - ((state.clock - state.idleAt) % 60000);
  return reward;
}
export function talentCost(state, id) {
  if (!TALENTS.some(t => t.id === id)) throw new Error('天赋无效');
  return 80 + state.talents[id] * 60;
}
export function upgradeTalent(state, id) {
  const definition = TALENTS.find(t => t.id === id);
  if (!definition) throw new Error('天赋无效');
  if (state.talents[id] >= definition.max) throw new Error('天赋已满级');
  const cost = talentCost(state, id);
  if (state.gold < cost) throw new Error(`金币不足，需要 ${cost}`);
  state.gold -= cost;
  state.talents[id] += 1;
}
export function claimDaily(state, id, now = Date.now()) {
  const task = DAILY_TASKS.find(t => t.id === id);
  if (!task) throw new Error('任务不存在');
  syncTime(state, now);
  if (state.daily.claimed.includes(id)) throw new Error('奖励已领取');
  if (state.daily[id] < task.target) throw new Error('任务尚未完成');
  state.gold += task.gold;
  state.ore += task.ore;
  state.daily.claimed.push(id);
  return task;
}
export function salvage(state, ids) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new Error('请选择不同的背包装备');
  const items = ids.map(id => state.bag.find(item => item.id === id));
  if (items.some(item => !item || item.locked)) throw new Error('已穿戴或锁定的装备不能分解');
  const ore = items.reduce((sum, item) => sum + 5 * (RARITIES.findIndex(r => r.id === item.rarity) + 1) + item.level * 3, 0);
  state.bag = state.bag.filter(item => !ids.includes(item.id));
  state.ore += ore;
  return ore;
}
