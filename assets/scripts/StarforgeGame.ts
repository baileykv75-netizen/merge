import {
  _decorator, Component, Node, UITransform, Graphics, Label, Color,
  Sprite, SpriteFrame, resources, Layers, Vec3, sys, isValid, Camera, tween,
} from 'cc';
import {
  SLOTS, SLOT_NAMES, RARITIES, newGame, restoreGame, heroStats,
  itemStats, equip, toggleLock, synthesize, enhance, startEncounter, advanceEncounter, closeEncounter, encounterView,
  syncTime, idleReward, claimIdle, TALENTS, talentCost, upgradeTalent, DAILY_TASKS, claimDaily, salvage,
  findItem, baseRange, forgeQuote, rollForge, resolveForge, compareItem, transferQuote, transferEnhancement,
  DUNGEONS, DIFFICULTIES, dungeonInfo, startDungeon, sweepDungeon,
  GEM_TYPES, gemTotal, mergeGems, drillSocket, mountGem, unmountGem,
} from './core/game-core';

const { ccclass } = _decorator;
const SAVE_KEY = 'starforge-prototype-v1';
const C = {
  bg: new Color(12, 18, 34), panel: new Color(29, 39, 63),
  panelLight: new Color(39, 53, 82), line: new Color(79, 97, 132),
  ink: new Color(246, 242, 224), muted: new Color(172, 187, 207),
  gold: new Color(245, 196, 117), cyan: new Color(111, 227, 232),
  green: new Color(105, 223, 174), red: new Color(255, 129, 133),
};

/** 把与网页试玩共用的规则呈现在 Cocos 画布上。挂到 420×840 的 Canvas 节点。 */
@ccclass('StarforgeGame')
export class StarforgeGame extends Component {
  private game: any = null;
  private tab: 'adventure' | 'equipment' | 'synthesis' | 'camp' = 'adventure';
  private stage = 1;
  private selectedItem: string | null = null;
  private selectedRarity = 'common';
  private materials: string[] = [];
  private bagPage = 0;
  private status = '点击挑战，获得装备并开始合成。';
  private frames: Record<string, SpriteFrame> = {};
  private combatClock = 0;
  private combatSpeed = 1;
  private forgeOpen = false;
  private dungeonOpen = false;
  private dungeonId = 'gold';
  private dungeonDifficulty = 0;
  private gemsOpen = false;
  private gemType = 'ruby';
  private gemTier = 1;
  private gemItemId: string | null = null;
  private gemSocket = 0;

  update(dt: number) {
    const fight = this.game?.encounter;
    if (!fight || fight.cursor >= fight.result.events.length) return;
    this.combatClock += dt * this.combatSpeed;
    if (this.combatClock < 0.45) return;
    this.combatClock = 0;
    advanceEncounter(this.game);
    this.save();
    if (this.tab === 'adventure') this.render();
  }

  private switchTab(tab: 'adventure' | 'equipment' | 'synthesis' | 'camp') {
    if (this.game.pendingForge) { this.tab = 'equipment'; this.forgeOpen = true; this.render(); return; }
    if (this.game.encounter) {
      const view = encounterView(this.game);
      if (!view.done) return;
      closeEncounter(this.game); this.save();
    }
    this.tab = tab; this.bagPage = 0; this.forgeOpen = false; this.dungeonOpen = false; this.gemsOpen = false;
    syncTime(this.game); this.render();
  }

