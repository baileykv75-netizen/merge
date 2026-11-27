import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,SKILLS,SLOTS,skillPoints,learnSkill,assignSkill,activateLoadout,resetSkills,battle,startEncounter,restoreGame} from '../assets/scripts/core/game-core.ts';
const T=Date.UTC(2026,10,27,3);
function learned(){const s=newGame(812,T);s.bestStage=10;s.stageUnlocked=10;s.gold=500;
  for(const id of ['slash','mend','cleave','guard','venom','fury'])learnSkill(s,id);
  s.talents.health=20;for(const slot of SLOTS)s.equipped[slot]=null;return s;}
test('技能点来自主线最高进度，重复刷关不重复获得，重置完整返还',()=>{
  const s=newGame(123,T);assert.equal(skillPoints(s),2);learnSkill(s,'slash');assert.equal(skillPoints(s),0);
  battle(s,1,T);assert.equal(s.bestStage,1);assert.equal(skillPoints(s),1);
  battle(s,1,T);assert.equal(skillPoints(s),1);
  const gold=s.gold;resetSkills(s);assert.equal(skillPoints(s),3);assert.equal(s.gold,gold-100);
  const snapshot=JSON.stringify(s);assert.throws(()=>resetSkills(s),/没有可返还/);assert.equal(JSON.stringify(s),snapshot);
});
test('关卡、前置和技能点条件均执行，失败保持存档',()=>{
  const s=newGame(4,T);let snap=JSON.stringify(s);assert.throws(()=>learnSkill(s,'mend'),/主线/);assert.equal(JSON.stringify(s),snap);
  s.bestStage=10;s.stageUnlocked=10;s.skills.slash=1;s.skills.mend=0;snap=JSON.stringify(s);
  assert.throws(()=>learnSkill(s,'cleave'),/前置/);assert.throws(()=>learnSkill(s,'guard'),/前置/);assert.equal(JSON.stringify(s),snap);
});
test('两套方案独立，装配禁止重复和未学技能，战斗中不能重配或重置',()=>{
  const s=learned();assignSkill(s,0,1,'mend');assignSkill(s,1,0,'cleave');activateLoadout(s,1);
  assert.deepEqual(s.skillLoadouts[0],['slash','mend',null]);assert.deepEqual(s.skillLoadouts[1],['cleave',null,null]);
  const snap=JSON.stringify(s);assert.throws(()=>assignSkill(s,1,1,'cleave'),/重复/);assert.equal(JSON.stringify(s),snap);
  startEncounter(s,1,T);const active=JSON.stringify(s);
  assert.throws(()=>activateLoadout(s,0),/当前战斗/);assert.throws(()=>resetSkills(s),/当前战斗/);assert.equal(JSON.stringify(s),active);
});
test('六个技能由各自冷却触发，治疗、减伤、增伤与毒伤参与计算',()=>{
  const base=learned();base.skillLoadouts[0]=[null,null,null];
  const plain=battle(structuredClone(base),8,T);
  for(const id of SKILLS.map(s=>s.id)){
    const s=structuredClone(base);s.skillLoadouts[0]=[id,null,null];const result=battle(s,8,T);
    const events=result.events.filter(e=>e.skill===id);assert.ok(events.length>0,id+'没有释放');
    if(id==='mend') assert.ok(events.some(e=>e.type==='heal'&&e.amount>0&&e.heroHp<=result.maxHeroHp));
    if(id==='guard') {const a=result.events.filter(e=>e.type==='enemy'),b=plain.events.filter(e=>e.type==='enemy');assert.ok(a.some((e,i)=>b[i]&&e.damage<b[i].damage));}
    if(id==='fury') {const a=result.events.filter(e=>e.type==='hero'),b=plain.events.filter(e=>e.type==='hero');assert.ok(a.some((e,i)=>b[i]&&e.damage>b[i].damage));}
    if(id==='venom') assert.ok(events.some(e=>e.type==='hero'&&e.damage>0));
    assert.ok(restoreGame({...s,encounter:{result,cursor:0}},T));
  }
});
test('技能、方案、升级存档可恢复，超预算及坏装配拒绝加载',()=>{
  const s=learned();assignSkill(s,1,0,'fury');activateLoadout(s,1);assert.deepEqual(restoreGame(s,T),s);
  const bad=structuredClone(s);bad.skillLoadouts[0]=['slash','slash',null];assert.equal(restoreGame(bad,T),null);
  const expensive=structuredClone(s);for(const id of Object.keys(expensive.skills))expensive.skills[id]=3;assert.equal(restoreGame(expensive,T),null);
  const old=newGame(1,T);old.version=5;delete old.skills;delete old.skillLoadouts;delete old.activeLoadout;
  const upgraded=restoreGame(old,T);assert.ok(upgraded);assert.equal(upgraded.skills.slash,1);assert.equal(skillPoints(upgraded),2);
});
