// 在正常主线成长之后，每天一次登录、十次刷装、五次试炼；不注入资源或通关进度。
import {simulate,manage} from './simulate-progression.mjs';
import {syncTime,claimIdle,battle,towerInfo,selectTowerCurse,startTower,advanceEncounter,closeEncounter,upgradeMantle,restoreGame,heroStats,assignSkill} from '../assets/scripts/core/game-core.ts';
const days=Number(process.argv[2]||21),count=Number(process.argv[3]||10);
if(!Number.isInteger(days)||days<1||days>90||!Number.isInteger(count)||count<1||count>100)throw Error('范围：天数 1–90，样本数 1–100');
function run(seed){
  const initial=simulate(seed,24,true);let s=initial.state,now=initial.now;const history=[];
  for(let day=1;day<=days;day++){
    if(day>1)now+=86400000;
    syncTime(s,now);try{claimIdle(s,now);}catch{}manage(s,now);
    for(let n=0;n<10&&s.energy;n++){
      const result=battle(s,s.bestStage,now);now+=result.events.length*450+15000;syncTime(s,now);manage(s,now);
    }
    let wins=0,losses=0;
    while(towerInfo(s,now).unlocked&&towerInfo(s,now).remaining&&!towerInfo(s,now).complete){
      const info=towerInfo(s,now);
      assignSkill(s,0,2,null);assignSkill(s,0,2,info.foes.some(f=>f.heal)&&s.skills.venom?'venom':s.skills.guard?'guard':null);
      if(info.needsChoice){const priority=['fury','vigor','burden','wither','delay'];selectTowerCurse(s,[...info.choices].sort((a,b)=>priority.indexOf(a.id)-priority.indexOf(b.id))[0].id,now);}
      startTower(s,now);const result=s.encounter.result;if(result.won)wins++;else losses++;
      now+=result.events.length*450+15000;while(advanceEncounter(s)){}closeEncounter(s);syncTime(s,now);
      for(let n=0;n<20;n++){try{upgradeMantle(s);}catch{break;}}
    }
    const restored=restoreGame(s,now);if(!restored)throw Error(`无效存档：种子 ${seed} 第 ${day} 天`);s=restored;
    history.push({day,wins,losses,best:s.tower.best,weeklyCleared:s.tower.cleared,mantle:s.mantleLevel,feathers:s.feathers,sigils:s.sigils,power:heroStats(s).power});
  }
  return {seed,campaignClear:initial.bestStage,history};
}
console.log(JSON.stringify({method:'24 小时上限内按实际资源完成主线后，每天一次登录、十次刷装与最多五次试炼；固定诅咒偏好，材料足够就升级披风。包含周重置，不包含宝石和洗练策略，不代表真人体验或所有流派平衡。',days,runs:Array.from({length:count},(_,i)=>run(1201+i*97))},null,2));
