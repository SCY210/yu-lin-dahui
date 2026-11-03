'use client';
import {useState} from 'react';
import {Megaphone,X} from 'lucide-react';
import {bountyTitles,type BountyHonor,type BountyKind} from '../lib/domain/bounties';
import {rewardText} from './bounty-card';
import './bounty-honor-banner.css';

/** What each bounty kind's winner did, in the club's cultivation voice. */
const deeds:Record<BountyKind,string>={streak:'连斩五阵，剑气如虹',rout:'雷霆一击，压敌于个位',upset:'以弱胜强，鲤跃龙门',deuce:'廿分平后鏖战不退，终压一筹',
 unbeaten:'金身不坏，全场一局未失',gather:'聚气成海，全场净胜三十分有余',sweep:'剑扫八方，连败群雄',close:'刀尖问道，两番险胜'};
export const honorText=(h:BountyHonor,name:string)=>`天机阁传讯：「${h.title}」一役，${name}道友${deeds[h.kind]}，揭下${bountyTitles[h.kind]}，得赏 ${rewardText(h)}！`;

/** A scrolling banner under the top bar announcing completed bounties of the last day to everyone (docs/BOUNTIES.md).
 * Closing it hides it for this visit; with reduced motion the announcements stand still and wrap. */
export default function BountyHonorBanner({honors,name,onOpen}:{honors?:BountyHonor[];name:(id:string)=>string;onOpen:(eventId:string)=>void}){
 const [closed,setClosed]=useState(false);
 if(closed||!honors?.length)return null;
 const items=honors.map(h=>({key:h.eventId+'|'+h.playerId,eventId:h.eventId,text:honorText(h,name(h.playerId))}));
 const seconds=Math.max(14,Math.round(items.reduce((n,i)=>n+i.text.length,0)*.28));
 const list=(copy:boolean)=><ul className="bounty-honor-list" aria-hidden={copy||undefined}>{items.map(i=><li key={i.key}><button type="button" tabIndex={copy?-1:undefined} onClick={()=>onOpen(i.eventId)}>{i.text}</button></li>)}</ul>;
 return <section className="bounty-honor-banner" aria-label="悬赏捷报">
  <span className="bounty-honor-seal" aria-hidden="true"><Megaphone size={16}/></span>
  <div className="bounty-honor-window"><div className="bounty-honor-track" style={{animationDuration:seconds+'s'}}>{list(false)}{list(true)}</div></div>
  <button type="button" className="bounty-honor-close" aria-label="收起悬赏捷报" onClick={()=>setClosed(true)}><X size={16} aria-hidden="true"/></button>
 </section>;
}