  onLoad() {
    try {
      this.game = restoreGame(JSON.parse(sys.localStorage.getItem(SAVE_KEY) || 'null')) || newGame();
    } catch { this.game = newGame(); }
    this.stage = this.game.encounter?.result.stage || this.game.stageUnlocked;
    if (this.game.encounter?.result.kind === 'dungeon') {
      this.dungeonId = this.game.encounter.result.dungeonId;
      this.dungeonDifficulty = this.game.encounter.result.difficulty;
      this.stage = this.game.stageUnlocked;
    }
    if (this.game.pendingForge) { this.tab = 'equipment'; this.forgeOpen = true; this.selectedItem = this.game.pendingForge.itemId; }
    syncTime(this.game);
    this.save();
    this.schedule(() => { syncTime(this.game); this.save(); this.render(); }, 30);
    this.render();
    for (const name of ['hero-sky-knight', 'void-beast', 'battle-observatory']) {
      resources.load(`art/${name}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (error || !frame || !isValid(this.node)) return;
        this.frames[name] = frame;
        this.render();
      });
    }
  }

  private save() {
    try { sys.localStorage.setItem(SAVE_KEY, JSON.stringify(this.game)); }
    catch { this.status = '当前设备无法保存进度'; }
  }

  private box(parent: Node, name: string, x: number, y: number, w: number, h: number,
    fill: Color, outline?: Color): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.setPosition(new Vec3(x, y));
    node.addComponent(UITransform).setContentSize(w, h);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = fill;
    graphics.roundRect(-w / 2, -h / 2, w, h, 12);
    graphics.fill();
    if (outline) {
      graphics.strokeColor = outline;
      graphics.lineWidth = 1;
      graphics.roundRect(-w / 2, -h / 2, w, h, 12);
      graphics.stroke();
    }
    return node;
  }

  private text(parent: Node, value: string, x: number, y: number, w: number, h: number,
    size = 16, color = C.ink): Node {
    const node = new Node('Text');
    node.layer = Layers.Enum.UI_2D;
    parent.addChild(node);
    node.setPosition(new Vec3(x, y));
    node.addComponent(UITransform).setContentSize(w, h);
    const label = node.addComponent(Label);
    label.string = value;
    label.fontSize = size;
    label.lineHeight = size + 5;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return node;
  }

  private button(value: string, x: number, y: number, w: number, h: number,
    callback: () => void, prominent = false): Node {
    const node = this.box(this.node, `Button-${value}`, x, y, w, h,
      prominent ? C.gold : C.panelLight, prominent ? C.gold : C.line);
    this.text(node, value, 0, 0, w - 8, h - 4, 15, prominent ? C.bg : C.ink);
    node.on(Node.EventType.TOUCH_END, callback, this);
    return node;
  }

  private picture(name: string, x: number, y: number, w: number, h: number) {
    const frame = this.frames[name];
    if (!frame) return;
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    this.node.addChild(node);
    node.setPosition(new Vec3(x, y));
    node.addComponent(UITransform).setContentSize(w, h);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    node.getComponent(UITransform)!.setContentSize(w, h);
    return node;
  }

  private action(operation: () => void) {
    try { operation(); this.save(); }
    catch (error: any) { this.status = error?.message || '操作失败'; }
    this.render();
  }

  private render() {
    for (const child of [...this.node.children]) {
      if (!child.getComponent(Camera)) child.destroy();
    }
    this.box(this.node, 'Backdrop', 0, 0, 420, 840, C.bg);
    this.box(this.node, 'Header', 0, 375, 420, 85, C.panel, C.line);
    this.text(this.node, '装备合成原型', -85, 385, 230, 40, 24, C.gold);
    this.text(this.node, `◈ ${this.game.gold}    ⌁ ${this.game.ore}    ϟ ${this.game.energy}`,
      10, 343, 390, 26, 14, C.muted);
    if (this.tab === 'adventure') this.renderAdventure();
    if (this.tab === 'equipment') this.renderEquipment();
    if (this.tab === 'synthesis') this.renderSynthesis();
    if (this.tab === 'camp') this.renderCamp();
    this.box(this.node, 'Nav', 0, -365, 420, 72, C.panel, C.line);
    this.button('冒险', -153, -365, 94, 46, () => this.switchTab('adventure'), this.tab === 'adventure');
    this.button('装备', -51, -365, 94, 46, () => this.switchTab('equipment'), this.tab === 'equipment');
    this.button('合成', 51, -365, 94, 46, () => this.switchTab('synthesis'), this.tab === 'synthesis');
    this.button('营地', 153, -365, 94, 46, () => this.switchTab('camp'), this.tab === 'camp');
  }

  private renderAdventure() {
    if (this.dungeonOpen && !this.game.encounter) { this.renderDungeon(); return; }
    const h = heroStats(this.game);
    const fight = encounterView(this.game);
    const dungeon = fight?.result.kind === 'dungeon' ? DUNGEONS.find(d => d.id === fight.result.dungeonId) : null;
    const running = fight && !fight.done;
    this.box(this.node, 'Battle', 0, 95, 396, 378, C.panel, C.line);
    this.picture('battle-observatory', 0, 95, 394, 375);
    const hero = this.picture('hero-sky-knight', -92, 52, 178, 250);
    const enemy = this.picture('void-beast', 100, 80, 164, 174);
    this.text(this.node, `${dungeon ? dungeon.name : `第 ${this.stage} 关`} · ${fight ? `第 ${fight.wave}/${fight.result.waveCount} 波` : '试炼场'}`, 0, 249, 360, 35, 21, C.gold);
    const event = fight?.last;
    if (running && event && ['hero', 'enemy'].includes(event.type)) {
      const actor = event.type === 'hero' ? hero : enemy;
      if (actor) {
        const origin = actor.position.clone();
        tween(actor).to(0.09, {position: new Vec3(origin.x + (event.type === 'hero' ? 24 : -24), origin.y)})
          .to(0.12, {position: origin}).start();
      }
      this.text(this.node, `${event.critical ? '暴击 ' : ''}-${event.damage}`, event.type === 'hero' ? 100 : -92, 178, 180, 44, 26, event.critical ? C.gold : C.red);
    }
    if (running && event?.type === 'heal') this.text(this.node, `+${event.amount}`, -92, 178, 150, 40, 24, C.green);
    if (running && event?.type === 'enemyHeal') this.text(this.node, `+${event.amount}`, 100, 178, 150, 40, 24, C.green);
    this.healthBar(-100, -48, fight?.heroHp ?? h.health, fight?.result.maxHeroHp ?? h.health, C.green);
    this.healthBar(100, -48, fight?.enemyHp ?? 1, fight?.enemyMaxHp ?? 1, C.red);
    const notice = !fight ? `战力 ${h.power} · 攻击 ${h.attack} · 生命 ${h.health}` : fight.done ?
      (fight.result.won ? '挑战成功！战利品已放入背包' : '挑战失败 · 强化装备后再来') :
      event?.type === 'hero' ? `${event.skill ? '强力突刺' : '普通攻击'}：${event.damage} 伤害` :
      event?.type === 'enemy' ? `敌人${event.ability || '反击'}：${event.damage} 伤害` : event?.type === 'heal' ? `装备恢复 ${event.amount} 生命` : event?.type === 'enemyHeal' ? `敌人恢复 ${event.amount} 生命` : '敌人出现，准备战斗';
    this.text(this.node, notice, 0, -83, 380, 30, 14, fight?.done ? C.gold : C.ink);
    if (fight) {
      this.text(this.node, running ? `强力突刺：${3 - fight.attacks % 3} 次攻击后释放 · 自动战斗中` :
        (fight.result.rewards.gems?.length ? fight.result.rewards.gems.map((g: any) => `${GEM_TYPES.find(t=>t.id===g.type)?.name} Lv.${g.tier} ×${g.count}`).join('、') : `金币 +${fight.result.rewards.gold} · 铁矿 +${fight.result.rewards.ore} · 装备 +${fight.result.rewards.items.length}\n重铸石 +${fight.result.rewards.shards || 0} · 洗练尘 +${fight.result.rewards.dust || 0}`),
        0, -135, 390, 42, 14, C.muted);
      if (running) {
        this.button(`战斗速度 ×${this.combatSpeed}`, 0, -198, 250, 50, () => { this.combatSpeed = this.combatSpeed === 1 ? 2 : 1; this.render(); });
      } else {
        this.button(dungeon ? '返回副本' : fight.result.won ? '继续冒险' : '再次挑战', -93, -198, 175, 50, () => this.action(() => {
          const won = fight.result.won; closeEncounter(this.game);
          if (dungeon) { this.dungeonOpen = true; return; }
          if (won) this.stage = Math.min(10, this.stage + 1);
          else { startEncounter(this.game, this.stage); this.combatClock = 0; }
        }), true);
        this.button('查看装备', 102, -198, 175, 50, () => this.switchTab('equipment'));
      }
      this.text(this.node, running ? (dungeon?.mechanic || '战斗中断后会保留进度，重新进入即可继续。') : dungeon ?
        (fight.result.won ? '已解锁本难度扫荡。挑战和扫荡共享每日次数。' : '本次已消耗次数和体力，提升装备后再挑战。') :
        fight.result.rewards.items.map((item: any) => item.name).join('、') || '背包已满时，多余战利品自动转为铁矿。',
        0, -269, 380, 60, 14, C.muted);
      return;
    }
    this.button('‹', -115, -125, 50, 42, () => {
      this.stage = Math.max(1, this.stage - 1); this.render();
    });
    this.text(this.node, `已解锁 ${this.game.stageUnlocked}/10`, 0, -125, 150, 40, 15);
    this.button('›', 115, -125, 50, 42, () => {
      this.stage = Math.min(this.game.stageUnlocked, this.stage + 1); this.render();
    });
    this.button('开始挑战', 0, -194, 250, 55, () => this.action(() => {
      startEncounter(this.game, this.stage); this.combatClock = 0;
    }), true);
    this.button('材料副本', 0, -263, 250, 44, () => { this.dungeonOpen = true; this.render(); });
    this.text(this.node, this.status, 0, -309, 380, 32, 12, C.muted);
  }

  private renderDungeon() {
    const info = dungeonInfo(this.game,this.dungeonId,this.dungeonDifficulty);
    this.text(this.node, '材料副本', 0, 292, 380, 40, 22, C.gold);
    DUNGEONS.forEach((d,i) => this.button(d.resource,-152+i*76,238,70,40,()=>{
      this.dungeonId=d.id; this.dungeonDifficulty=0; this.status=d.mechanic; this.render();
    },d.id===this.dungeonId));
    DIFFICULTIES.forEach((name,i) => this.button(name,-126+i*126,183,116,40,()=>{
      this.dungeonDifficulty=i; this.render();
    },i===this.dungeonDifficulty));
    this.text(this.node, `${info.name} · ${DIFFICULTIES[this.dungeonDifficulty]}\n${info.mechanic}`, 0, 122, 390, 65, 16, C.ink);
    this.text(this.node, `拥有：${info.id === 'gems' ? gemTotal(this.game) : this.game[info.id]} ${info.resource}\n主线第 ${info.requiredStage} 关通关后开放${info.previousCleared ? '' : '，还需通关上一难度'}`, 0, 53, 390, 55, 14, C.muted);
    this.text(this.node, `胜利奖励：${info.resource} ×${info.reward}`, 0, -5, 390, 38, 22, C.gold);
    this.text(this.node, `今日剩余 ${info.remaining}/3 次 · 每次消耗 2 体力`, 0, -49, 390, 35, 15);
    this.button('开始挑战', 0, -105, 300, 48, () => this.action(()=>{
      startDungeon(this.game,this.dungeonId,this.dungeonDifficulty); this.dungeonOpen=false; this.combatClock=0;
    }),true);
    this.button(info.canSweep ? '扫荡一次' : '首次通关后解锁扫荡', 0, -164, 300, 44, () => this.action(()=>{
      const r=sweepDungeon(this.game,this.dungeonId,this.dungeonDifficulty);
      this.status=info.id === 'gems' ? `扫荡获得 ${GEM_TYPES.find(t=>t.id===r.gems[0].type)?.name} ×${r.gems[0].count}` : `扫荡完成：${info.resource} +${r[info.id]}`;
    }));
    this.text(this.node, '各类副本独立计次，同类所有难度共享次数。\n失败也消耗次数。每天 00:00 刷新。', 0, -225, 390, 58, 13, C.muted);
    this.button('返回主线', 0, -282, 220, 38, () => {this.dungeonOpen=false;this.render();});
    this.text(this.node, this.status, 0, -316, 390, 27, 12, C.muted);
  }

  private healthBar(x: number, y: number, hp: number, max: number, color: Color) {
    this.box(this.node, 'HealthTrack', x, y, 172, 13, C.bg, C.line);
    const width = 168 * Math.max(0, Math.min(1, hp / Math.max(1, max)));
    if (width > 1) this.box(this.node, 'HealthFill', x - 84 + width / 2, y, width, 9, color);
    this.text(this.node, `${hp} / ${max}`, x, y + 20, 172, 24, 12);
  }

  private renderEquipment() {
    if (this.gemsOpen) { this.renderGems(); return; }
    if (this.forgeOpen && findItem(this.game, this.selectedItem)) { this.renderForge(); return; }
    this.text(this.node, `装备栏 · 战力 ${heroStats(this.game).power}`, -60, 293, 260, 30, 19, C.gold);
    this.button('宝石', 145, 293, 100, 38, () => {
      this.gemItemId = this.selectedItem || this.game.equipped.weapon?.id || null;
      this.gemSocket = 0; this.gemsOpen = true; this.render();
    });
    SLOTS.forEach((slot: string, index: number) => {
      const item = this.game.equipped[slot];
      const x = -130 + (index % 3) * 130;
      const y = 223 - Math.floor(index / 3) * 72;
      this.button(`${SLOT_NAMES[slot]}\n${item ? `${item.name} +${item.level}` : '空位'}`,
        x, y, 120, 62, () => { this.selectedItem = item?.id || null; this.render(); });
    });
    this.text(this.node, `背包 ${this.game.bag.length}/100`, 0, 91, 340, 29, 18, C.gold);
    const page = this.game.bag.slice(this.bagPage * 9, this.bagPage * 9 + 9);
    page.forEach((item: any, index: number) => {
      const x = -130 + (index % 3) * 130;
      const y = 38 - Math.floor(index / 3) * 58;
      this.button(`${item.locked ? '🔒' : ''}${item.name}\n${RARITIES.find(r => r.id === item.rarity)?.name}`,
        x, y, 121, 52, () => { this.selectedItem = item.id; this.render(); });
    });
    this.button('‹', -140, -150, 44, 32, () => { this.bagPage = Math.max(0, this.bagPage - 1); this.render(); });
    this.text(this.node, `${this.bagPage + 1} / ${Math.max(1, Math.ceil(this.game.bag.length / 9))}`,
      0, -150, 100, 30, 13, C.muted);
    this.button('›', 140, -150, 44, 32, () => {
      this.bagPage = Math.min(Math.max(0, Math.ceil(this.game.bag.length / 9) - 1), this.bagPage + 1);
      this.render();
    });
    const bagItem = this.game.bag.find((item: any) => item.id === this.selectedItem);
    const equippedSlot = SLOTS.find((slot: string) => this.game.equipped[slot]?.id === this.selectedItem);
    const item = bagItem || (equippedSlot ? this.game.equipped[equippedSlot] : null);
    if (item) {
      const s = itemStats(item);
      this.text(this.node, `${item.name} +${item.level}  ·  攻 ${s.attack} / 生 ${s.health} / 防 ${s.defense}`,
        0, -196, 390, 35, 13, C.ink);
      if (bagItem) {
        const delta = compareItem(this.game, item);
        const signed = (n: number) => n > 0 ? `+${n}` : `${n}`;
        this.text(this.node, `换装：攻击 ${signed(delta.attack)} · 生命 ${signed(delta.health)} · 防御 ${signed(delta.defense)}`,
          0, -219, 390, 24, 12, delta.power >= 0 ? C.green : C.red);
      }
      if (bagItem) {
        this.button('穿戴', -130, -246, 120, 42, () => this.action(() => {
          equip(this.game, bagItem.id); this.status = '穿戴成功';
        }), true);
        this.button(item.locked ? '解锁' : '锁定', 0, -246, 120, 42, () => this.action(() => {
          toggleLock(this.game, bagItem.id);
        }));
        this.button('详情 / 锻造', 130, -246, 120, 42, () => { this.forgeOpen = true; this.render(); });
      } else {
        this.button('强化 +1', -100, -246, 180, 42, () => this.action(() => {
          enhance(this.game, equippedSlot!); this.status = `${item.name} 强化成功`;
        }), true);
        this.button('详情 / 锻造', 100, -246, 180, 42, () => { this.forgeOpen = true; this.render(); });
      }
    }
    this.text(this.node, this.status, 0, -303, 385, 40, 13, C.muted);
  }

  private renderGems() {
    const type = GEM_TYPES.find(g=>g.id===this.gemType)!;
    const item = findItem(this.game,this.gemItemId);
    this.text(this.node, '宝石工坊', 0, 294, 390, 40, 23, C.gold);
    GEM_TYPES.forEach((g,i)=>this.button(g.name,-126+i*126,243,116,40,()=>{this.gemType=g.id;this.render();},g.id===this.gemType));
    for (let tier=1;tier<=5;tier++) this.button(`Lv.${tier}\n×${this.game.gems[`${this.gemType}:${tier}`]}`,-152+(tier-1)*76,190,70,48,()=>{this.gemTier=tier;this.render();},tier===this.gemTier);
    this.text(this.node, `${type.name} Lv.${this.gemTier}：${type.label} +${type.base*2**(this.gemTier-1)}\n可镶嵌：${type.slots.map(s=>SLOT_NAMES[s]).join('、')}`,0,137,390,48,14,C.cyan);
    this.button(this.gemTier===5 ? '已达最高等级' : `五合一升级 · ${this.gemTier*30} 金币`,0,85,330,40,()=>this.action(()=>{
      const gem=mergeGems(this.game,this.gemType,this.gemTier);this.gemTier=gem.tier;this.status=`获得 ${type.name} Lv.${gem.tier}`;
    }),true);
    this.text(this.node, item ? `当前装备：${item.name} +${item.level}` : '选择已穿戴装备；也可在背包选中装备后进入此页',0,40,390,32,14);
    SLOTS.forEach((slot,i)=>this.button(SLOT_NAMES[slot],-126+(i%3)*126,-2-Math.floor(i/3)*44,116,36,()=>{
      this.gemItemId=this.game.equipped[slot]?.id || null;this.gemSocket=0;this.render();
    },item?.slot===slot));
    for(let i=0;i<2;i++) {
      const gem=item?.sockets[i];
      const label=!item ? '未选择装备' : i>=item.sockets.length ? `孔 ${i+1} · 未开启` : gem ? `${GEM_TYPES.find(g=>g.id===gem.type)?.name} Lv.${gem.tier}` : `孔 ${i+1} · 空`;
      this.button(label,-98+i*196,-104,184,42,()=>{this.gemSocket=i;this.render();},i===this.gemSocket);
    }
    this.button('镶嵌所选宝石',-98,-158,184,42,()=>this.action(()=>{
      mountGem(this.game,this.gemItemId,this.gemSocket,this.gemType,this.gemTier);this.status='镶嵌成功，穿戴后属性生效';
    }),true);
    this.button('免费卸下宝石',98,-158,184,42,()=>this.action(()=>{
      unmountGem(this.game,this.gemItemId,this.gemSocket);this.status='宝石已完整放回库存';
    }));
    this.button('开启第二孔 · 200 金币 + 60 铁矿',0,-211,380,42,()=>this.action(()=>{
      drillSocket(this.game,this.gemItemId);this.gemSocket=1;this.status='第二孔已开启';
    }));
    this.button('返回装备',0,-264,220,38,()=>{this.gemsOpen=false;this.render();});
    this.text(this.node,this.status,0,-308,390,40,12,C.muted);
  }

  private renderForge() {
    const item = findItem(this.game, this.selectedItem);
    if (!item) return;
    const stats = itemStats(item), range = baseRange(item);
    const line = (s: any) => `攻击 ${s.attack} · 生命 ${s.health} · 防御 ${s.defense}`;
    this.text(this.node, `${item.name} +${item.level} · 锻造台`, 0, 290, 390, 40, 21, C.gold);
    this.text(this.node, `${RARITIES.find(r => r.id === item.rarity)?.name} · ${SLOT_NAMES[item.slot]}${item.locked ? ' · 已锁定' : ''}\n${line(stats)}`, 0, 238, 390, 60, 15);
    this.text(this.node, `未强化基础范围\n攻击 ${range.min.attack}–${range.max.attack} · 生命 ${range.min.health}–${range.max.health} · 防御 ${range.min.defense}–${range.max.defense}`, 0, 179, 390, 52, 13, C.muted);
    const affix = item.affix === '暴击' ? '暴击概率 +4%' : item.affix === '生命恢复' ? '每次受击存活后恢复 2 生命' : item.affix === '元素抗性' ? '元素波次伤害减少 5%' : '无词条（精良以上装备拥有词条）';
    this.text(this.node, affix, 0, 133, 390, 30, 14, C.cyan);
    this.text(this.node, `重铸石 ${this.game.shards} · 洗练尘 ${this.game.dust}\n重铸石：第 3 关起掉落；洗练尘：第 5 关起掉落`, 0, 89, 390, 50, 13, C.muted);
    const pending = this.game.pendingForge;
    if (pending) {
      this.text(this.node, pending.kind === 'reforge' ? `原基础：${line(item)}\n新基础：${line(pending.stats)}` : `原词条：${item.affix}\n新词条：${pending.affix}`, 0, -5, 390, 100, 16);
      this.text(this.node, '材料已消耗。本次选择不再扣费。\n保留旧属性不会返还材料。', 0, -92, 380, 55, 14, C.muted);
      this.button('保留旧属性', -98, -164, 180, 50, () => this.action(() => { resolveForge(this.game, false); this.status = '已保留原属性'; }));
      this.button('采用新属性', 98, -164, 180, 50, () => this.action(() => { resolveForge(this.game, true); this.status = '新属性已生效'; }), true);
    } else {
      const reforge = forgeQuote(item, 'reforge'), wash = forgeQuote(item, 'wash');
      this.button(`重铸基础 · ${reforge.gold} 金币 + ${reforge.amount} 重铸石`, 0, 24, 380, 44,
        () => this.action(() => { rollForge(this.game, item.id, 'reforge'); this.status = '比较属性后选择是否采用'; }));
      this.button(`洗练词条 · ${wash.gold} 金币 + ${wash.amount} 洗练尘`, 0, -30, 380, 44,
        () => this.action(() => { rollForge(this.game, item.id, 'wash'); this.status = '选择保留或采用新词条'; }));
      if (this.game.bag.some((x: any) => x.id === item.id)) {
        let quote: any;
        try { quote = transferQuote(this.game, item.id); } catch {}
        this.button(quote ? `继承已穿戴装备 +${quote.source.level} · ${quote.gold} 金币\n原装备变为 +${item.level}，两件装备均保留` : '强化继承：需穿戴同部位且强化更高的装备', 0, -96, 380, 62,
          () => this.action(() => { transferEnhancement(this.game, item.id); this.status = '强化等级已交换，新装备可穿戴'; }));
        const refund = 5 * (RARITIES.findIndex(r => r.id === item.rarity) + 1) + item.level * 3;
        this.button(`分解此装备 → ${refund} 铁矿（消耗装备）`, 0, -163, 380, 44, () => this.action(() => {
          const ore = salvage(this.game, [item.id]); this.forgeOpen = false; this.selectedItem = null; this.bagPage = 0; this.status = `分解获得 ${ore} 铁矿`;
        }));
      } else {
        this.button(`强化 +1 · ${30*(item.level+1)} 金币 + ${10*(item.level+1)} 铁矿`, 0, -96, 380, 44,
          () => this.action(() => { enhance(this.game,item.slot); this.status = '强化成功'; }), true);
      }
      this.button('返回装备', 0, -227, 220, 42, () => { this.forgeOpen = false; this.render(); });
    }
    this.text(this.node, this.status, 0, -292, 385, 50, 13, C.muted);
  }

  private renderCamp() {
    const reward = idleReward(this.game);
    this.text(this.node, '营地 · 补给与训练', 0, 292, 390, 34, 21, C.gold);
    this.text(this.node, '体力每 5 分钟恢复 1 点，上限 30\n离线收益最多积累 8 小时', 0, 245, 390, 52, 14, C.muted);
    this.button(`领取收益：${reward.gold} 金币 / ${reward.ore} 铁矿`, 0, 191, 380, 42,
      () => this.action(() => { const r = claimIdle(this.game); this.status = `已领取 ${r.gold} 金币、${r.ore} 铁矿`; }), true);
    TALENTS.forEach((t, i) => {
      const level = this.game.talents[t.id];
      this.button(`${t.name} ${level}/${t.max} · ${t.description} · ${talentCost(this.game, t.id)} 金币`, 0, 128 - i * 53, 380, 45,
        () => this.action(() => { upgradeTalent(this.game, t.id); this.status = `${t.name}升级成功`; }));
    });
    this.text(this.node, '每日委托 · 每天 00:00 刷新', 0, -31, 380, 30, 17, C.gold);
    DAILY_TASKS.forEach((t, i) => {
      const claimed = this.game.daily.claimed.includes(t.id);
      this.button(`${t.name} ${Math.min(t.target, this.game.daily[t.id])}/${t.target}\n${claimed ? '已领取' : `${t.gold} 金币 + ${t.ore} 铁矿`}`, 0, -86 - i * 65, 380, 57,
        () => this.action(() => { claimDaily(this.game, t.id); this.status = '委托奖励已领取'; }), !claimed && this.game.daily[t.id] >= t.target);
    });
    this.text(this.node, this.status, 0, -294, 385, 54, 14, C.muted);
  }

  private renderSynthesis() {
    this.text(this.node, '5 件同品质装备 → 1 件更高品质', 0, 285, 390, 42, 18, C.gold);
    for (let rank = 0; rank < 4; rank++) {
      const rarity = RARITIES[rank];
      this.button(rarity.name, -145 + rank * 96, 226, 88, 39, () => {
        this.selectedRarity = rarity.id; this.materials = []; this.bagPage = 0; this.render();
      }, this.selectedRarity === rarity.id);
    }
    const candidates = this.game.bag.filter((item: any) => item.rarity === this.selectedRarity);
    candidates.slice(this.bagPage * 9, this.bagPage * 9 + 9).forEach((item: any, index: number) => {
      const x = -130 + (index % 3) * 130;
      const y = 153 - Math.floor(index / 3) * 67;
      const selected = this.materials.includes(item.id);
      this.button(`${selected ? '✓ ' : ''}${item.name}\n${item.locked ? '已锁定' : SLOT_NAMES[item.slot]}`,
        x, y, 121, 61, () => {
          if (item.locked) { this.status = '先到装备页解锁'; this.render(); return; }
          this.materials = selected
            ? this.materials.filter(id => id !== item.id)
            : this.materials.length < 5 ? [...this.materials, item.id] : this.materials;
          this.render();
        }, selected);
    });
    this.button('‹', -140, -79, 44, 32, () => { this.bagPage = Math.max(0, this.bagPage - 1); this.render(); });
    this.text(this.node, `材料 ${this.materials.length}/5`, 0, -79, 150, 30, 15, C.ink);
    this.button('›', 140, -79, 44, 32, () => {
      this.bagPage = Math.min(Math.max(0, Math.ceil(candidates.length / 9) - 1), this.bagPage + 1);
      this.render();
    });
    this.button('自动选择', -87, -157, 160, 45, () => {
      this.materials = candidates.filter((item: any) => !item.locked).slice(0, 5).map((item: any) => item.id);
      this.render();
    });
    this.button('合成装备', 87, -157, 160, 45, () => this.action(() => {
      const item = synthesize(this.game, this.materials);
      this.materials = []; this.selectedItem = item.id; this.tab = 'equipment';
      this.status = `合成成功：${item.name}`;
    }), true);
    this.text(this.node, this.status, 0, -245, 385, 60, 14, C.muted);
  }
}
