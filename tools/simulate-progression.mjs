// 诊断成长瓶颈：自动玩家只调用正常规则，不注入货币、装备或通关记录。
// 时间包含事件播放、整理装备和等待体力；该策略不能代替真人乐趣评估。
import {newGame,heroStats,itemStats,equip,synthesize,enhance,battle,SLOTS,RARITIES,MILESTONES,claimMilestone,
  learnSkill,assignSkill,stageInfo,syncTime,claimIdle,DAILY_TASKS,claimDaily,TALENTS,talentCost,upgradeTalent,
  dungeonInfo,startDungeon,advanceEncounter,closeEncounter,MAX_STAGE,restoreGame} from '../assets/scripts/core/game-core.ts';
import {pathToFileURL} from 'node:url';
const START=Date.UTC(2026,10,27,0);
const score=item=>{const p=itemStats(item);return p.attack*4+p.health+p.defense*6+(item?.affix==='生命恢复'?30:0);};
function outfit(s){for(const slot of SLOTS){const best=s.bag.filter(i=>i.slot===slot).sort((a,b)=>score(b)-score(a))[0];if(best&&score(best)>score(s.equipped[slot]))equip(s,best.id);}}
export function manage(s,now){
  for(const m of MILESTONES)if(m.stage<=s.bestStage&&!s.milestoneClaims.includes(m.stage)&&s.bag.length<=95)claimMilestone(s,m.stage);
  outfit(s);
  for(let count=0;count<30;count++){
    let group;
    for(const rarity of RARITIES.slice(0,-1)){
      const items=s.bag.filter(i=>i.rarity===rarity.id&&!i.locked&&!i.sockets.some(Boolean));
      group=SLOTS.map(slot=>items.filter(i=>i.slot===slot)).find(g=>g.length>=5)|| (items.length>=5?items:null);
      if(group&&s.gold>=40*(RARITIES.indexOf(rarity)+1))break;group=null;
    }
    if(!group)break;synthesize(s,group.slice(0,5).map(i=>i.id),now);outfit(s);
  }
  for(const [id,level] of [['slash',2],['mend',1],['cleave',1],['guard',1],['venom',1],['fury',1],['mend',3],['cleave',3],['guard',3],['venom',3],['fury',3]]){
    while(s.skills[id]<level){try{learnSkill(s,id);}catch{break;}}
  }
  const foes=stageInfo(s.stageUnlocked).foes;
  const loadout=[s.skills.cleave?'cleave':'slash',s.skills.mend?'mend':null,
    foes.some(e=>e.heal)&&s.skills.venom?'venom':s.skills.guard?'guard':null];
  for(let i=0;i<3;i++)assignSkill(s,0,i,null);for(let i=0;i<3;i++)assignSkill(s,0,i,loadout[i]);
  for(let n=0;n<15;n++){
    const slots=SLOTS.filter(slot=>s.equipped[slot]&&s.equipped[slot].level<Math.min(7,2+RARITIES.findIndex(r=>r.id===s.equipped[slot].rarity)*2));
    slots.sort((a,b)=>s.equipped[a].level-s.equipped[b].level);
    const slot=slots.find(k=>s.gold>=30*(s.equipped[k].level+1)+160&&s.ore>=10*(s.equipped[k].level+1));
    if(!slot)break;enhance(s,slot,now);
  }
  for(let n=0;n<10;n++){
    const t=TALENTS.filter(t=>s.talents[t.id]<Math.min(t.max,5+Math.floor(s.bestStage/5))).sort((a,b)=>talentCost(s,a.id)-talentCost(s,b.id))[0];
    if(!t||s.gold<talentCost(s,t.id)+200)break;upgradeTalent(s,t.id);
  }
  for(const t of DAILY_TASKS)if(s.daily[t.id]>=t.target&&!s.daily.claimed.includes(t.id))claimDaily(s,t.id,now);
}
export function simulate(seed,hours,includeState=false){
  let s=newGame(seed,START),now=START,farm=0,wins=0,losses=0,dungeons=0,actions=0;
  const checkpoints=[];
  while(now<START+hours*3600000&&actions++<10000&&s.bestStage<MAX_STAGE){
    syncTime(s,now);try{claimIdle(s,now);}catch{}manage(s,now);
    if(!restoreGame(s,now))throw Error(`模拟生成无效存档 ${seed}`);
    if(s.energy<1){now+=300000;continue;}
    let result;
    const material=s.ore<30?'ore':s.gold<150?'gold':null;
    if(material&&s.energy>=2){const info=dungeonInfo(s,material,0,now);if(info.unlocked&&info.remaining){startDungeon(s,material,0,now);result=s.encounter.result;while(advanceEncounter(s)){}closeEncounter(s);dungeons++;}}
    if(!result){const previous=s.bestStage;const stage=farm>0?Math.max(1,Math.floor((s.bestStage-1)/10)*10+1):s.stageUnlocked;
      result=battle(s,stage,now);if(farm>0)farm--;else if(!result.won)farm=3;
      if(s.bestStage>previous&&[1,5,10,15,20,25,30].includes(s.bestStage))checkpoints.push({stage:s.bestStage,minutes:Math.round((now-START)/60000),power:heroStats(s).power});
    }
    if(result.won)wins++;else losses++;
    now+=Math.max(20000,result.events.length*450+15000);
  }
  return {seed,hours,bestStage:s.bestStage,wins,losses,dungeons,merges:s.daily.merges,power:heroStats(s).power,gold:s.gold,ore:s.ore,bag:s.bag.length,checkpoints,...(includeState?{state:s,now}:{})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
const hours=Number(process.argv[2]||1),count=Number(process.argv[3]||10);
if(!(hours>0&&hours<=72&&count>=1&&count<=100))throw Error('范围：小时 1–72，样本数 1–100');
console.log(JSON.stringify({method:'自动管理装备、技能、有限资源副本与阶段宝箱；未使用广告、付费或资源注入',hours,runs:Array.from({length:count},(_,i)=>simulate(1201+i*97,hours))},null,2));
}
