'use client';
import {bountyChance,bountyGoals,bountyKinds,bountyOfferMinutes,bountyTitles,type BountySettings} from '../lib/domain/bounties';
import {rewardText} from './bounty-card';

type Field={key:string;label:string;type:'number';min:number;max:number;step:number};
type Open=(title:string,action:string,values:Record<string,unknown>,fields:Field[],convert:(v:Record<string,unknown>)=>unknown,description?:string)=>void;
/** Group management: the owner and administrators set each bounty's coins and points and the penalty. */
export default function BountySettingsPanel({settings,open,busy}:{settings:BountySettings;open:Open;busy?:boolean}){
 const values:Record<string,number>={penalty:settings.penalty};
 for(const k of bountyKinds){values[k+'Coins']=settings.rewards[k].coins;values[k+'Points']=settings.rewards[k].points}
 const fields:Field[]=bountyKinds.flatMap(k=>[{key:k+'Coins',label:bountyTitles[k]+' · 羽币',type:'number' as const,min:0,max:1000,step:1},{key:k+'Points',label:bountyTitles[k]+' · 积分',type:'number' as const,min:0,max:100,step:1}]);
 fields.push({key:'penalty',label:'接下未完成扣的积分',type:'number',min:0,max:100,step:1});
 const edit=()=>open('调整悬赏令','bountySettings',values,fields,v=>({penalty:Number(v.penalty),rewards:Object.fromEntries(bountyKinds.map(k=>[k,{coins:Number(v[k+'Coins']),points:Number(v[k+'Points'])}]))}),'修改只影响之后接下的悬赏；已经接下的按接下时的奖励和惩罚结算。');
 return <div className="bounty-settings">
  <p className="hint">积分赛开始前 {bountyOfferMinutes} 分钟，约 {Math.round(bountyChance*100)}% 的正式报名球友会收到一张随机悬赏，可以接也可以不接。</p>
  <ul>{bountyKinds.map(k=><li key={k}><strong>{bountyTitles[k]}</strong>：{bountyGoals[k]} · 奖励 {rewardText(settings.rewards[k])}</li>)}</ul>
  <p>接下未完成：扣 {settings.penalty} 积分；不接没有惩罚。</p>
  <button type="button" className="secondary" disabled={busy} onClick={edit}>调整奖励与惩罚</button>
 </div>;
}
