import {
  SLOTS, SLOT_NAMES, RARITIES, newGame, restoreGame, heroStats,
  itemStats, equip, toggleLock, synthesize, enhance, battle,
} from './game-core.js';

const SAVE_KEY = 'starforge-prototype-v1';
const screen = document.querySelector('#screen');
const resourceBar = document.querySelector('#resource-bar');
const toastElement = document.querySelector('#toast');
let state = load();
let tab = 'adventure';
let selectedStage = state.stageUnlocked;
let selectedItem = null;
let selectedRarity = 'common';
let selectedMaterials = [];
let combat = null;
let combatIndex = 0;
let combatTimer = null;
let toastTimer = null;

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return restoreGame(JSON.parse(raw)) || newGame();
  } catch { /* 浏览器禁用存储时仍可试玩 */ }
  return newGame();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
  catch { toast('当前浏览器无法保存进度'); }
}

function toast(message) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 2700);
}

function rarityOf(item) { return RARITIES.find((r) => r.id === item.rarity) || RARITIES[0]; }
function itemColor(item) { return rarityOf(item).color; }
function iconFor(slot) { return ({weapon:'⚔',helmet:'♛',armor:'▣',boots:'◭',ring:'◉',amulet:'✥'})[slot]; }
function itemName(item) { return `${rarityOf(item).name}·${item.name}${item.level ? ` +${item.level}` : ''}`; }
function statLine(item) {
  const s = itemStats(item);
  return [s.attack ? `攻击 +${s.attack}` : null, s.health ? `生命 +${s.health}` : null, s.defense ? `防御 +${s.defense}` : null].filter(Boolean).join('  ·  ');
}

function renderResources() {
  resourceBar.innerHTML = `
    <div class="resource"><span>◈ 金币</span>${state.gold}</div>
    <div class="resource"><span>⌁ 铁矿</span>${state.ore}</div>
    <div class="resource"><span>ϟ 体力</span>${state.energy}</div>`;
}

function renderAdventure() {
  const h = heroStats(state);
  const heroRatio = combat ? Math.max(0, Math.round(combat.displayHp / combat.result.maxHeroHp * 100)) : 100;
  const enemyRatio = combat ? Math.max(0, Math.round(combat.enemyHp / combat.enemyMaxHp * 100)) : 100;
  const wave = combat ? combat.wave : 1;
  const lines = combat?.lines || [];
  const result = combat?.done ? combat.result : null;
  screen.innerHTML = `
    <div class="battle-scene">
      <div class="scene-top"><span class="stage-chip">第 ${selectedStage} 关 · 试炼场</span><span class="wave-chip">${combat ? `第 ${wave}/${combat.result.waveCount} 波` : '准备战斗'}</span></div>
      <img class="hero-art" src="./art/hero-sky-knight.png" alt="临时主角美术">
      <img class="enemy-art" src="./art/void-beast.png" alt="原创敌人：虚空兽">
      <div class="health-ui"><div class="health-unit">冒险者<div class="bar"><i style="width:${heroRatio}%"></i></div></div><div class="health-unit">怪物<div class="bar enemy"><i style="width:${enemyRatio}%"></i></div></div></div>
    </div>
    <section class="stage-panel panel">
      <div class="stage-picker"><button class="minor-button" data-action="stage-prev" ${selectedStage <= 1 || combat && !combat.done ? 'disabled' : ''}>‹</button><strong>主线挑战 ${selectedStage}/10</strong><button class="minor-button" data-action="stage-next" ${selectedStage >= state.stageUnlocked || combat && !combat.done ? 'disabled' : ''}>›</button></div>
      <div class="stats-row"><div class="stat">战斗力<b>${h.power}</b></div><div class="stat">攻击<b>${h.attack}</b></div><div class="stat">生命<b>${h.health}</b></div></div>
      <div class="action-row"><button class="primary-button" data-action="battle" ${combat && !combat.done || state.energy < 1 ? 'disabled' : ''}>${combat && !combat.done ? '战斗中…' : '开始挑战'}</button><button class="secondary-button" data-action="equipment">查看装备</button></div>
      <p class="hint">胜利可获得 2 件装备、金币和铁矿。积累 5 件同品质装备即可合成。</p>
    </section>
    ${result ? `<div class="result-box"><strong>${result.won ? '✦ 挑战成功' : '✧ 挑战失败'}</strong><br>金币 +${result.rewards.gold} · 铁矿 +${result.rewards.ore}${result.rewards.items.length ? `<br>掉落：${result.rewards.items.map(itemName).join('、')}` : ''}</div>` : ''}
    <section class="battle-log panel">${lines.length ? lines.slice(-6).map((line) => `<div>${line}</div>`).join('') : '准备好后点击「开始挑战」。战斗将自动进行。'}</section>`;
}

