import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,makeItem,SLOTS,heroStats,itemStats,mergeGems,drillSocket,mountGem,unmountGem,salvage,synthesize,restoreGame,startDungeon,advanceEncounter,closeEncounter,sweepDungeon,gemTotal,equip} from '../assets/scripts/core/game-core.ts';
const T=Date.UTC(2026,10,27,3);
function ready(){const s=newGame(991,T);s.gold=1000;s.ore=200;s.gems['ruby:1']=5;return s;}
test('五颗同类同级升级一颗，金币不足、数量不足、满级均无副作用',()=>{
  const s=ready();mergeGems(s,'ruby',1);assert.equal(s.gems['ruby:1'],0);assert.equal(s.gems['ruby:2'],1);assert.equal(s.gold,970);
  for(const [type,tier] of [['ruby',1],['ruby',5],['no',1]]){const snapshot=JSON.stringify(s);assert.throws(()=>mergeGems(s,type,tier));assert.equal(JSON.stringify(s),snapshot);}
  s.gems['ruby:1']=5;s.gold=29;const snapshot=JSON.stringify(s);assert.throws(()=>mergeGems(s,'ruby',1),/金币不足/);assert.equal(JSON.stringify(s),snapshot);
});
test('镶嵌加成实际生效，卸下恢复属性且不复制宝石',()=>{
  const s=ready(), id=s.equipped.weapon.id, before=heroStats(s);
  mountGem(s,id,0,'ruby',1);assert.equal(heroStats(s).attack,before.attack+3);assert.equal(s.gems['ruby:1'],4);
  const snap=JSON.stringify(s);assert.throws(()=>mountGem(s,id,0,'ruby',1),/卸下/);assert.equal(JSON.stringify(s),snap);
  unmountGem(s,id,0);assert.deepEqual(heroStats(s),before);assert.equal(s.gems['ruby:1'],5);
  assert.throws(()=>unmountGem(s,id,0),/没有宝石/);assert.equal(s.gems['ruby:1'],5);
});
test('镶嵌部位限制和锁定保护，打孔只收费一次且上限两个',()=>{
  const s=ready(), id=s.equipped.armor.id;
  const snap=JSON.stringify(s);assert.throws(()=>mountGem(s,id,0,'ruby',1),/不适用/);assert.equal(JSON.stringify(s),snap);
  s.equipped.armor.locked=true;assert.throws(()=>drillSocket(s,id),/解锁/);s.equipped.armor.locked=false;
  drillSocket(s,id);assert.equal(s.gold,800);assert.equal(s.ore,140);assert.equal(s.equipped.armor.sockets.length,2);
  const drilled=JSON.stringify(s);assert.throws(()=>drillSocket(s,id),/上限/);assert.equal(JSON.stringify(s),drilled);
});
test('镶嵌宝石随装备保留，合成分解前必须卸下',()=>{
  const s=ready();s.bag=Array.from({length:5},()=>makeItem(s,'common','weapon'));const item=s.bag[0];
  mountGem(s,item.id,0,'ruby',1);const snap=JSON.stringify(s);
  assert.throws(()=>salvage(s,[item.id]),/卸下/);assert.throws(()=>synthesize(s,s.bag.map(x=>x.id),T),/卸下/);assert.equal(JSON.stringify(s),snap);
  equip(s,item.id);assert.deepEqual(s.equipped.weapon.sockets,[{type:'ruby',tier:1}]);assert.equal(s.gems['ruby:1'],4);
  unmountGem(s,item.id,0);assert.equal(s.gems['ruby:1'],5);
});
test('宝石库存和孔位存档恢复，旧版升级不送宝石，坏数据拒绝加载',()=>{
  const s=ready();mountGem(s,s.equipped.weapon.id,0,'ruby',1);
  const r=restoreGame(JSON.parse(JSON.stringify(s)),T);assert.deepEqual(r,s);
  const bad=structuredClone(s);bad.equipped.weapon.sockets[0].type='emerald';assert.equal(restoreGame(bad,T),null);
  const count=structuredClone(s);count.gems['ruby:1']=-1;assert.equal(restoreGame(count,T),null);
  const old=structuredClone(s);old.version=4;delete old.gems;delete old.dungeonAttempts.gems;delete old.dungeonClears.gems;
  for(const item of Object.values(old.equipped).filter(Boolean))delete item.sockets;
  const migrated=restoreGame(old,T);assert.ok(migrated);assert.equal(gemTotal(migrated),0);assert.deepEqual(migrated.equipped.weapon.sockets,[null]);assert.equal(migrated.gold,s.gold);
});
test('宝石副本首次通关和扫荡各发整组同类宝石，材料可用于五合一',()=>{
  const s=ready();s.gems['ruby:1']=0;s.bestStage=10;s.stageUnlocked=10;
  for(const slot of SLOTS){s.equipped[slot]=makeItem(s,'legendary',slot);s.equipped[slot].level=10;}
  startDungeon(s,'gems',0,T);assert.equal(s.encounter.result.won,true);assert.equal(gemTotal(s),5);
  const reward=s.encounter.result.rewards.gems[0];assert.equal(s.gems[`${reward.type}:1`],5);
  while(advanceEncounter(s)){}closeEncounter(s);mergeGems(s,reward.type,1);assert.equal(gemTotal(s),1);
  sweepDungeon(s,'gems',0,T);assert.equal(gemTotal(s),6);assert.ok(restoreGame(s,T));
});
test('强化只放大装备基础，不额外乘算宝石；双孔叠加',()=>{
  const s=ready(), item=s.equipped.weapon;item.level=10;
  const base=itemStats(item).attack;drillSocket(s,item.id);mountGem(s,item.id,0,'ruby',1);mountGem(s,item.id,1,'ruby',1);
  assert.equal(itemStats(item).attack,base+6);assert.equal(s.gems['ruby:1'],3);
});
