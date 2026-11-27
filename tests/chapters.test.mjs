import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,makeItem,battle,startEncounter,advanceEncounter,encounterView,restoreGame,STAGES,CHAPTERS,ENEMIES,stageInfo,claimMilestone,synthesize,learnSkill} from '../assets/scripts/core/game-core.ts';
const T=Date.UTC(2026,10,27,6);
function probe(){const s=newGame(812,T);s.stageUnlocked=30;s.bestStage=30;s.equipped.weapon.attack=60;s.equipped.armor.health=100000;s.equipped.armor.defense=0;return s;}
test('三章有不同的敌人编排和首领，锁定关卡不可越过',()=>{
  assert.equal(CHAPTERS.length,3);assert.equal(STAGES.length,30);assert.equal(new Set(STAGES.map(s=>s.name)).size,30);
  for(const s of STAGES){assert.ok(s.waves.length>=2&&s.waves.length<=4);assert.ok(s.waves.every(e=>ENEMIES[e]));}
  assert.deepEqual([10,20,30].map(i=>stageInfo(i).foes.at(-1).id),['chief','rootlord','warden']);
  const s=newGame(1,T),before=JSON.stringify(s);assert.throws(()=>battle(s,11,T),/尚未开放/);assert.equal(JSON.stringify(s),before);
});
test('阶段宝箱一次领取五件同部位材料，能实际合成，满包不损失奖励',()=>{
  let s=newGame(1,T);s.bestStage=5;s.stageUnlocked=6;const g=s.gold,o=s.ore;
  const reward=claimMilestone(s,5);assert.equal(reward.items.length,5);assert.ok(reward.items.every(x=>x.slot==='weapon'&&x.rarity==='common'));
  assert.equal(s.gold,g+200);assert.equal(s.ore,o+25);
  const merged=synthesize(s,reward.items.map(x=>x.id),T);assert.equal(merged.rarity,'fine');assert.equal(merged.slot,'weapon');
  s=restoreGame(s,T);const snapshot=JSON.stringify(s);assert.throws(()=>claimMilestone(s,5),/已领取/);assert.equal(JSON.stringify(s),snapshot);
  const full=probe();full.bag=Array.from({length:96},()=>makeItem(full));const snap=JSON.stringify(full);assert.throws(()=>claimMilestone(full,10),/空位/);assert.equal(JSON.stringify(full),snap);
});
test('首领蓄力、狂暴和恢复进入战斗事件，毒伤抑制敌人治疗',()=>{
  for(const stage of [10,20,30]){
    const s=probe();const r=battle(s,stage,T);assert.ok(r.events.some(e=>e.type==='wave'&&e.boss));
    if(stage!==20)assert.ok(r.events.some(e=>e.type==='enemyStatus'&&e.text.includes('蓄力')));
    if(stage===30)assert.ok(r.events.some(e=>e.type==='enemyStatus'&&e.text.includes('狂暴')));
    if(stage===20)assert.ok(r.events.some(e=>e.type==='enemyHeal'&&e.amount>0));
  }
  const s=probe();for(const id of ['slash','cleave','venom'])learnSkill(s,id);s.skillLoadouts[0]=['venom',null,null];
  const r=battle(s,20,T);const bossHp=r.events.find(e=>e.type==='wave'&&e.boss).maxHp;
  const heals=r.events.filter(e=>e.type==='enemyHeal'&&e.wave===4);
  assert.ok(heals.some(e=>e.suppressed&&e.amount<=Math.ceil(bossHp*0.06)));
  assert.ok(heals.some(e=>!e.suppressed&&e.amount===Math.ceil(bossHp*0.12)));
});
test('失败保留最高推进而不降档，首领事件可跨刷新续播',()=>{
  const s=newGame(3,T);s.stageUnlocked=10;const r=battle(s,10,T);assert.equal(r.won,false);assert.ok(s.stageProgress[10]>0&&s.stageProgress[10]<100);
  const best=s.stageProgress[10];s.equipped.weapon=null;s.equipped.armor=null;battle(s,10,T);assert.ok(s.stageProgress[10]>=best);assert.equal(s.bestStage,0);
  const boss=probe();startEncounter(boss,30,T);while(boss.encounter.result.events[boss.encounter.cursor]?.type!=='enemyStatus')advanceEncounter(boss);advanceEncounter(boss);
  assert.deepEqual(encounterView(restoreGame(boss,T)),encounterView(boss));
});
test('旧十关通关存档开放第十一关且财产保持，最终关不越界，坏宝箱记录拒绝加载',()=>{
  const old=newGame(6,T);old.version=6;old.bestStage=10;old.stageUnlocked=10;delete old.stageProgress;delete old.milestoneClaims;
  const restored=restoreGame(old,T);assert.equal(restored.stageUnlocked,11);assert.equal(restored.gold,old.gold);assert.deepEqual(restored.bag,old.bag);assert.equal(restored.stageProgress[10],100);
  const s=probe();s.equipped.weapon.attack=10000;const result=battle(s,30,T);assert.equal(result.won,true);assert.equal(s.stageUnlocked,30);assert.ok(restoreGame(s,T));
  const bad=structuredClone(s);bad.milestoneClaims=[5,5];assert.equal(restoreGame(bad,T),null);
  const progress=structuredClone(s);progress.stageProgress[1]=101;assert.equal(restoreGame(progress,T),null);
});
test('章节掉落品质匹配奖励预览，后期继续提供可合成的基础材料',()=>{
  for(const stage of [1,11,21]){const s=probe();s.equipped.weapon.attack=10000;const info=stageInfo(stage),r=battle(s,stage,T);
    assert.equal(r.rewards.gold,info.gold);assert.equal(r.rewards.items.length,2);assert.ok(r.rewards.items.every(i=>i.rarity===info.baseRarity));}
});
test('重甲减少普通伤害，破甲斩按完整倍率结算',()=>{
  const s=probe();learnSkill(s,'slash');learnSkill(s,'cleave');s.skillLoadouts[0]=['cleave',null,null];
  const r=battle(s,7,T),armored=r.events.filter(e=>e.type==='hero'&&e.wave>=2&&!e.critical);
  const cleaves=armored.filter(e=>e.skill==='cleave'),normal=armored.filter(e=>!e.skill);
  assert.ok(cleaves.length&&normal.length);assert.ok(cleaves.every(e=>e.damage>=155&&e.damage<=189));
  assert.ok(normal.every(e=>e.damage>=54&&e.damage<=66));
});