function itemCard(item, selected = false, extra = '') {
  return `<button class="item-card ${selected ? 'selected' : ''}" data-item="${item.id}" style="border-color:${itemColor(item)}"><span class="item-symbol" style="color:${itemColor(item)}">${iconFor(item.slot)}</span>${item.locked ? '<span class="lock-mark">🔒</span>' : ''}<b>${item.name}${item.level ? ` +${item.level}` : ''}</b><small>${rarityOf(item).name} · ${SLOT_NAMES[item.slot]}${extra}</small></button>`;
}

function renderEquipment() {
  const h = heroStats(state);
  const chosen = state.bag.find((item) => item.id === selectedItem);
  const equippedChosen = SLOTS.find((slot) => state.equipped[slot]?.id === selectedItem);
  const active = chosen || (equippedChosen ? state.equipped[equippedChosen] : null);
  screen.innerHTML = `
    <h2 class="section-title">装备与背包 <small>战斗力 ${h.power}</small></h2>
    <div class="equipment-layout">${SLOTS.map((slot) => {
      const item = state.equipped[slot];
      return `<button class="equip-slot ${item ? 'filled' : ''}" data-equipped="${slot}"><small>${SLOT_NAMES[slot]}</small>${item ? `<b style="color:${itemColor(item)}">${item.name}</b><em>+${item.level} · ${rarityOf(item).name}</em>` : '空位'}</button>`;
    }).join('')}</div>
    <section class="bag-panel panel"><h2 class="section-title">背包 <small>${state.bag.length}/100</small></h2>${state.bag.length ? `<div class="bag-grid">${state.bag.map((item) => itemCard(item, item.id === selectedItem)).join('')}</div>` : '<div class="empty">背包还是空的，去挑战关卡获取装备</div>'}</section>
    ${active ? `<section class="item-detail panel"><b style="color:${itemColor(active)}">${itemName(active)}</b><br>${statLine(active)}${active.affix ? `<br>附加词条：${active.affix}` : ''}${equippedChosen ? `<br><span class="muted">强化消耗：铁矿 ${10 * (active.level + 1)}、金币 ${30 * (active.level + 1)}</span>` : ''}<div class="detail-actions">${chosen ? `<button class="secondary-button" data-action="equip">穿戴</button><button class="minor-button" data-action="lock">${active.locked ? '解锁' : '锁定'}</button>` : `<button class="primary-button" data-action="enhance" ${active.level >= 10 ? 'disabled' : ''}>强化 +1</button>`}</div></section>` : ''}
    <section class="history panel"><b>最近获得</b>${state.history.length ? state.history.slice(0, 5).map((line) => `<div>${line}</div>`).join('') : '<div>开始冒险，收集第一批装备。</div>'}</section>`;
}

function renderSynthesis() {
  const candidates = state.bag.filter((item) => item.rarity === selectedRarity);
  const rank = RARITIES.findIndex((rarity) => rarity.id === selectedRarity);
  const cost = 40 * (rank + 1);
  screen.innerHTML = `
    <h2 class="section-title">装备合成 <small>五件升一阶</small></h2>
    <div class="synthesis-rules panel">选择 <strong>5 件同品质</strong>的背包装备，合成 1 件更高品质装备。若 5 件都属同一部位，产物也会保留该部位。已穿戴、已锁定的装备不会被消耗。</div>
    <div class="panel" style="padding:13px"><div class="forge-slots">${Array.from({length:5},(_,index)=>`<div class="forge-slot ${selectedMaterials[index] ? 'filled' : ''}">${selectedMaterials[index] ? '✦' : '+'}</div>`).join('')}</div><div class="forge-arrow">↓</div><div class="result-preview">${rank >= RARITIES.length - 1 ? '传说品质已达到上限' : `可能获得 <b style="color:${RARITIES[rank+1].color}">${RARITIES[rank+1].name}装备</b>`}<br><span class="muted">消耗金币 ${cost}</span></div><div class="action-row"><button class="minor-button" data-action="auto-select">自动选择</button><button class="primary-button" data-action="synthesize" ${selectedMaterials.length !== 5 || rank >= RARITIES.length-1 ? 'disabled' : ''}>合成装备</button></div></div>
    <h2 class="section-title" style="margin-top:14px">选择材料 <small>${selectedMaterials.length}/5</small></h2>
    <div class="filter-row">${RARITIES.slice(0,-1).map((r)=>`<button data-rarity="${r.id}" class="${r.id===selectedRarity?'active':''}">${r.name} ${state.bag.filter((item)=>item.rarity===r.id).length}</button>`).join('')}</div>
    ${candidates.length ? `<div class="bag-grid">${candidates.map((item)=>itemCard(item, selectedMaterials.includes(item.id))).join('')}</div>` : '<div class="empty panel">该品质暂时没有装备；先去冒险获取掉落。</div>'}
    <p class="hint">点击装备选择或取消材料。首轮合成通常在通关约 3 关后可以尝试。</p>`;
}

