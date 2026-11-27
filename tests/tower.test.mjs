import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,towerInfo,selectTowerCurse,rerollTowerCurses,startTower,upgradeMantle,mantleQuote,heroStats,advanceEncounter,closeEncounter,restoreGame,syncTime,battle,learnSkill,TOWER_CURSES,SLOTS,TALENTS,GEM_TYPES,makeItem,baseRange} from '../assets/scripts/core/game-core.ts';
const T=Date.UTC(2026,10,27,6),DAY=86400000;
function strong(){const s=newGame(812,T);s.bestStage=30;s.stageUnlocked=30;s.equipped.weapon.attack=10000;s.equipped.armor.health=100000;return s;}
function choose(s,t=T){selectTowerCurse(s,towerInfo(s,t).choices[0].id,t);}
function finish(s){while(advanceEncounter(s)){}closeEncounter(s);}
function unchanged(s,fn,pattern){const before=JSON.stringify(s);assert.throws(fn,pattern);assert.equal(JSON.stringify(s),before);}

test('试炼塔门槛、选项限制、刷新次数与候选存档有效，查看不消耗掉落随机数',()=>{
  const locked=newGame(1,T);unchanged(locked,()=>startTower(locked,T),/第 8 关/);
  const s=strong(),seed=s.seed;unchanged(s,()=>startTower(s,T),/先选择/);
  const a=towerInfo(s,T).choices.map(c=>c.id);assert.deepEqual(towerInfo(restoreGame(s,T),T).choices.map(c=>c.id),a);
  const absent=TOWER_CURSES.find(c=>!a.includes(c.id));unchanged(s,()=>selectTowerCurse(s,absent.id,T),/当前提供/);
  rerollTowerCurses(s,T);assert.notDeepEqual(towerInfo(s,T).choices.map(c=>c.id),a);
  assert.deepEqual(towerInfo(s,T).choices,towerInfo(restoreGame(s,T),T).choices);assert.equal(s.seed,seed);
  unchanged(s,()=>rerollTowerCurses(s,T),/用完/);choose(s);
  unchanged(s,()=>selectTowerCurse(s,a[0],T),/已选择/);unchanged(s,()=>rerollTowerCurses(s,T),/不能刷新/);
});

test('五次挑战胜利各结算一次，首领给塔印，不扣体力也不推进主线',()=>{
  let s=strong();choose(s);const energy=s.energy,gold=s.gold,best=s.bestStage;
  let expected=0;
  for(let i=1;i<=5;i++){
    const info=towerInfo(s,T);expected+=info.rewards.gold;startTower(s,T);assert.equal(s.encounter.result.won,true);
    const paid=[s.gold,s.feathers,s.sigils,s.tower.cleared];s=restoreGame(s,T);assert.ok(s);
    unchanged(s,()=>startTower(s,T),/当前战斗/);finish(s);assert.deepEqual([s.gold,s.feathers,s.sigils,s.tower.cleared],paid);
  }
  assert.equal(s.energy,energy);assert.equal(s.gold,gold+expected);assert.equal(s.bestStage,best);assert.equal(s.tower.best,5);assert.equal(s.sigils,1);
  assert.equal(towerInfo(s,T).needsChoice,true);choose(s);assert.equal(s.tower.curses.length,2);
  unchanged(s,()=>startTower(s,T),/次数已用完/);assert.ok(restoreGame(s,T));
});

test('失败计次但无奖励，日刷新和时钟回拨不会复制次数',()=>{
  const s=strong();s.tower.cleared=59;s.tower.best=59;s.equipped.weapon=null;s.equipped.armor=null;choose(s);
  const before=[s.gold,s.feathers,s.sigils,s.energy];startTower(s,T);assert.equal(s.encounter.result.won,false);finish(s);
  assert.deepEqual([s.gold,s.feathers,s.sigils,s.energy],before);assert.equal(s.tower.attempts,1);assert.equal(s.tower.cleared,59);
  syncTime(s,T+DAY);assert.equal(s.tower.attempts,0);startTower(s,T+DAY);finish(s);syncTime(s,T);assert.equal(s.tower.attempts,1);
});

test('周一 UTC+8 重置到历史最高层一半，跨周战斗续播后才切换周期',()=>{
  let s=strong();s.tower.best=19;s.tower.cleared=18;choose(s);startTower(s,T);
  const monday=Date.UTC(2026,10,29,16),resources=[s.gold,s.feathers,s.sigils];
  syncTime(s,monday-1);assert.equal(s.tower.cleared,19);
  s=restoreGame(s,monday);assert.ok(s);syncTime(s,monday);assert.equal(s.tower.cleared,19);assert.equal(s.tower.attempts,1);
  finish(s);assert.equal(s.tower.cleared,9);assert.equal(s.tower.best,19);assert.equal(s.tower.attempts,0);assert.deepEqual(s.tower.curses,[]);
  assert.deepEqual([s.gold,s.feathers,s.sigils],resources);assert.ok(towerInfo(s,monday).needsChoice);
  syncTime(s,T);assert.equal(s.tower.cleared,9);
});

test('披风升级材料原子扣除，五级需要塔印，满级与战斗中不能继续升级',()=>{
  const s=strong();unchanged(s,()=>upgradeMantle(s),/需要/);s.feathers=2000;s.gold=20000;s.sigils=20;
  for(let level=1;level<=20;level++){
    const cost=mantleQuote(s),before=[s.feathers,s.gold,s.sigils],stats=heroStats(s);
    if(level===5){s.sigils=0;unchanged(s,()=>upgradeMantle(s),/需要/);s.sigils=before[2];}
    assert.equal(upgradeMantle(s),level);assert.deepEqual([s.feathers,s.gold,s.sigils],[before[0]-cost.feathers,before[1]-cost.gold,before[2]-cost.sigils]);
    assert.equal(heroStats(s).attack,stats.attack+2);assert.equal(heroStats(s).health,stats.health+15);
  }
  unchanged(s,()=>upgradeMantle(s),/最高/);assert.ok(restoreGame(s,T));
  const active=strong();choose(active);startTower(active,T);unchanged(active,()=>upgradeMantle(active),/当前战斗/);
});

