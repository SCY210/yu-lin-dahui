import './realm-progress.css';
/** 段位分 progress inside the current realm band (100 points per realm). */
type Progress={realm:string;stage:string;progressPercent:number;nextRealm:string|null;score?:number;remaining?:number;nextAt?:number|null;pendingGames?:number;pendingChange?:number;placement?:boolean;ratedGames?:number;guarded?:boolean;demotionAt?:number|null};
const signed=(n:number)=>(n>0?'+':'')+n;
export default function RealmProgress({value,compact=false}:{value?:Progress;compact?:boolean}){
 if(!value)return null;
 return <div className={'realm-progress'+(compact?' realm-progress-compact':'')}>
  <div className="realm-progress-label"><span>{value.stage}{value.score!==undefined?' · 段位分 '+value.score:''}</span><b>{value.progressPercent}%</b></div>
  <div className="realm-progress-track" role="progressbar" aria-label={value.realm+'境界进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value.progressPercent}><span style={{width:value.progressPercent+'%'}}/></div>
  {value.placement&&<small>定级中 · 已完成 {value.ratedGames??0}/10 个计分小局</small>}
  {!compact&&value.nextRealm&&value.remaining!==undefined&&<small>距{value.nextRealm}还需 {value.remaining} 分</small>}
  {value.guarded&&value.demotionAt!=null&&<small>保级缓冲：低于 {value.demotionAt} 分才会降境界</small>}
  {!!value.pendingGames&&<small>另有 {value.pendingGames} 小局待活动结束后结算{value.pendingChange?'（暂计 '+signed(value.pendingChange)+' 分）':''}</small>}
  {!compact&&<small>{value.nextRealm?'下一境界 · '+value.nextRealm+(value.nextAt?'（'+value.nextAt+' 分）':''):value.stage==='圆满'?'化神圆满 · 段位分随胜负继续变化':'化神 · 1300 分为圆满'}</small>}
 </div>;
}
