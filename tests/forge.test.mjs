import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, makeItem, baseRange, rollForge, resolveForge, forgeQuote, restoreGame, transferEnhancement,
  compareItem, equip, salvage, battle, synthesize, enhance } from '../assets/scripts/core/game-core.ts';
const now=Date.UTC(2026,10,27);
function prepared() {
  const s=newGame(1234,now); s.gold=5000; s.shards=50; s.dust=50;
  s.equipped.weapon=makeItem(s,'rare','weapon'); s.equipped.weapon.level=3;
  return s;
}
test('重铸先付费生成候选，保留旧属性不再收费；重开保留候选',()=>{
  let s=prepared(); const original=structuredClone(s.equipped.weapon);
  const cost=forgeQuote(original,'reforge');
  const offer=rollForge(s,original.id,'reforge');
  assert.equal(s.gold,5000-cost.gold); assert.equal(s.shards,50-cost.amount);
  assert.deepEqual(s.equipped.weapon,original);
  s=restoreGame(JSON.parse(JSON.stringify(s)),now); assert.ok(s);
  assert.deepEqual(s.pendingForge,offer);
  const gold=s.gold; resolveForge(s,false);
  assert.deepEqual(s.equipped.weapon,original); assert.equal(s.gold,gold);
  assert.throws(()=>resolveForge(s,true),/没有待确认/);
});
test('采用重铸候选只改基础值，强化、品质、词条和ID保持',()=>{
  const s=prepared(), original=structuredClone(s.equipped.weapon);
  const p=rollForge(s,original.id,'reforge'), range=baseRange(original);
  for(const k of ['attack','health','defense']) assert.ok(p.stats[k]>=range.min[k]&&p.stats[k]<=range.max[k]);
  resolveForge(s,true);
  assert.deepEqual(s.equipped.weapon,{...original,...p.stats});
});
test('候选待确认期间禁止装备消耗、换装、强化和开始战斗',()=>{
  const s=prepared(); s.bag=Array.from({length:5},()=>makeItem(s));
  rollForge(s,s.bag[0].id,'reforge'); const snapshot=JSON.stringify(s);
  for(const operation of [()=>equip(s,s.bag[0].id),()=>salvage(s,[s.bag[0].id]),()=>synthesize(s,s.bag.map(x=>x.id),now),()=>enhance(s,'weapon',now),()=>battle(s,1,now)]) {
    assert.throws(operation,/决定保留/); assert.equal(JSON.stringify(s),snapshot);
  }
});
test('锁定、材料不足及普通装备洗练不消耗资源或随机种子',()=>{
  for(const scenario of ['locked','poor','common']) {
    const s=prepared(); if(scenario==='locked')s.equipped.weapon.locked=true;
    if(scenario==='poor')s.dust=0;
    if(scenario==='common')s.equipped.weapon=makeItem(s,'common','weapon');
    const snap=JSON.stringify(s);
    assert.throws(()=>rollForge(s,s.equipped.weapon.id,'wash'));
    assert.equal(JSON.stringify(s),snap);
  }
});
test('洗练新词条与旧词条不同，确认前战斗属性保持，确认后生效',()=>{
  const s=prepared(), item=s.equipped.weapon, old=item.affix;
  const p=rollForge(s,item.id,'wash'); assert.notEqual(p.affix,old);
  assert.equal(item.affix,old); resolveForge(s,true); assert.equal(item.affix,p.affix);
});
test('强化继承交换等级保留两件装备，其余数据不变',()=>{
  const s=prepared(), target=makeItem(s,'epic','weapon'); s.bag.push(target); target.level=1;
  const source=structuredClone(s.equipped.weapon), fresh=structuredClone(target);
  transferEnhancement(s,target.id);
  assert.equal(s.gold,5000-120);
  assert.deepEqual(s.equipped.weapon,{...source,level:1});
  assert.deepEqual(target,{...fresh,level:3});
  const snap=JSON.stringify(s); assert.throws(()=>transferEnhancement(s,target.id),/必须高于/);
  assert.equal(JSON.stringify(s),snap);
});
test('比较结果等于实际换装结果且比较不修改背包',()=>{
  const s=prepared(), item=makeItem(s,'epic','weapon'); s.bag.push(item);
  const snap=JSON.stringify(s), delta=compareItem(s,item);
  assert.equal(JSON.stringify(s),snap); equip(s,item.id);
  assert.deepEqual(compareItem(s,item).before,delta.after);
});
test('材料确实来自通关，旧V2存档迁移不赠送材料，坏候选拒绝加载',()=>{
  const s=prepared(); s.stageUnlocked=5; s.talents.health=20;
  const r=battle(s,5,now); assert.equal(r.won,true);
  assert.equal(s.shards,50+r.rewards.shards); assert.ok(r.rewards.shards>0);
  assert.equal(s.dust,50+r.rewards.dust); assert.ok(r.rewards.dust>0);
  const old=structuredClone(s); old.version=2; delete old.shards; delete old.dust;
  const migrated=restoreGame(old,now); assert.ok(migrated); assert.equal(migrated.shards,0); assert.equal(migrated.gold,s.gold);
  rollForge(s,s.equipped.weapon.id,'reforge'); s.pendingForge.stats.attack=99999;
  assert.equal(restoreGame(s,now),null);
});