test('披风护盾、技能增伤、波次恢复与抗性实际影响战斗',()=>{
  const s=strong();s.equipped.weapon.attack=40;s.equipped.armor.health=1000;s.equipped.armor.defense=0;s.mantleLevel=15;
  const h=heroStats(s),r=battle(s,15,T),hits=r.events.filter(e=>e.type==='enemy');
  assert.ok(hits.some(e=>e.absorbed>0));assert.equal(hits.reduce((a,e)=>a+e.absorbed,0),h.barrier);
  assert.ok(r.events.some(e=>e.type==='heal'&&e.source==='披风余韵'&&e.amount>0));
  assert.ok(r.events.every(e=>e.heroHp==null||e.heroHp<=h.health));
  const base=strong();base.equipped.weapon.attack=20;base.mantleLevel=9;
  const boosted=structuredClone(base);boosted.mantleLevel=10;boosted.equipped.weapon.attack-=2;
  const normal=battle(base,15,T).events.find(e=>e.type==='hero'&&e.skill==='slash');
  const extra=battle(boosted,15,T).events.find(e=>e.type==='hero'&&e.skill==='slash');
  assert.ok(normal&&extra);assert.ok(Math.abs(extra.damage-normal.damage*1.1)<=1);
  const resist=heroStats(s).resist;s.mantleLevel=20;assert.equal(heroStats(s).resist,resist+0.05);
});

test('旧 V7 迁移不赠送塔材料，坏层数、重复区段、负材料拒绝加载',()=>{
  const s=strong();s.version=7;delete s.tower;delete s.feathers;delete s.sigils;delete s.mantleLevel;
  const upgraded=restoreGame(s,T);assert.equal(upgraded.version,8);assert.equal(upgraded.feathers,0);assert.equal(upgraded.mantleLevel,0);assert.equal(upgraded.gold,s.gold);assert.deepEqual(upgraded.equipped,s.equipped);
  for(const mutate of [s=>s.tower.cleared=61,s=>s.tower.attempts=6,s=>s.feathers=-1,s=>s.mantleLevel=21,s=>s.tower.curses=[{band:0,id:'fury'},{band:0,id:'vigor'}]]){
    const bad=structuredClone(upgraded);mutate(bad);assert.equal(restoreGame(bad,T),null);
  }
});

test('诅咒对生命、伤害、治疗和技能冷却产生可测变化',()=>{
  const base=strong();base.equipped.weapon.attack=18;base.equipped.armor.health=1000;base.equipped.armor.defense=0;
  learnSkill(base,'mend');base.skillLoadouts[0]=['slash','mend',null];
  const run=id=>{const s=structuredClone(base);s.tower.curses=id?[{band:0,id}]:[{band:0,id:'vigor'}];startTower(s,T);return s.encounter.result;};
  const vigor=run('vigor'),fury=run('fury');
  assert.ok(vigor.events[0].maxHp>fury.events[0].maxHp);
  const hurt=r=>r.events.find(e=>e.type==='enemy').damage;
  assert.ok(hurt(fury)>hurt(vigor));
  const burden=run('burden');assert.ok(burden.events.find(e=>e.type==='hero').damage<fury.events.find(e=>e.type==='hero').damage);
  const slow=run('delay'),firstSlash=r=>r.events.filter(e=>e.type==='hero').findIndex(e=>e.skill==='slash');
  assert.equal(firstSlash(slow),firstSlash(fury)+1);
  base.equipped.armor.health=0;
  const wither=run('wither'),plainHealing=run('vigor');const healing=r=>r.events.find(e=>e.type==='heal'&&e.skill==='mend').amount;
  assert.ok(healing(wither)<healing(plainHealing));
});

test('满养成边界配置能完成第六十层，登顶不越界且不可重复发奖',()=>{
  // 此为上限配置测试，诅咒组合是专用夹具，不代表自然游玩能保证获得此组合。
  const s=newGame(812,T);s.bestStage=30;s.stageUnlocked=30;s.mantleLevel=20;
  for(const t of TALENTS)s.talents[t.id]=t.max;
  for(const slot of SLOTS){const item=makeItem(s,'legendary',slot);Object.assign(item,baseRange(item).max);item.level=10;
    const gem=GEM_TYPES.find(t=>t.slots.includes(slot));item.sockets=[{type:gem.id,tier:5},{type:gem.id,tier:5}];s.equipped[slot]=item;}
  for(const id of ['slash','mend','cleave','venom','guard'])while(s.skills[id]<3)learnSkill(s,id);
  s.skillLoadouts[0]=['cleave','mend','guard'];s.tower.cleared=59;s.tower.best=59;s.tower.curses=Array.from({length:12},(_,band)=>({band,id:'vigor'}));
  assert.ok(restoreGame(s,T));startTower(s,T);assert.equal(s.encounter.result.won,true);finish(s);
  assert.equal(s.tower.cleared,60);assert.equal(s.tower.best,60);assert.equal(towerInfo(s,T).complete,true);
  unchanged(s,()=>startTower(s,T),/已登顶/);assert.ok(restoreGame(s,T));
});
