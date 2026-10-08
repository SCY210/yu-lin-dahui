import './realm-progress.css';
type Progress={realm:string;stage:string;progressPercent:number;nextRealm:string|null;experience?:number;remaining?:number;nextAt?:number|null;pendingGames?:number};
export default function RealmProgress({value,compact=false}:{value?:Progress;compact?:boolean}){
 if(!value)return null;
 return <div className={'realm-progress'+(compact?' realm-progress-compact':'')}>
  <div className="realm-progress-label"><span>{value.stage} · 修为</span><b>{value.progressPercent}%</b></div>
  <div className="realm-progress-track" role="progressbar" aria-label={value.realm+'修为进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value.progressPercent}><span style={{width:value.progressPercent+'%'}}/></div>
  {value.experience!==undefined&&<small>{value.experience} 修为{!compact&&value.nextRealm?' · 距'+value.nextRealm+'还需 '+value.remaining:''}</small>}
  {!!value.pendingGames&&<small>另有 {value.pendingGames} 小局待活动结束后结算</small>}
  {!compact&&<small>{value.nextRealm?'下一境界 · '+value.nextRealm:'化神圆满 · 修为继续累积'}</small>}
 </div>;
}
