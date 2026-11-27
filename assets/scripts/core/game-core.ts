// @ts-nocheck
/** 装备合成原型的跨平台规则。只使用标准 JavaScript，网页和 Cocos 共用。 */

export const SAVE_VERSION = 7;
export const ENEMIES = {
  scout:{name:'荒原游兽',health:1,attack:1,mechanic:'普通攻击',tip:'穿戴完整装备，提高基础属性'},
  raider:{name:'掠夺者',health:0.95,attack:1,mechanic:'每三次攻击发动伏击',tip:'生命与坚守可承受伏击'},
  bulwark:{name:'铁甲卫士',health:1.15,attack:0.9,armor:0.25,mechanic:'护甲抵消 25% 直接伤害',tip:'破甲斩与毒伤可绕过护甲'},
  mender:{name:'腐根祭司',health:1.1,attack:0.9,heal:0.08,mechanic:'每三次攻击恢复 8% 生命',tip:'淬毒期间恢复量减半，爆发伤害能压过恢复'},
  hexer:{name:'沼泽巫妖',health:0.9,attack:1.1,elemental:true,mechanic:'元素攻击；每三次发动灼烧',tip:'元素抗性词条与复苏提升续航'},
  berserker:{name:'狂战守卫',health:1.1,attack:1,enrage:1.4,mechanic:'生命低于一半后伤害提高 40%',tip:'保留生存能力，使用高伤技能结束战斗'},
  chief:{name:'荒原统领',health:1.8,attack:1.05,charge:3,boss:true,mechanic:'蓄力后发动 2.2 倍重击',tip:'蓄力会提前提示；坚守与生命宝石有助于生存'},
  rootlord:{name:'腐根之主',health:2,attack:1,heal:0.12,elemental:true,boss:true,mechanic:'每三次攻击恢复 12% 生命，并造成元素伤害',tip:'淬毒抑制恢复，配合伤害技能突破回复'},
  warden:{name:'熔铁典狱长',health:2.1,attack:1.1,armor:0.35,enrage:1.5,charge:4,boss:true,mechanic:'35% 护甲；半血狂暴；每四次攻击发动重击',tip:'破甲斩、淬毒和坚守可组成攻防方案'},
};
export const CHAPTERS = [
  {name:'荒原边境',description:'清理荒原道路，突破掠夺者的营寨。',names:['边境小径','碎石坡','废弃哨站','岔路伏兵','旧堡外墙','巡逻营地','铁甲关隘','荒原深处','营寨前哨','统领营帐'],
    waves:[['scout','scout'],['scout','raider'],['raider','scout'],['scout','raider','scout'],['scout','bulwark','raider'],['raider','scout','raider'],['scout','bulwark','bulwark'],['raider','bulwark','raider'],['bulwark','raider','bulwark'],['raider','bulwark','chief']]},
  {name:'腐根湿地',description:'穿越毒雾，打断腐根生物的恢复。',names:['湿地入口','雾中栈道','腐木营地','祭司林地','深水渡口','毒雾迷径','朽根祭坛','双生古树','王庭护卫','腐根王庭'],
    waves:[['scout','mender','scout'],['hexer','scout','mender'],['raider','mender','hexer'],['mender','hexer','mender'],['bulwark','hexer','mender'],['hexer','hexer','raider'],['mender','bulwark','mender'],['mender','hexer','mender','hexer'],['bulwark','mender','hexer','berserker'],['hexer','mender','bulwark','rootlord']]},
  {name:'熔铁要塞',description:'应对重甲与狂暴，击败典狱长。',names:['要塞大门','熔渣阶梯','军械库','熔炉回廊','重甲工坊','断链监牢','狂战大厅','内城高墙','典狱长近卫','熔铁王座'],
    waves:[['bulwark','raider','berserker','bulwark'],['hexer','bulwark','berserker','hexer'],['bulwark','bulwark','raider','berserker'],['hexer','mender','bulwark','berserker'],['bulwark','berserker','bulwark','berserker'],['berserker','mender','hexer','bulwark'],['berserker','berserker','bulwark','berserker'],['hexer','bulwark','mender','berserker'],['bulwark','berserker','bulwark','berserker'],['berserker','hexer','bulwark','warden']]},
];
export const STAGES = CHAPTERS.flatMap((c,chapter)=>c.names.map((name,index)=>({id:chapter*10+index+1,name,chapter,waves:c.waves[index]})));
export const MAX_STAGE = STAGES.length;
export const MILESTONES = [5,10,15,20,25,30].map((stage,i)=>({stage,rarity:['common','fine','fine','rare','rare','epic'][i],slot:i%2?'armor':'weapon',gold:200+i*150,ore:25+i*15}));
export function stageInfo(stage) {
  const def=STAGES[stage-1];if(!Number.isInteger(stage)||!def)throw new Error('关卡不存在');
  const base=def.chapter===0?'common':def.chapter===1?'fine':'rare';
  const bonus=def.chapter===0?'fine':def.chapter===1?'rare':'epic';
  const chance=stage%10>=5||stage%10===0 ? (def.chapter===2?0.1:0.18):0;
  const growth=Math.max(0,stage-8);
  const foes=def.waves.map((id,i)=>({...ENEMIES[id],id,maxHp:Math.round((33+stage*13+(i+1)*10)*ENEMIES[id].health*(1+growth*0.12)),damage:(3+stage*2+i+1)*ENEMIES[id].attack*(1+growth*0.08)}));
  return {...def,chapterName:CHAPTERS[def.chapter].name,foes,gold:35+stage*18,ore:3+stage,baseRarity:base,bonusRarity:bonus,bonusChance:chance};
}
export function claimMilestone(state,stage) {
  gemGuard(state);const prize=MILESTONES.find(m=>m.stage===stage);
  if(!prize||state.bestStage<stage)throw new Error('尚未达成通关目标');
  if(state.milestoneClaims.includes(stage))throw new Error('该宝箱已领取');
  if(state.bag.length>95)throw new Error('请先在背包留出 5 个空位');
  const items=Array.from({length:5},()=>makeItem(state,prize.rarity,prize.slot));
  state.bag.push(...items);state.gold+=prize.gold;state.ore+=prize.ore;state.milestoneClaims.push(stage);
  state.history.unshift(`领取第 ${stage} 关宝箱：五件同部位装备，可用于合成`);state.history=state.history.slice(0,20);
  return {...prize,items};
}
export const SKILLS = [
  {id:'slash',name:'强力突刺',unlock:0,prerequisite:null,required:0,cooldown:3,description:'造成攻击力 170% / 195% / 220% 伤害'},
  {id:'mend',name:'复苏',unlock:2,prerequisite:null,required:0,cooldown:5,description:'恢复最大生命的 12% / 16% / 20%'},
  {id:'cleave',name:'破甲斩',unlock:3,prerequisite:'slash',required:2,cooldown:4,description:'造成 215% / 250% / 285% 伤害，穿透敌人护甲'},
  {id:'guard',name:'坚守',unlock:4,prerequisite:'mend',required:1,cooldown:5,description:'接下来两次受击减少 35% / 45% / 55% 伤害'},
  {id:'venom',name:'淬毒',unlock:6,prerequisite:'cleave',required:1,cooldown:6,description:'连续三次行动造成攻击力 30% / 40% / 50% 毒伤'},
  {id:'fury',name:'战吼',unlock:8,prerequisite:'guard',required:1,cooldown:7,description:'接下来三次攻击增强 30% / 40% / 50%'},
];
function initialSkills() { return Object.fromEntries(SKILLS.map(s => [s.id,s.id==='slash'?1:0])); }
export const GEM_TYPES = [
  {id:'ruby',name:'赤晶',stat:'attack',label:'攻击',base:3,slots:['weapon','ring','amulet']},
  {id:'emerald',name:'翠晶',stat:'health',label:'生命',base:20,slots:['helmet','armor','amulet']},
  {id:'sapphire',name:'蓝晶',stat:'defense',label:'防御',base:2,slots:['helmet','armor','boots']},
];
function emptyGems() { return Object.fromEntries(GEM_TYPES.flatMap(g => [1,2,3,4,5].map(tier => [`${g.id}:${tier}`,0]))); }
export const DUNGEONS = [
  {id:'gold', name:'盗匪营地', resource:'金币', unlock:2, rewards:[180,450,900], mechanic:'盗匪每三次攻击发动伏击，伤害翻倍'},
  {id:'ore', name:'铁甲矿坑', resource:'铁矿', unlock:2, rewards:[25,60,120], mechanic:'矿坑守卫生命提高，护甲抵消 18% 伤害'},
  {id:'shards', name:'熔火遗迹', resource:'重铸石', unlock:3, rewards:[5,10,18], mechanic:'敌人造成元素伤害，每三次攻击发动灼烧'},
  {id:'dust', name:'幽雾林地', resource:'洗练尘', unlock:5, rewards:[5,10,18], mechanic:'敌人每三次攻击恢复 10% 生命'},
  {id:'gems', name:'晶簇洞窟', resource:'宝石', unlock:4, rewards:[5,10,15], mechanic:'晶簇守卫每三次攻击发动碎晶重击，胜利获得一组同类一级宝石'},
];
export const DIFFICULTIES = ['普通','困难','噩梦'];
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
    sockets: [null],
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
    stageProgress: {},
    milestoneClaims: [],
    gold: 120,
    ore: 25,
    shards: 0,
    dust: 0,
    gems: emptyGems(),
    skills: initialSkills(),
    skillLoadouts: [['slash',null,null],['slash',null,null]],
    activeLoadout: 0,
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
    dungeonDay: dayKey(now),
    dungeonAttempts: Object.fromEntries(DUNGEONS.map(d => [d.id, 0])),
    dungeonClears: Object.fromEntries(DUNGEONS.map(d => [d.id, -1])),
  };
  state.equipped.weapon = makeItem(state, "common", "weapon");
  state.equipped.armor = makeItem(state, "common", "armor");
  return state;
}

