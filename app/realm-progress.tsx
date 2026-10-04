import './realm-progress.css';
type Progress={realm:string;stage:string;progressPercent:number;nextRealm:string|null};
export default function RealmProgress({value,compact=false}:{value?:Progress;compact?:boolean}){
 if(!value)return null;
 return <div className={'realm-progress'+(compact?' realm-progress-compact':'')}>
  <div className="realm-progress-label"><span>{value.stage} · 修为</span><b>{value.progressPercent}%</b></div>
  <div className="realm-progress-track" role="progressbar" aria-label={value.realm+'修为进度'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value.progressPercent}><span style={{width:value.progressPercent+'%'}}/></div>
  {!compact&&<small>{value.nextRealm?'下一境界 · '+value.nextRealm:'当前境界已圆满'}</small>}
 </div>;
}
