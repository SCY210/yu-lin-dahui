import {perfectionScore,realmPolicy,realmProgress,realms} from '../domain/realm-rating';

/** Derive stage boundaries from the actual progress function, including its integer percentage rounding. */
export function realmStageRows(){
 return realms.map((realm,index)=>{
  const floor=index?realm.minimum:realms[1].minimum-realmPolicy.band,ceiling=realms[index+1]?.minimum??perfectionScore;
  const starts:{stage:string;at:number}[]=[];
  for(let score=floor;score<ceiling;score++){
   const stage=realmProgress(score,index).stage;
   if(starts.at(-1)?.stage!==stage)starts.push({stage,at:score});
  }
  const stages=starts.map((row,i)=>({stage:row.stage,from:index===0&&i===0?null:row.at,to:(starts[i+1]?.at??ceiling)-1}));
  if(index===realms.length-1)stages.push({stage:'圆满',from:perfectionScore,to:Infinity});
  return {realm:realm.name,range:realm.range,stages};
 });
}
