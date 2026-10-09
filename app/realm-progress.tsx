import './realm-progress.css';
import {realmPolicy} from '@/lib/domain/realm-rating';
/** 修为 progress inside the current realm band (100 points per realm). During placement no realm,
 * stage or bar is shown, only the 修为 and how many settled rated games remain. */
type Progress={realm?:string|null;stage?:string|null;progressPercent?:number;nextRealm?:string|null;score?:number;remaining?:number;nextAt?:number|null;pendingGames?:number;pendingChange?:number;placement?:boolean;placementGames?:number;ratedGames?:number;guarded?:boolean;demotionAt?:number|null};
const signed=(n:number)=>(n>0?'+':'')+n;
export default function RealmProgress({value,compact=false}:{value?:Progress;compact?:boolean}){
 if(!value)return null;
 const pending=!!value.pendingGames&&<small>另有 {value.pendingGames} 小局待活动结束后结算{value.pendingChange?'（暂计 '+signed(value.pendingChange)+' 分）':''}</small>;
 if(value.placement){
  const total=value.placementGames??realmPolicy.placementGames,left=Math.max(0,total-(value.ratedGames??0));
  return <div className={'realm-progress realm-progress-placement'+(compact?' realm-progress-compact':'')}>
   {value.score!==undefined&&<div className="realm-progress-label"><span>修为 {value.score}</span></div>}
   <small>再结算 {left} 个计分小局后显示境界</small>
   {pending}
  </div>;
 }
 const percent=value.progressPercent??0;
 return <div className={'realm-progress'+(compact?' realm-progress-compact':'')}>
  <div className="realm-progress-label"><span>{value.stage}{value.score!==undefined?' · 修为 '+value.score:''}</span><b>{percent}%</b></div>
  <div className="realm-progress-track" role="progressbar" aria-label={value.realm+'境界进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{width:percent+'%'}}/></div>
  {!compact&&value.nextRealm&&value.remaining!==undefined&&<small>距{value.nextRealm}还需 {value.remaining} 分</small>}
  {value.guarded&&value.demotionAt!=null&&<small>保级缓冲：低于 {value.demotionAt} 分才会降境界</small>}
  {pending}
  {!compact&&<small>{value.nextRealm?'下一境界 · '+value.nextRealm+(value.nextAt?'（'+value.nextAt+' 分）':''):value.stage==='圆满'?'化神圆满 · 修为随胜负继续变化':'化神 · 1300 分为圆满'}</small>}
 </div>;
}
