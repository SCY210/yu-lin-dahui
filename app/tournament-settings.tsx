'use client';
import {useState} from 'react';
import type {Event} from '../lib/domain/types';
import {teamSize} from '../lib/domain/match-format';
import {categoryFits,categoryLabels,categoryName,defaultScoring,formatLabels,scoringLabel,tournamentFormat,type ScoringRule,type TournamentCategory,type TournamentFormat} from '../lib/domain/tournament';
import type {SchedulingContext} from './event-scheduling';
import Disclosure from './disclosure';
import {competitionCosts} from '../lib/domain/money';

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
 const [format,setFormat]=useState<TournamentFormat>(tournamentFormat(t)),[category,setCategory]=useState<TournamentCategory|''>(t.category??''),[groupKey,setGroupKey]=useState(ruleKey(groupRule)),[knockoutKey,setKnockoutKey]=useState(ruleKey(knockoutRule)),[prizes,setPrizes]=useState(()=>{const p=t.prizes??{first:0,second:0,third:0};return {first:yuan(p.first),second:yuan(p.second),third:yuan(p.third)}});
 const prizeCents={first:Math.round(Number(prizes.first||0)*100),second:Math.round(Number(prizes.second||0)*100),third:Math.round(Number(prizes.third||0)*100)};
 const prizesValid=Object.values(prizeCents).every(c=>Number.isFinite(c)&&c>=0&&c<=1000000),prizesChanged=JSON.stringify(prizeCents)!==JSON.stringify(t.prizes??{first:0,second:0,third:0});
 const costs=competitionCosts(ctx.data,e);
 // Singles: open or men's; doubles: men's or mixed. Doubles created before categories keep their open option.
 const categories=(Object.keys(categoryLabels) as TournamentCategory[]).filter(k=>categoryFits(k,singles));
 const hasGroups=format!=='knockout',hasKnockout=format!=='round-robin';
 const scoring=ruleOf(hasGroups?groupKey:knockoutKey),knockoutScoring=ruleOf(hasKnockout?knockoutKey:groupKey);
 const changed=format!==tournamentFormat(t)||(category||undefined)!==t.category||ruleKey(scoring)!==ruleKey(groupRule)||ruleKey(knockoutScoring)!==ruleKey(knockoutRule)||prizesChanged;
 const rules=tournamentFormat(t)==='groups'?['小组赛 '+scoringLabel(groupRule),'淘汰赛 '+scoringLabel(knockoutRule)]:[scoringLabel(tournamentFormat(t)==='knockout'?knockoutRule:groupRule)];
 const summary=[formatLabels[tournamentFormat(t)],categoryName(t,singles),...(t.scoring?rules:['计分按群规则']),'报名费每人 '+yuan(costs.fee)+' 元'];
 return <section className="card tournament-settings">
  <h3>赛制与报名费</h3>
  <ul className="tournament-rule-list">{summary.map(x=><li key={x}>{x}</li>)}</ul>
  {organiser&&<Disclosure label="调整赛制与奖品" defaultOpen={t.phase==='setup'&&!t.prizes}>
   <div className="tournament-settings-form">
    <label>赛制<select value={format} disabled={locked} onChange={event=>setFormat(event.target.value as TournamentFormat)}>{(Object.keys(formatLabels) as TournamentFormat[]).map(k=><option key={k} value={k}>{formatLabels[k]}</option>)}</select></label>
    <p className="hint">{formatHints[format]}</p>
    <label>项目<select value={category} disabled={locked} onChange={event=>setCategory(event.target.value as TournamentCategory|'')}>{singles?<option value="">单打（不限性别）</option>:!t.category&&<option value="">双打（不限性别）</option>}{categories.map(k=><option key={k} value={k}>{categoryLabels[k]}（{categoryHints[k]}）</option>)}</select></label>
    {hasGroups&&<ScoringSelect label={format==='groups'?'小组赛计分':'计分'} value={groupKey} disabled={locked} onChange={setGroupKey}/>}
    {hasKnockout&&<ScoringSelect label={format==='groups'?'淘汰赛计分':'计分'} value={knockoutKey} disabled={locked} onChange={setKnockoutKey}/>}
    <fieldset className="tournament-prizes"><legend>冠亚季奖品费用（元）</legend>{([['first','冠军'],['second','亚军'],['third','季军']] as const).map(([k,label])=><label key={k}>{label}<input type="number" inputMode="decimal" min={0} step="0.01" value={prizes[k]} onChange={event=>setPrizes({...prizes,[k]:event.target.value})}/></label>)}</fieldset>
    <p className="hint">比赛不分摊，所有正式报名的选手交同样的报名费：（场地费 + 球费 + 奖品）÷ 报名人数，向上取整到整欧元。</p>
    {locked&&<p className="hint">已抽签：赛制、项目和计分不能再改，奖品仍可调整。</p>}
    <button type="button" className="primary" disabled={ctx.busy||!changed||!prizesValid} onClick={()=>ctx.send('tournamentSettings',{eventId:e.id,format,category:category||null,scoring,knockoutScoring,prizes:prizeCents})}>保存设置</button>
   </div>
  </Disclosure>}
 </section>;
}
