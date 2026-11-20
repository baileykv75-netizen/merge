// @ts-nocheck
/** 装备合成原型的跨平台规则。只使用标准 JavaScript，网页和 Cocos 共用。 */

export const SAVE_VERSION = 1;
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
  weapon: ["星铁短剑", "月纹长枪", "碎光战斧"],
  helmet: ["守望头盔", "流星兜帽", "灰烬面甲"],
  armor: ["逐光战甲", "星痕外衣", "暮色胸甲"],
  boots: ["疾风战靴", "远行之靴", "夜行护足"],
  ring: ["微光指环", "银月戒指", "回响之环"],
  amulet: ["晨星护符", "潮汐吊坠", "辉石项链"],
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
export function newGame(seed = Date.now()) {
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
export function synthesize(state, ids) {
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
  const result = makeItem(state, RARITIES[rank + 1].id, sharedSlot);
  state.bag = state.bag.filter((item) => !ids.includes(item.id));
  state.bag.push(result);
  state.gold -= cost;
  state.history.unshift(`合成获得 ${RARITIES[rank + 1].name}·${result.name}`);
  state.history = state.history.slice(0, 20);
  return result;
}

/** @param {any} state @param {string} slot */
export function enhance(state, slot) {
  const item = state.equipped[slot];
  if (!item) throw new Error("请先穿戴装备");
  if (item.level >= 10) throw new Error("当前版本强化已达到上限");
  const ore = 10 * (item.level + 1);
  const gold = 30 * (item.level + 1);
  if (state.ore < ore || state.gold < gold) throw new Error(`强化需要铁矿 ${ore}、金币 ${gold}`);
  state.ore -= ore;
  state.gold -= gold;
  item.level += 1;
  state.history.unshift(`${item.name} 强化至 +${item.level}`);
  state.history = state.history.slice(0, 20);
  return item;
}

/** @param {any} state @param {number} stage */
export function battle(state, stage) {
  if (!Number.isInteger(stage) || stage < 1 || stage > 10 || stage > state.stageUnlocked) {
    throw new Error("关卡尚未开放");
  }
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
      const damage = Math.max(1, Math.round(hero.attack * (skill ? 1.7 : 1) * (0.9 + random(state) * 0.2)));
      enemyHp = Math.max(0, enemyHp - damage);
      events.push({ type: "hero", wave, damage, skill, enemyHp });
      if (enemyHp <= 0) break;
      const taken = Math.max(1, Math.round(enemyDamage * (0.9 + random(state) * 0.2) - hero.defense * 0.22));
      heroHp = Math.max(0, heroHp - taken);
      events.push({ type: "enemy", wave, damage: taken, heroHp });
    }
    if (heroHp <= 0 || turn >= 100) { won = false; break; }
  }
  const rewards = { gold: won ? 35 + stage * 18 : 10 + stage * 3, ore: won ? 3 + stage : 0, items: [] };
  state.gold += rewards.gold;
  state.ore += rewards.ore;
  if (won) {
    for (let i = 0; i < 2; i++) {
      const rarity = stage >= 5 && random(state) < 0.18 ? "fine" : "common";
      const item = makeItem(state, rarity);
      state.bag.push(item);
      rewards.items.push(item);
    }
    state.bestStage = Math.max(state.bestStage, stage);
    state.stageUnlocked = Math.min(10, Math.max(state.stageUnlocked, stage + 1));
  }
  state.history.unshift(`${won ? "通关" : "挑战失败"} 第 ${stage} 关，获得 ${rewards.gold} 金币`);
  state.history = state.history.slice(0, 20);
  return { won, stage, waveCount, heroHp, maxHeroHp: hero.health, events, rewards };
}

/** @param {unknown} value */
export function restoreGame(value) {
  if (!value || typeof value !== "object" || value.version !== SAVE_VERSION) return null;
  if (!Array.isArray(value.bag) || !value.equipped || !Number.isInteger(value.seed)) return null;
  if (!Number.isInteger(value.stageUnlocked) || value.stageUnlocked < 1 || value.stageUnlocked > 10) return null;
  return value;
}
