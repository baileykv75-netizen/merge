import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,makeItem,SLOTS,inventoryList,itemPower,autoEquipPlan,autoEquip,batchMergePlan,batchMerge,batchSalvagePlan,batchSalvage,heroStats,restoreGame,gemTotal,equip,toggleLock,synthesize,salvage,enhance,startEncounter} from '../assets/scripts/core/game-core.ts';
const T=Date.UTC(2026,10,27,6);
function fixture(){const s=newGame(115,T);s.gold=10000;return s;}
function add(s,rarity='common',slot='weapon',count=1){const list=Array.from({length:count},()=>makeItem(s,rarity,slot));s.bag.push(...list);return list;}
function unchanged(s,fn,pattern){const before=JSON.stringify(s);assert.throws(fn,pattern);assert.equal(JSON.stringify(s),before);}
function allIds(s){return [...s.bag,...Object.values(s.equipped).filter(Boolean)].map(i=>i.id).sort();}

test('背包筛选与三种排序只改变视图，空筛选及无效选项处理明确',()=>{
  const s=fixture();add(s,'common','weapon',3);add(s,'rare','armor',2);add(s,'fine','weapon',2);const snapshot=JSON.stringify(s);
  const weapons=inventoryList(s,{slot:'weapon',rarity:'fine'});assert.equal(weapons.length,2);assert.ok(weapons.every(i=>i.slot==='weapon'&&i.rarity==='fine'));
  const power=inventoryList(s).map(itemPower);assert.deepEqual(power,[...power].sort((a,b)=>b-a));
  assert.equal(inventoryList(s,{sort:'rarity'})[0].rarity,'rare');assert.equal(inventoryList(s,{sort:'newest'})[0].id,s.bag.at(-1).id);
  assert.deepEqual(inventoryList(s,{slot:'boots'}),[]);assert.throws(()=>inventoryList(s,{slot:'hat'}),/筛选/);assert.equal(JSON.stringify(s),snapshot);
});

test('一键穿戴精确匹配预览，宝石和装备守恒，不替换锁定装备或同分装备',()=>{
  const s=fixture();for(const slot of SLOTS)add(s,'epic',slot);
  s.bag.find(i=>i.slot==='weapon').sockets=[{type:'ruby',tier:3}];
  s.equipped.armor.locked=true;const locked=add(s,'legendary','boots')[0];locked.locked=true;
  const ids=allIds(s),gems=gemTotal(s),oldArmor=s.equipped.armor.id,gold=s.gold,seed=s.seed;
  const plan=autoEquipPlan(s);assert.equal(plan.changes.length,5);assert.ok(!plan.changes.some(c=>c.to.id===locked.id));
  autoEquip(s,plan.token);assert.deepEqual(heroStats(s),plan.after);assert.deepEqual(allIds(s),ids);assert.equal(gemTotal(s),gems);assert.equal(s.equipped.armor.id,oldArmor);assert.equal(s.gold,gold);assert.equal(s.seed,seed);
  unchanged(s,()=>autoEquip(s,plan.token),/重新预览/);assert.equal(autoEquipPlan(s).changes.length,0);assert.ok(restoreGame(s,T));
  const equal=add(s,'epic','weapon')[0];Object.assign(equal,{...s.equipped.weapon,id:equal.id,sockets:[...s.equipped.weapon.sockets]});assert.equal(autoEquipPlan(s).changes.length,0);
});

