import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,makeItem,SLOTS,DUNGEONS,startDungeon,sweepDungeon,dungeonInfo,advanceEncounter,closeEncounter,restoreGame,syncTime} from '../assets/scripts/core/game-core.ts';
const T=Date.UTC(2026,10,27,3);
function ready(){const s=newGame(812,T); s.bestStage=10;s.stageUnlocked=10; for(const slot of SLOTS){s.equipped[slot]=makeItem(s,'legendary',slot);s.equipped[slot].level=10;} return s;}
function finish(s){while(advanceEncounter(s)){} closeEncounter(s);}
test('四类副本只发指定资源，不改主线进度或掉落装备',()=>{
  for(const d of DUNGEONS){
    const s=ready(), before=structuredClone(s);startDungeon(s,d.id,0,T);
    assert.equal(s.encounter.result.won,true);
    for(const k of ['gold','ore','shards','dust'])assert.equal(s[k],before[k]+(k===d.id?d.rewards[0]:0));
    assert.equal(s.energy,28);assert.equal(s.dungeonAttempts[d.id],1);assert.equal(s.dungeonClears[d.id],0);
    assert.equal(s.stageUnlocked,before.stageUnlocked);assert.equal(s.bestStage,before.bestStage);assert.deepEqual(s.bag,before.bag);
    const r=restoreGame(JSON.parse(JSON.stringify(s)),T);assert.ok(r);assert.equal(r.encounter.result.dungeonId,d.id);
    const paid=r[d.id];finish(r);assert.equal(r[d.id],paid);
  }
});
test('未解锁、跨难度、未通关扫荡均不吞资源或次数',()=>{
  const s=newGame(2,T), before=JSON.stringify(s);
  assert.throws(()=>startDungeon(s,'gold',0,T),/主线/);assert.equal(JSON.stringify(s),before);
  s.bestStage=10;s.stageUnlocked=10;const unlocked=JSON.stringify(s);
  assert.throws(()=>startDungeon(s,'gold',1,T),/上一难度/);
  assert.throws(()=>sweepDungeon(s,'gold',0,T),/首次通关/);assert.equal(JSON.stringify(s),unlocked);
});
test('挑战和扫荡共用每日三次，跨日重置，时钟回拨不刷新',()=>{
  const s=ready(); startDungeon(s,'gold',0,T); finish(s);
  const gold=s.gold;
  sweepDungeon(s,'gold',0,T);sweepDungeon(s,'gold',0,T);
  assert.equal(s.gold,gold+360);assert.equal(s.energy,24);
  assert.equal(dungeonInfo(s,'gold',0,T).remaining,0);
  const before=JSON.stringify(s);assert.throws(()=>sweepDungeon(s,'gold',0,T),/次数已用完/);assert.equal(JSON.stringify(s),before);
  assert.equal(dungeonInfo(s,'ore',0,T).remaining,3);
  const next=T+86400000; assert.equal(dungeonInfo(s,'gold',0,next).remaining,3);
  sweepDungeon(s,'gold',0,next);assert.equal(s.dungeonAttempts.gold,1);
  syncTime(s,T);assert.equal(s.dungeonAttempts.gold,1);assert.equal(s.dungeonClears.gold,0);
});
test('失败消耗一次但不发胜利奖励或开放扫荡',()=>{
  const s=ready();s.dungeonClears.gold=1;for(const slot of SLOTS)s.equipped[slot]=null;
  const gold=s.gold;startDungeon(s,'gold',2,T);
  assert.equal(s.encounter.result.won,false);assert.equal(s.gold,gold);
  assert.equal(s.energy,28);assert.equal(s.dungeonAttempts.gold,1);assert.equal(s.dungeonClears.gold,1);
});
test('特殊攻击和恢复来自各副本机制',()=>{
  for(const id of ['gold','shards','dust']){
    const s=ready();s.dungeonClears[id]=1;for(const slot of SLOTS)s.equipped[slot]=null;
    s.talents.health=20;s.talents.defense=20;
    startDungeon(s,id,2,T);const events=s.encounter.result.events;
    if(id==='dust')assert.ok(events.some(e=>e.type==='enemyHeal'&&e.amount>0));
    else assert.ok(events.some(e=>e.ability===(id==='gold'?'伏击':'灼烧')));
    assert.ok(restoreGame(s,T));
  }
});
test('V3迁移保留装备货币，损坏次数与难度拒绝加载',()=>{
  const s=ready();s.version=3;delete s.dungeonDay;delete s.dungeonClears;delete s.dungeonAttempts;
  const r=restoreGame(s,T);assert.ok(r);assert.equal(r.version,4);assert.deepEqual(r.equipped,s.equipped);assert.equal(r.gold,s.gold);
  r.dungeonAttempts.gold=4;assert.equal(restoreGame(r,T),null);
  r.dungeonAttempts.gold=0;r.dungeonClears.ore=3;assert.equal(restoreGame(r,T),null);
});
