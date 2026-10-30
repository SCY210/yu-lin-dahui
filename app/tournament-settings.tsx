'use client';
import {useState} from 'react';
import type {Event} from '../lib/domain/types';
import {teamSize} from '../lib/domain/match-format';
import {categoryFits,categoryLabels,categoryName,defaultScoring,formatLabels,scoringLabel,tournamentFormat,type ScoringRule,type TournamentCategory,type TournamentFormat} from '../lib/domain/tournament';
import type {SchedulingContext} from './event-scheduling';
import Disclosure from './disclosure';

const scoringOptions:[string,ScoringRule][]=[['3-21',{games:3,points:21}],['1-21',{games:1,points:21}],['3-15',{games:3,points:15}],['1-15',{games:1,points:15}],['3-11',{games:3,points:11}],['1-11',{games:1,points:11}]];
const ruleKey=(r:ScoringRule)=>r.games+'-'+r.points;
const ruleOf=(key:string)=>scoringOptions.find(([k])=>k===key)?.[1]??defaultScoring;
const yuan=(cents:number)=>(cents/100).toFixed(cents%100?2:0);
const formatHints:Record<TournamentFormat,string>={groups:'先分组打单循环，各组前几名进入淘汰赛。',knockout:'输一场即出局，按修为排种子，最强的两队只会在决赛相遇，签位不足时种子轮空。','round-robin':'所有队伍互相打一场，按胜场、净胜分、总得分排名，第一名夺冠。'};
const categoryHints:Record<TournamentCategory,string>={'mens-singles':'只限男球友','mens-doubles':'只限男球友','mixed-doubles':'每队一男一女'};
const ScoringSelect=({label,value,disabled,onChange}:{label:string;value:string;disabled:boolean;onChange:(key:string)=>void})=><label>{label}<select value={value} disabled={disabled} onChange={event=>onChange(event.target.value)}>{scoringOptions.map(([k,r])=><option key={k} value={k}>{(r.games===3?'三局两胜':'一局')+' · '+r.points+' 分'}</option>)}</select><small className="hint">{scoringLabel(ruleOf(value))}</small></label>;

/** The competition's format, category, scoring rules and entry fee (docs/TOURNAMENTS.md). Everyone sees them; the owner
 * and administrators change them, all but the fee only before the draw. Groups and knockout have their own rule. */
export default function TournamentSettings({e,ctx,organiser}:{e:Event;ctx:SchedulingContext;organiser:boolean}){
 const t=e.tournament!,singles=teamSize(e)===1,locked=t.phase!=='setup',groupRule=t.scoring??defaultScoring,knockoutRule=t.knockoutScoring??groupRule;
 const [format,setFormat]=useState<TournamentFormat>(tournamentFormat(t)),[category,setCategory]=useState<TournamentCategory|''>(t.category??''),[groupKey,setGroupKey]=useState(ruleKey(groupRule)),[knockoutKey,setKnockoutKey]=useState(ruleKey(knockoutRule)),[fee,setFee]=useState(t.fee===undefined?'':yuan(t.fee));
 const cents=fee.trim()===''?null:Math.round(Number(fee)*100),feeValid=cents===null||Number.isFinite(cents)&&cents>=0&&cents<=100000;
 // Singles: open or men's; doubles: men's or mixed. Doubles created before categories keep their open option.
 const categories=(Object.keys(categoryLabels) as TournamentCategory[]).filter(k=>categoryFits(k,singles));
 const hasGroups=format!=='knockout',hasKnockout=format!=='round-robin';
 const scoring=ruleOf(hasGroups?groupKey:knockoutKey),knockoutScoring=ruleOf(hasKnockout?knockoutKey:groupKey);
 const changed=format!==tournamentFormat(t)||(category||undefined)!==t.category||ruleKey(scoring)!==ruleKey(groupRule)||ruleKey(knockoutScoring)!==ruleKey(knockoutRule)||cents!==(t.fee??null);
 const rules=tournamentFormat(t)==='groups'?['小组赛 '+scoringLabel(groupRule),'淘汰赛 '+scoringLabel(knockoutRule)]:[scoringLabel(tournamentFormat(t)==='knockout'?knockoutRule:groupRule)];
 const summary=[formatLabels[tournamentFormat(t)],categoryName(t,singles),...(t.scoring?rules:['计分按群规则']),t.fee===undefined?'费用按场地和球费分摊':'报名费每人 '+yuan(t.fee)+' 元'];
 return <section className="card tournament-settings">
  <h3>赛制与报名费</h3>
  <ul className="tournament-rule-list">{summary.map(x=><li key={x}>{x}</li>)}</ul>
  {organiser&&<Disclosure label="调整赛制与报名费" defaultOpen={t.phase==='setup'&&t.fee===undefined}>
   <div className="tournament-settings-form">
    <label>赛制<select value={format} disabled={locked} onChange={event=>setFormat(event.target.value as TournamentFormat)}>{(Object.keys(formatLabels) as TournamentFormat[]).map(k=><option key={k} value={k}>{formatLabels[k]}</option>)}</select></label>
    <p className="hint">{formatHints[format]}</p>
    <label>项目<select value={category} disabled={locked} onChange={event=>setCategory(event.target.value as TournamentCategory|'')}>{singles?<option value="">单打（不限性别）</option>:!t.category&&<option value="">双打（不限性别）</option>}{categories.map(k=><option key={k} value={k}>{categoryLabels[k]}（{categoryHints[k]}）</option>)}</select></label>
    {hasGroups&&<ScoringSelect label={format==='groups'?'小组赛计分':'计分'} value={groupKey} disabled={locked} onChange={setGroupKey}/>}
    {hasKnockout&&<ScoringSelect label={format==='groups'?'淘汰赛计分':'计分'} value={knockoutKey} disabled={locked} onChange={setKnockoutKey}/>}
    <label>报名费（每人，元）<input type="number" inputMode="decimal" min={0} max={1000} step="0.01" placeholder="不填则按场地和球费分摊" value={fee} onChange={event=>setFee(event.target.value)}/></label>
    <p className="hint">填写后不再分摊场地和球费，正式报名的每位选手交同样的报名费，在费用页确认后可标记付款和提醒。</p>
    {locked&&<p className="hint">已抽签：赛制、项目和计分不能再改，报名费仍可调整。</p>}
    <button type="button" className="primary" disabled={ctx.busy||!changed||!feeValid} onClick={()=>ctx.send('tournamentSettings',{eventId:e.id,format,category:category||null,scoring,knockoutScoring,fee:cents})}>保存设置</button>
   </div>
  </Disclosure>}
 </section>;
}