/** @param {any} item */
export function itemStats(item) {
  if (!item) return { attack: 0, health: 0, defense: 0 };
  const boost = 1 + (item.level || 0) * 0.12;
  const stats = {
    attack: whole(item.attack * boost),
    health: whole(item.health * boost),
    defense: whole(item.defense * boost),
  };
  for (const gem of item.sockets || []) if (gem) {
    const type = GEM_TYPES.find(g => g.id === gem.type);
    if (type) stats[type.stat] += type.base * 2 ** (gem.tier - 1);
  }
  return stats;
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
  guardForge(state);
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
  guardForge(state);
  const item = state.bag.find((candidate) => candidate.id === id);
  if (!item) throw new Error("只能锁定背包中的装备");
  item.locked = !item.locked;
  return item.locked;
}

/** @param {any} state @param {string[]} ids */
export function synthesize(state, ids, now = Date.now()) {
  guardForge(state);
  if (!Array.isArray(ids) || ids.length !== 5 || new Set(ids).size !== 5) {
    throw new Error("必须选择 5 件不同的装备");
  }
  const selected = ids.map((id) => state.bag.find((item) => item.id === id));
  if (selected.some((item) => !item)) throw new Error("材料必须都在背包中");
  if (selected.some((item) => item.locked)) throw new Error("锁定的装备不能用于合成");
  if (selected.some(item => item.sockets?.some(Boolean))) throw new Error('请先卸下材料装备中的宝石');
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
  guardForge(state);
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
  guardForge(state);
  if (state.encounter) throw new Error('请先完成当前战斗');
  if (!Number.isInteger(stage) || stage < 1 || stage > MAX_STAGE || stage > state.stageUnlocked) {
    throw new Error("关卡尚未开放");
  }
  syncTime(state, now);
  if (state.energy < 1) throw new Error("体力不足");
  state.energy -= 1;
  const combat = simulateCombat(state, stage);
  const info = stageInfo(stage);
  const { won } = combat;
  state.stageProgress[stage]=Math.max(state.stageProgress[stage]||0,combat.progress);
  const rewards = { gold: won ? info.gold : 10 + stage * 3, ore: won ? info.ore : 0, items: [] };
  rewards.shards = won && stage >= 3 ? 1 + Math.floor(stage / 5) : 0;
  rewards.dust = won && stage >= 5 ? 1 + Math.floor(stage / 7) : 0;
  state.shards += rewards.shards;
  state.dust += rewards.dust;
  state.gold += rewards.gold;
  state.ore += rewards.ore;
  if (won) {
    state.daily.wins += 1;
    for (let i = 0; i < 2; i++) {
      const rarity = info.bonusChance && random(state) < info.bonusChance ? info.bonusRarity : info.baseRarity;
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
    state.stageUnlocked = Math.min(MAX_STAGE, Math.max(state.stageUnlocked, stage + 1));
  }
  state.history.unshift(`${won ? "通关" : "挑战失败"} 第 ${stage} 关，获得 ${rewards.gold} 金币`);
  state.history = state.history.slice(0, 20);
  return { ...combat, rewards };
}

function simulateCombat(state, stage, profile = null) {
  const hero = heroStats(state);
  let heroHp = hero.health;
  const events = [];
  const mainInfo=profile ? null : stageInfo(stage);
  const waveCount = mainInfo ? mainInfo.waves.length : stage < 4 ? 2 : stage < 8 ? 3 : 4;
  const equippedSkills = state.skillLoadouts[state.activeLoadout].filter(Boolean);
  const readyAt = Object.fromEntries(equippedSkills.map(id => [id, SKILLS.find(s=>s.id===id).cooldown]));
  let tick = 0, shield = 0, shieldRate = 0, fury = 0, furyRate = 0;
  let won = true;
  let progress = 0;
  for (let wave = 1; wave <= waveCount; wave++) {
    const enemyId=mainInfo?.waves[wave-1], foe=mainInfo?.foes[wave-1];
    const armor=foe?.armor || (profile==='ore'?0.18:0);
    let enemyHp = foe?.maxHp || Math.round((33 + stage * 13 + wave * 10) * (profile === 'ore' ? 1.15 : 1));
    const enemyMaxHp = enemyHp;
    const enemyDamage = foe?.damage || 3 + stage * 2 + wave;
    events.push({ type: "wave", wave, maxHp: enemyHp, ...(foe?{enemyId,enemyName:foe.name,mechanic:foe.mechanic,boss:!!foe.boss}:{}) });
    let turn = 0;
    let poison = 0, poisonDamage = 0;
    let enraged = false;
    while (enemyHp > 0 && heroHp > 0 && turn < 100) {
      turn += 1;
      tick += 1;
      let skill = null;
      for (const id of equippedSkills) {
        const definition = SKILLS.find(s=>s.id===id), level = state.skills[id];
        if (tick < readyAt[id]) continue;
        if (id === 'slash' || id === 'cleave') {
          if (skill) continue;
          skill = id;
        } else if (id === 'mend') {
          if (heroHp === hero.health) continue;
          const amount = Math.min(hero.health-heroHp,Math.round(hero.health*(0.08+level*0.04)));
          heroHp += amount; events.push({type:'heal',wave,heroHp,amount,skill:id});
        } else {
          if (id === 'guard') { shield=2;shieldRate=0.25+0.1*level; }
          if (id === 'fury') { fury=3;furyRate=0.2+0.1*level; }
          if (id === 'venom') { poison=3;poisonDamage=Math.max(1,Math.round(hero.attack*(0.2+0.1*level))); }
          events.push({type:'buff',wave,skill:id});
        }
        readyAt[id] = tick + definition.cooldown;
      }
      const poisoned = poison > 0;
      if (poisoned) {
        poison--; const damage = Math.min(enemyHp,poisonDamage); enemyHp -= damage;
        events.push({type:'hero',wave,damage,enemyHp,skill:'venom',critical:false});
        if (enemyHp<=0) break;
      }
      const critical = random(state) < hero.crit;
      const skillPower = skill === 'slash' ? 1.45+0.25*state.skills.slash : skill === 'cleave' ? 1.8+0.35*state.skills.cleave : 1;
      const damage = Math.max(1, Math.round(hero.attack * skillPower * (fury>0 ? 1+furyRate : 1) * (critical ? 1.5 : 1) * (skill !== 'cleave' ? 1-armor : 1) * (0.9 + random(state) * 0.2)));
      if (fury>0) fury--;
      enemyHp = Math.max(0, enemyHp - damage);
      const cooldowns = equippedSkills.map(id=>({id,remaining:Math.max(0,readyAt[id]-tick)}));
      events.push({ type: "hero", wave, damage, skill, critical, enemyHp, cooldowns });
      if (enemyHp <= 0) break;
      if(foe?.enrage && enemyHp<=enemyMaxHp/2 && !enraged){enraged=true;events.push({type:'enemyStatus',wave,text:`${foe.name}进入狂暴，伤害提高 ${Math.round((foe.enrage-1)*100)}%`});}
      const ability = foe?.charge && turn%foe.charge===0 ? '蓄力重击' : turn % 3 === 0 && (profile === 'gold'||enemyId==='raider') ? '伏击' : turn % 3 === 0 && (profile === 'shards'||enemyId==='hexer') ? '灼烧' : turn % 3 === 0 && profile === 'gems' ? '碎晶重击' : '';
      const multiplier = ability === '蓄力重击' ? 2.2 : ability === '伏击' ? 2 : ability ? 1.5 : 1;
      const taken = Math.max(1, Math.round((enemyDamage * multiplier * (enraged?foe.enrage:1) * (0.9 + random(state) * 0.2) - hero.defense * 0.22) * (profile === 'shards' || foe?.elemental ? 1 - hero.resist : 1) * (shield>0 ? 1-shieldRate : 1)));
      if (shield>0) shield--;
      heroHp = Math.max(0, heroHp - taken);
      events.push({ type: "enemy", wave, damage: taken, heroHp, ability });
      if(heroHp>0 && foe?.charge && turn%foe.charge===foe.charge-1)events.push({type:'enemyStatus',wave,text:`${foe.name}正在蓄力，下次攻击发动重击`});
      if (heroHp > 0 && (profile === 'dust'||foe?.heal) && turn % 3 === 0) {
        const amount = Math.min(enemyMaxHp - enemyHp, Math.ceil(enemyMaxHp * (foe?.heal||0.1) * (poisoned?0.5:1)));
        enemyHp += amount;
        events.push({type:'enemyHeal', wave, amount, enemyHp, suppressed:poisoned});
      }
      if (heroHp > 0 && hero.regen) {
        heroHp = Math.min(hero.health, heroHp + hero.regen);
        events.push({ type: 'heal', wave, heroHp, amount: hero.regen });
      }
    }
    progress=Math.round((wave-1+(1-enemyHp/enemyMaxHp))/waveCount*100);
    if (heroHp <= 0 || turn >= 100) { won = false; break; }
  }
  return { won, stage, waveCount, heroHp, maxHeroHp: hero.health, events, progress:won?100:Math.min(99,progress) };
}

/** @param {unknown} value */
export function restoreGame(value, now = Date.now()) {
  if (!value || typeof value !== "object" || ![1, 2, 3, 4, 5, 6, SAVE_VERSION].includes(value.version)) return null;
  if (!Array.isArray(value.bag) || !value.equipped || !Number.isInteger(value.seed)) return null;
  if (!Number.isInteger(value.stageUnlocked) || value.stageUnlocked < 1 || value.stageUnlocked > MAX_STAGE) return null;
  const validNumber = n => Number.isSafeInteger(n) && n >= 0;
  if (!['gold', 'ore', 'energy', 'bestStage', 'nextItemId'].every(k => validNumber(value[k]))) return null;
  if (value.energy > ENERGY_CAP || value.bestStage > MAX_STAGE || value.nextItemId < 1 || value.bag.length > 100) return null;
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
  const oldVersion = state.version;
  if (state.version === 1) {
    Object.assign(state, { version: SAVE_VERSION, clock: now, energyAt: now, idleAt: now, idleOreRemainder: 0,
      talents: { attack: 0, health: 0, defense: 0 },
      daily: { day: dayKey(now), wins: 0, merges: 0, upgrades: 0, claimed: [] } });
  }
  if (oldVersion < 3) { state.shards = 0; state.dust = 0; state.version = SAVE_VERSION; }
  if (oldVersion < 4) {
    state.dungeonDay = dayKey(Math.max(state.clock, now));
    state.dungeonAttempts = Object.fromEntries(DUNGEONS.map(d => [d.id, 0]));
    state.dungeonClears = Object.fromEntries(DUNGEONS.map(d => [d.id, -1]));
    state.version = SAVE_VERSION;
  }
  if (oldVersion < 5) {
    state.gems = emptyGems(); state.version = SAVE_VERSION;
    if (state.dungeonAttempts) state.dungeonAttempts.gems = 0;
    if (state.dungeonClears) state.dungeonClears.gems = -1;
    for (const item of [...state.bag,...Object.values(state.equipped)].filter(Boolean)) item.sockets = [null];
  }
  const gemKeys = Object.keys(emptyGems());
  if (oldVersion < 6) {
    state.skills = initialSkills(); state.skillLoadouts = [['slash',null,null],['slash',null,null]];
    state.activeLoadout = 0; state.version = SAVE_VERSION;
  }
  if(oldVersion<7){
    state.version=SAVE_VERSION;state.milestoneClaims=[];
    state.stageProgress=Object.fromEntries(Array.from({length:state.bestStage},(_,i)=>[i+1,100]));
    state.stageUnlocked=Math.max(state.stageUnlocked,Math.min(MAX_STAGE,state.bestStage+1));
  }
  if(!Array.isArray(state.milestoneClaims)||new Set(state.milestoneClaims).size!==state.milestoneClaims.length||state.milestoneClaims.some(s=>s>state.bestStage||!MILESTONES.some(m=>m.stage===s)))return null;
  if(!state.stageProgress||typeof state.stageProgress!=='object'||Array.isArray(state.stageProgress)||Object.entries(state.stageProgress).some(([s,p])=>!STAGES.some(d=>String(d.id)===s)||!validNumber(p)||p>100))return null;
  if (!state.skills || SKILLS.some(s => !validNumber(state.skills[s.id]) || state.skills[s.id]>3 ||
    (state.skills[s.id]>0 && (state.bestStage<s.unlock || (s.prerequisite && state.skills[s.prerequisite]<s.required)))) || state.skills.slash<1 || skillPoints(state)<0) return null;
  if (![0,1].includes(state.activeLoadout) || !Array.isArray(state.skillLoadouts) || state.skillLoadouts.length!==2 || state.skillLoadouts.some(loadout =>
    !Array.isArray(loadout) || loadout.length!==3 || new Set(loadout.filter(Boolean)).size!==loadout.filter(Boolean).length ||
    loadout.some(id=>id!==null && (!SKILLS.some(s=>s.id===id) || !state.skills[id])))) return null;
  if (!state.gems || typeof state.gems !== 'object' || Object.keys(state.gems).length !== gemKeys.length || gemKeys.some(k => !validNumber(state.gems[k]))) return null;
  for (const item of [...state.bag,...Object.values(state.equipped)].filter(Boolean)) {
    if (!Array.isArray(item.sockets) || item.sockets.length < 1 || item.sockets.length > 2 || item.sockets.some(gem =>
      gem !== null && (!gem || !Number.isInteger(gem.tier) || gem.tier < 1 || gem.tier > 5 || !GEM_TYPES.some(g => g.id === gem.type && g.slots.includes(item.slot))))) return null;
  }
  if (!validNumber(state.dungeonDay) || !state.dungeonAttempts || !state.dungeonClears || DUNGEONS.some(d =>
    !validNumber(state.dungeonAttempts[d.id]) || state.dungeonAttempts[d.id] > 3 ||
    !Number.isInteger(state.dungeonClears[d.id]) || state.dungeonClears[d.id] < -1 || state.dungeonClears[d.id] > 2)) return null;
  if (!validNumber(state.shards) || !validNumber(state.dust)) return null;
  if (!['clock', 'energyAt', 'idleAt'].every(k => validNumber(state[k]))) return null;
  if (!validNumber(state.idleOreRemainder) || state.idleOreRemainder >= 5) return null;
  if (!state.talents || TALENTS.some(t => !validNumber(state.talents[t.id]) || state.talents[t.id] > t.max)) return null;
  const d = state.daily;
  if (!d || !validNumber(d.day) || !['wins', 'merges', 'upgrades'].every(k => validNumber(d[k]))
    || !Array.isArray(d.claimed) || new Set(d.claimed).size !== d.claimed.length
    || d.claimed.some(id => !DAILY_TASKS.some(t => t.id === id))) return null;
  if (state.encounter != null && !validEncounter(state.encounter)) return null;
  if (state.pendingForge != null) {
    const p = state.pendingForge;
    const item = findItem(state, p.itemId);
    if (!item || item.locked || state.encounter || !['reforge','wash'].includes(p.kind)) return null;
    if (p.kind === 'wash' && (!item.affix || !['暴击','生命恢复','元素抗性'].includes(p.affix))) return null;
    if (p.kind === 'reforge') {
      const range = baseRange(item);
      if (!p.stats || ['attack','health','defense'].some(k => !validNumber(p.stats[k]) || p.stats[k] < range.min[k] || p.stats[k] > range.max[k])) return null;
    }
  }
  return state;
}

function validEncounter(encounter) {
  const r = encounter?.result;
  const nonnegative = x => Number.isSafeInteger(x) && x >= 0;
  if (r?.kind != null && (r.kind !== 'dungeon' || !DUNGEONS.some(d => d.id === r.dungeonId) || !Number.isInteger(r.difficulty) || r.difficulty < 0 || r.difficulty > 2)) return false;
  if (!r || typeof r.won !== 'boolean' || !Number.isInteger(r.stage) || r.stage < 1 || r.stage > MAX_STAGE
    || !Number.isInteger(r.waveCount) || r.waveCount < 2 || r.waveCount > 4
    || !nonnegative(r.heroHp) || !nonnegative(r.maxHeroHp) || r.maxHeroHp < 1 || r.heroHp > r.maxHeroHp
    || !Array.isArray(r.events) || r.events.length > 1500 || !nonnegative(encounter.cursor)
    || encounter.cursor > r.events.length || !r.rewards || !nonnegative(r.rewards.gold)
    || !nonnegative(r.rewards.ore) || !Array.isArray(r.rewards.items)) return false;
  return r.events.every(e => e && Number.isInteger(e.wave) && e.wave >= 1 && e.wave <= r.waveCount && (
    e.type === 'wave' ? nonnegative(e.maxHp) && e.maxHp > 0 :
    e.type === 'hero' ? nonnegative(e.damage) && nonnegative(e.enemyHp) :
    e.type === 'enemy' ? nonnegative(e.damage) && nonnegative(e.heroHp) && e.heroHp <= r.maxHeroHp :
    e.type === 'heal' ? nonnegative(e.amount) && nonnegative(e.heroHp) && e.heroHp <= r.maxHeroHp :
    e.type === 'enemyHeal' ? nonnegative(e.amount) && nonnegative(e.enemyHp) :
    e.type === 'buff' ? ['guard','venom','fury'].includes(e.skill) :
    e.type === 'enemyStatus' ? typeof e.text==='string' && e.text.length<100 : false));
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
    attacks: 0, last: null, cooldowns: [], enemyName:'敌人',mechanic:'',boss:false, done: c.cursor === c.result.events.length, result: c.result };
  for (const e of c.result.events.slice(0, c.cursor)) {
    view.last = e; view.wave = e.wave;
    if (e.type === 'wave') { view.enemyHp = e.maxHp; view.enemyMaxHp = e.maxHp; view.attacks = 0;view.enemyName=e.enemyName||'敌人';view.mechanic=e.mechanic||'';view.boss=!!e.boss; }
    if (e.type === 'hero') { view.enemyHp = e.enemyHp; view.attacks++; }
    if (e.cooldowns) view.cooldowns = e.cooldowns;
    if (e.type === 'enemyHeal') view.enemyHp = e.enemyHp;
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
  if (dayKey(current) > state.dungeonDay) {
    state.dungeonDay = dayKey(current);
    state.dungeonAttempts = Object.fromEntries(DUNGEONS.map(d => [d.id,0]));
  }
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
  guardForge(state);
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new Error('请选择不同的背包装备');
  const items = ids.map(id => state.bag.find(item => item.id === id));
  if (items.some(item => !item || item.locked)) throw new Error('已穿戴或锁定的装备不能分解');
  if (items.some(item => item.sockets?.some(Boolean))) throw new Error('请先卸下装备中的宝石');
  const ore = items.reduce((sum, item) => sum + 5 * (RARITIES.findIndex(r => r.id === item.rarity) + 1) + item.level * 3, 0);
  state.bag = state.bag.filter(item => !ids.includes(item.id));
  state.ore += ore;
  return ore;
}

function guardForge(state) {
  if (state.pendingForge) throw new Error('请先在锻造台决定保留旧属性或采用新属性');
}
export function findItem(state, id) {
  return [...state.bag, ...Object.values(state.equipped)].find(item => item?.id === id) || null;
}
function baseFor(item, primary) {
  return { attack: ['weapon','ring','amulet'].includes(item.slot) ? primary : 0,
    health: ['armor','helmet','amulet'].includes(item.slot) ? primary * 5 : 0,
    defense: ['boots','helmet','armor'].includes(item.slot) ? Math.round(primary * 0.55) : 0 };
}
export function baseRange(item) {
  const rank = RARITIES.findIndex(r => r.id === item.rarity);
  const base = (5 + rank * 3) * RARITIES[rank].scale;
  return { min: baseFor(item, Math.round(base * 0.85)), max: baseFor(item, Math.round(base * 1.15)) };
}
export function forgeQuote(item, kind) {
  if (!['reforge','wash'].includes(kind)) throw new Error('锻造类型无效');
  const rank = RARITIES.findIndex(r => r.id === item.rarity);
  return { gold: (kind === 'reforge' ? 60 : 80) * (rank + 1),
    material: kind === 'reforge' ? 'shards' : 'dust', amount: rank + 2 };
}
export function rollForge(state, id, kind) {
  guardForge(state);
  if (state.encounter) throw new Error('请先完成当前战斗');
  const item = findItem(state, id);
  if (!item) throw new Error('装备不存在');
  if (item.locked) throw new Error('请先解锁装备');
  if (kind === 'wash' && !item.affix) throw new Error('精良及以上装备才有可洗练词条');
  const quote = forgeQuote(item, kind);
  if (state.gold < quote.gold || state[quote.material] < quote.amount) throw new Error('金币或锻造材料不足');
  const offer = { itemId: id, kind };
  if (kind === 'wash') {
    const choices = ['暴击','生命恢复','元素抗性'].filter(x => x !== item.affix);
    offer.affix = choices[pick(state, choices.length)];
  } else {
    const rank = RARITIES.findIndex(r => r.id === item.rarity);
    const primary = Math.round((5 + rank * 3) * RARITIES[rank].scale * (0.85 + random(state) * 0.3));
    offer.stats = baseFor(item, primary);
  }
  state.gold -= quote.gold; state[quote.material] -= quote.amount;
  state.pendingForge = offer;
  return offer;
}
export function resolveForge(state, accept) {
  if (typeof accept !== 'boolean') throw new Error('请选择采用或保留');
  const p = state.pendingForge;
  if (!p) throw new Error('没有待确认的锻造结果');
  const item = findItem(state, p.itemId);
  if (!item) throw new Error('装备不存在');
  if (accept) {
    if (p.kind === 'wash') item.affix = p.affix;
    else Object.assign(item, p.stats);
  }
  state.pendingForge = null;
  return item;
}
export function compareItem(state, item) {
  const before = heroStats(state);
  const after = heroStats({...state, equipped: {...state.equipped, [item.slot]: item}});
  return { before, after, attack: after.attack-before.attack, health: after.health-before.health,
    defense: after.defense-before.defense, power: after.power-before.power,
    crit: after.crit-before.crit, regen: after.regen-before.regen, resist: after.resist-before.resist };
}
export function transferQuote(state, targetId) {
  const target = state.bag.find(item => item.id === targetId);
  if (!target) throw new Error('请选择背包内的新装备');
  const source = state.equipped[target.slot];
  if (!source || source.level <= target.level) throw new Error('当前穿戴装备的强化等级必须高于新装备');
  if (source.locked || target.locked) throw new Error('请先解锁两件装备');
  return { source, target, gold: source.level * 40 };
}
export function transferEnhancement(state, targetId) {
  guardForge(state);
  if (state.encounter) throw new Error('请先完成当前战斗');
  const {source,target,gold} = transferQuote(state,targetId);
  if (state.gold < gold) throw new Error(`金币不足，需要 ${gold}`);
  state.gold -= gold;
  [source.level,target.level] = [target.level,source.level];
  return target;
}

export function dungeonInfo(state, id, difficulty = 0, now = Date.now()) {
  const definition = DUNGEONS.find(d => d.id === id);
  if (!definition || !Number.isInteger(difficulty) || difficulty < 0 || difficulty > 2) throw new Error('副本或难度无效');
  const requiredStage = Math.max(definition.unlock, [2,5,8][difficulty]);
  const day = dayKey(Math.max(state.clock,now));
  const used = day > state.dungeonDay ? 0 : state.dungeonAttempts[id];
  const unlocked = state.bestStage >= requiredStage;
  const previousCleared = difficulty === 0 || state.dungeonClears[id] >= difficulty-1;
  return { ...definition, difficulty, requiredStage, unlocked, previousCleared,
    remaining: Math.max(0,3-used), canSweep: state.dungeonClears[id] >= difficulty,
    reward: definition.rewards[difficulty], energy: 2, stage: 2 + difficulty * 3 };
}
function enterDungeon(state, id, difficulty, sweep, now) {
  guardForge(state);
  if (state.encounter) throw new Error('请先完成当前战斗');
  const info = dungeonInfo(state,id,difficulty,now);
  if (!info.unlocked) throw new Error(`通关主线第 ${info.requiredStage} 关后解锁`);
  if (!info.previousCleared) throw new Error('请先通关上一难度');
  if (sweep && !info.canSweep) throw new Error('首次通关本难度后才可扫荡');
  if (!info.remaining) throw new Error('今日该副本次数已用完，明日 00:00 刷新');
  syncTime(state,now);
  if (state.energy < info.energy) throw new Error('体力不足，需要 2 点');
  state.energy -= info.energy;
  state.dungeonAttempts[id]++;
  return info;
}
function dungeonRewards(state, info, won) {
  const rewards = {gold:0,ore:0,shards:0,dust:0,items:[]};
  if (won && info.id === 'gems') {
    const type = GEM_TYPES[pick(state,GEM_TYPES.length)].id;
    state.gems[`${type}:1`] += info.reward;
    rewards.gems = [{type,tier:1,count:info.reward}];
  } else if (won) { rewards[info.id] = info.reward; state[info.id] += info.reward; }
  return rewards;
}
export function startDungeon(state, id, difficulty = 0, now = Date.now()) {
  const info = enterDungeon(state,id,difficulty,false,now);
  const combat = simulateCombat(state,info.stage,id);
  const rewards = dungeonRewards(state,info,combat.won);
  if (combat.won) { state.dungeonClears[id] = Math.max(state.dungeonClears[id],difficulty); state.daily.wins++; }
  const result = {...combat,rewards,kind:'dungeon',dungeonId:id,difficulty};
  state.encounter = {result,cursor:0};
  state.history.unshift(`${info.name}·${DIFFICULTIES[difficulty]} ${combat.won ? '通关' : '失败'}，${info.resource} +${combat.won ? info.reward : 0}`);
  state.history=state.history.slice(0,20);
  return state.encounter;
}
export function sweepDungeon(state, id, difficulty = 0, now = Date.now()) {
  const info = enterDungeon(state,id,difficulty,true,now);
  const rewards = dungeonRewards(state,info,true);
  state.history.unshift(`扫荡 ${info.name}·${DIFFICULTIES[difficulty]}，${info.resource} +${info.reward}`);
  state.history=state.history.slice(0,20);
  return rewards;
}

export function gemTotal(state) { return Object.values(state.gems).reduce((sum,count) => sum + count,0); }
function gemDefinition(type,tier) {
  const definition = GEM_TYPES.find(g => g.id === type);
  if (!definition || !Number.isInteger(tier) || tier < 1 || tier > 5) throw new Error('宝石类型或等级无效');
  return definition;
}
function gemGuard(state) { guardForge(state); if (state.encounter) throw new Error('请先完成当前战斗'); }
export function mergeGems(state,type,tier) {
  gemGuard(state); gemDefinition(type,tier);
  if (tier === 5) throw new Error('宝石已达最高等级');
  const key = `${type}:${tier}`, gold = tier * 30;
  if (state.gems[key] < 5) throw new Error('需要五颗同类同级的未镶嵌宝石');
  if (state.gold < gold) throw new Error(`金币不足，需要 ${gold}`);
  state.gems[key] -= 5; state.gems[`${type}:${tier+1}`]++; state.gold -= gold;
  return {type,tier:tier+1};
}
function socketItem(state,id) {
  gemGuard(state);
  const item = findItem(state,id);
  if (!item) throw new Error('装备不存在');
  if (item.locked) throw new Error('请先解锁装备');
  return item;
}
export function drillSocket(state,id) {
  const item = socketItem(state,id);
  if (item.sockets.length >= 2) throw new Error('该装备已达到两个孔位上限');
  if (state.gold < 200 || state.ore < 60) throw new Error('打孔需要 200 金币和 60 铁矿');
  state.gold -= 200; state.ore -= 60; item.sockets.push(null);
}
export function mountGem(state,id,index,type,tier) {
  const item = socketItem(state,id), definition = gemDefinition(type,tier);
  if (!Number.isInteger(index) || index < 0 || index >= item.sockets.length) throw new Error('孔位尚未开启');
  if (item.sockets[index]) throw new Error('请先卸下原宝石');
  if (!definition.slots.includes(item.slot)) throw new Error('该宝石不适用于此装备部位');
  const key = `${type}:${tier}`;
  if (state.gems[key] < 1) throw new Error('没有可用的同类同级宝石');
  state.gems[key]--; item.sockets[index] = {type,tier};
}
export function unmountGem(state,id,index) {
  const item = socketItem(state,id);
  if (!Number.isInteger(index) || index < 0 || index >= item.sockets.length || !item.sockets[index]) throw new Error('该孔位没有宝石');
  const gem = item.sockets[index]; state.gems[`${gem.type}:${gem.tier}`]++; item.sockets[index] = null;
  return gem;
}

export function skillPoints(state) {
  const spent = SKILLS.reduce((sum,s)=>{const level=state.skills[s.id];return sum+level*(level+1)/2;},0)-1;
  return 2 + state.bestStage - spent;
}
export function learnSkill(state,id) {
  gemGuard(state);
  const definition = SKILLS.find(s=>s.id===id);
  if (!definition) throw new Error('技能不存在');
  if (state.bestStage<definition.unlock) throw new Error(`通关主线第 ${definition.unlock} 关后解锁`);
  if (definition.prerequisite && state.skills[definition.prerequisite]<definition.required) throw new Error('请先提升前置技能');
  const level=state.skills[id];
  if (level>=3) throw new Error('技能已满级');
  if (skillPoints(state)<level+1) throw new Error(`技能点不足，需要 ${level+1} 点`);
  state.skills[id]++;
}
export function assignSkill(state,loadout,slot,id) {
  gemGuard(state);
  if (![0,1].includes(loadout) || !Number.isInteger(slot) || slot<0 || slot>2) throw new Error('技能栏无效');
  if (id!==null && (!SKILLS.some(s=>s.id===id) || !state.skills[id])) throw new Error('请先学习该技能');
  if (id!==null && state.skillLoadouts[loadout].some((value,index)=>value===id&&index!==slot)) throw new Error('同一方案不能重复装配技能');
  state.skillLoadouts[loadout][slot]=id;
}
export function activateLoadout(state,index) {
  gemGuard(state);
  if (![0,1].includes(index)) throw new Error('技能方案不存在');
  state.activeLoadout=index;
}
export function resetSkills(state) {
  gemGuard(state);
  if (skillPoints(state) === 2+state.bestStage) throw new Error('没有可返还的技能点');
  if (state.gold<100) throw new Error('重置需要 100 金币');
  state.gold-=100;state.skills=initialSkills();state.skillLoadouts=[['slash',null,null],['slash',null,null]];state.activeLoadout=0;
}