function render() {
  renderResources();
  if (tab === 'adventure') renderAdventure();
  else if (tab === 'equipment') renderEquipment();
  else renderSynthesis();
  document.querySelectorAll('.bottom-nav button').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
}

function runCombat() {
  if (combatTimer) clearInterval(combatTimer);
  const result = battle(state, selectedStage);
  save();
  combat = { result, wave: 1, displayHp: result.maxHeroHp, enemyHp: 1, enemyMaxHp: 1, lines: ['战斗开始，冒险者冲向怪物！'], done: false };
  combatIndex = 0;
  render();
  combatTimer = setInterval(() => {
    const event = result.events[combatIndex++];
    if (!event) {
      clearInterval(combatTimer); combatTimer = null; combat.done = true;
      combat.lines.push(result.won ? '✦ 敌人全部击败，关卡通过！' : '✧ 骑士力竭，先提升装备再来。');
      if (result.won) selectedStage = Math.min(10, selectedStage + 1);
      render(); return;
    }
    if (event.type === 'wave') {
      combat.wave = event.wave; combat.enemyMaxHp = event.maxHp; combat.enemyHp = event.maxHp;
      combat.lines.push(`第 ${event.wave} 波敌人出现`);
    } else if (event.type === 'hero') {
      combat.enemyHp = event.enemyHp;
      combat.lines.push(`${event.skill ? '✦ 强力突刺' : '普通攻击'}，造成 ${event.damage} 伤害`);
    } else {
      combat.displayHp = event.heroHp;
      combat.lines.push(`虚空兽反击，受到 ${event.damage} 伤害`);
    }
    render();
  }, 230);
}

screen.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target || target.disabled) return;
  try {
    if (target.dataset.rarity) {
      selectedRarity = target.dataset.rarity; selectedMaterials = []; render(); return;
    }
    if (target.dataset.item) {
      const id = target.dataset.item;
      if (tab === 'synthesis') {
        const item = state.bag.find((entry) => entry.id === id);
        if (item.locked) { toast('先在装备页解锁这件装备'); return; }
        selectedMaterials = selectedMaterials.includes(id)
          ? selectedMaterials.filter((value) => value !== id)
          : selectedMaterials.length < 5 ? [...selectedMaterials, id] : selectedMaterials;
      } else selectedItem = id;
      render(); return;
    }
    if (target.dataset.equipped) { selectedItem = state.equipped[target.dataset.equipped]?.id || null; render(); return; }
    switch (target.dataset.action) {
      case 'stage-prev': selectedStage = Math.max(1, selectedStage - 1); combat = null; break;
      case 'stage-next': selectedStage = Math.min(state.stageUnlocked, selectedStage + 1); combat = null; break;
      case 'battle': runCombat(); return;
      case 'equipment': tab = 'equipment'; break;
      case 'equip': equip(state, selectedItem); toast('装备已穿戴，战斗属性已更新'); save(); break;
      case 'lock': toggleLock(state, selectedItem); save(); break;
      case 'enhance': {
        const slot = SLOTS.find((value) => state.equipped[value]?.id === selectedItem);
        enhance(state, slot); toast('强化成功！'); save(); break;
      }
      case 'auto-select': selectedMaterials = state.bag.filter((item) => item.rarity === selectedRarity && !item.locked).slice(0,5).map((item)=>item.id); break;
      case 'synthesize': {
        const result = synthesize(state, selectedMaterials);
        selectedMaterials = []; selectedItem = result.id; tab = 'equipment';
        toast(`合成成功：${itemName(result)}`); save(); break;
      }
    }
    render();
  } catch (error) { toast(error.message || '操作未完成'); }
});

document.querySelectorAll('.bottom-nav button').forEach((button) => button.addEventListener('click', () => {
  tab = button.dataset.tab; selectedItem = null; render();
}));
document.querySelector('#reset-button').addEventListener('click', () => {
  if (!window.confirm('确定重新开始？当前试玩存档会清空。')) return;
  if (combatTimer) clearInterval(combatTimer);
  localStorage.removeItem(SAVE_KEY); state = newGame(); tab = 'adventure';
  selectedStage = 1; selectedItem = null; selectedMaterials = []; combat = null; render();
});

render();