test('批量合成只消费原始同部位五件组，跳过保护装备且不连锁吞产物',()=>{
  const s=fixture();add(s,'common','weapon',25);add(s,'fine','armor',5);
  const protectedItems=add(s,'common','weapon',3);protectedItems[0].locked=true;protectedItems[1].level=1;protectedItems[2].sockets=[{type:'ruby',tier:1}];
  const plan=batchMergePlan(s),beforeBag=s.bag.length,beforeGold=s.gold,beforeGems=gemTotal(s);
  assert.equal(plan.groups.length,6);assert.equal(plan.cost,280);assert.equal(plan.items.length,30);
  const results=batchMerge(s,plan.filters,plan.token,T);assert.equal(results.length,6);assert.equal(s.bag.length,beforeBag-24);assert.equal(s.gold,beforeGold-280);assert.equal(s.daily.merges,6);
  assert.equal(results.filter(i=>i.rarity==='fine'&&i.slot==='weapon').length,5);assert.ok(results.some(i=>i.rarity==='rare'&&i.slot==='armor'));
  for(const i of protectedItems)assert.ok(s.bag.some(x=>x.id===i.id));assert.equal(gemTotal(s),beforeGems);assert.ok(restoreGame(s,T));
  unchanged(s,()=>batchMerge(s,plan.filters,plan.token,T),/重新预览/);
});

test('金币不足或预览后装备改变时整批失败，最大背包批量操作仍无重复ID',()=>{
  const s=fixture();add(s,'common','weapon',10);let plan=batchMergePlan(s);s.gold=40;
  unchanged(s,()=>batchMerge(s,plan.filters,plan.token,T),/整批需要 80/);s.gold=80;toggleLock(s,s.bag[0].id);
  unchanged(s,()=>batchMerge(s,plan.filters,plan.token,T),/重新预览/);
  const full=fixture();add(full,'common','weapon',100);plan=batchMergePlan(full);batchMerge(full,plan.filters,plan.token,T);
  assert.equal(full.bag.length,20);assert.equal(new Set(allIds(full)).size,allIds(full).length);assert.ok(restoreGame(full,T));
  const invalidTime=fixture();add(invalidTime,'common','weapon',5);plan=batchMergePlan(invalidTime);
  unchanged(invalidTime,()=>batchMerge(invalidTime,plan.filters,plan.token,-1),/时间无效/);
});

test('批量分解须指定低中品质，保护装备和史诗以上不被误删，奖励只结算一次',()=>{
  const s=fixture();add(s,'common','weapon',3);add(s,'rare','boots',2);add(s,'epic','armor',2);
  const protectedItems=add(s,'common','weapon',3);protectedItems[0].locked=true;protectedItems[1].level=2;protectedItems[2].sockets=[{type:'ruby',tier:1}];
  for(const rarity of ['all','epic','legendary']){const p=batchSalvagePlan(s,{rarity});assert.equal(p.allowed,false);unchanged(s,()=>batchSalvage(s,p.filters,p.token),/指定/);}
  const plan=batchSalvagePlan(s,{rarity:'common',slot:'weapon'});assert.equal(plan.items.length,3);assert.equal(plan.ore,15);
  const ore=s.ore,gems=gemTotal(s);assert.equal(batchSalvage(s,plan.filters,plan.token),15);assert.equal(s.ore,ore+15);assert.equal(gemTotal(s),gems);assert.equal(s.bag.length,7);
  unchanged(s,()=>batchSalvage(s,plan.filters,plan.token),/重新预览/);assert.ok(restoreGame(s,T));
});

test('战斗与锻造待确认期间，批量和单件装备操作均不改变结算快照',()=>{
  const s=fixture();add(s,'common','weapon',5);const equipPlan=autoEquipPlan(s),mergePlan=batchMergePlan(s),salvagePlan=batchSalvagePlan(s,{rarity:'common'});
  startEncounter(s,1,T);
  for(const action of [()=>autoEquip(s,equipPlan.token),()=>batchMerge(s,mergePlan.filters,mergePlan.token,T),()=>batchSalvage(s,salvagePlan.filters,salvagePlan.token),()=>equip(s,s.bag[0].id),()=>toggleLock(s,s.bag[0].id),()=>enhance(s,'weapon',T),()=>salvage(s,[s.bag[0].id]),()=>synthesize(s,s.bag.map(i=>i.id),T)])unchanged(s,action,/当前战斗/);
  const pending=fixture();add(pending,'common','weapon',5);const p=batchMergePlan(pending);pending.pendingForge={kind:'reforge'};
  unchanged(pending,()=>batchMerge(pending,p.filters,p.token,T),/锻造台/);
});
