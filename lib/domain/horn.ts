import {z} from 'zod';
import {isClubOwner} from './ownership';
import {fail,type Account,type HornSpec,type State,type TreasureOrder} from './types';

/** 传音喇叭 (docs/HORN_BROADCAST.md): a shop product whose purchase shows the buyer's own text in the
 * scrolling banner at the top of every page until its bought duration ends. */
export const hornMaxHours=24*30,hornMaxSpecs=8,hornTextMax=50;
const hour=3600000;

export const hornSpecInput=z.object({hours:z.number().int().min(1).max(hornMaxHours),price:z.number().int().min(1).max(1000000)}).strict();
export const hornSpecsInput=z.array(hornSpecInput).min(1,'传音喇叭至少需要一个规格').max(hornMaxSpecs,`传音喇叭最多 ${hornMaxSpecs} 个规格`)
 .refine(specs=>new Set(specs.map(s=>s.hours)).size===specs.length,'每个保留时长只能设置一个价格');
/** One line, no control characters; length counts Unicode characters, not UTF-16 units. */
export const hornTextInput=z.string().transform(text=>text.normalize('NFC').trim())
 .refine(text=>text.length>0,'请填写喇叭内容')
 .refine(text=>[...text].length<=hornTextMax,`喇叭内容最多 ${hornTextMax} 个字`)
 .refine(text=>!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(text),'喇叭内容不能换行或包含控制字符');
export const treasureHornRemoveInput=z.object({orderId:z.string().min(1).max(100)}).strict();
export const treasureHornUseInput=z.object({orderId:z.string().min(1).max(100),hornText:hornTextInput}).strict();

/** Shortest first, so the cheapest option leads and the card can show its starting price. */
export function sortHornSpecs(specs:readonly HornSpec[]){return [...specs].sort((a,b)=>a.hours-b.hours)}
export function hornStartingPrice(specs:readonly HornSpec[]){return Math.min(...specs.map(s=>s.price))}
export function hornDuration(hours:number){return hours%24===0?`${hours/24} 天`:`${hours} 小时`}
export function hornEnd(start:number,hours:number){return start+hours*hour}

/** Broadcasts on air now: bought, not taken down and not yet expired. Oldest first, so the banner order is stable. */
export function activeHorns(orders:readonly TreasureOrder[],now:number){
 return orders.filter(o=>o.kind==='horn'&&o.status==='fulfilled'&&o.hornText&&o.hornEnd!==undefined&&hornStart(o)<=now&&now<o.hornEnd&&o.hornRemovedAt===undefined)
  .sort((a,b)=>hornStart(a)-hornStart(b)||a.id.localeCompare(b.id));
}
/** A gifted horn waits in the receiver's 储物戒 until they use it; it goes on air from then, in their name. */
export function hornStart(o:Pick<TreasureOrder,'created'|'hornStart'>){return o.hornStart??o.created}
export function hornSpeaker(o:Pick<TreasureOrder,'playerId'|'giftTo'>){return o.giftTo??o.playerId}
/** What every member sees in the top banner. No account identifiers leave this projection. */
export function hornBroadcasts(s:Pick<State,'treasureOrders'>,now:number){
 return activeHorns(s.treasureOrders,now).map(o=>({id:o.id,playerId:hornSpeaker(o),hornText:o.hornText!,start:hornStart(o),end:o.hornEnd!}));
}
/** The banner changes without a write when a broadcast ends: the conditional read must expire then. */
export function nextHornEnd(s:Pick<State,'treasureOrders'>,now:number){
 let next=Infinity;for(const o of activeHorns(s.treasureOrders,now))next=Math.min(next,o.hornEnd!);return next;
}

/** The receiver of a gifted 传音喇叭 writes their own text and puts it on air for the bought duration, starting now.
 * Repeating the same request returns the broadcast; a horn already used cannot be rewritten. */
export function treasureHornUse(s:State,a:Account,input:unknown,now:number){
 const c=treasureHornUseInput.parse(input),o=s.treasureOrders.find(o=>o.id===c.orderId);
 if(!o||o.kind!=='horn'||o.giftTo!==a.playerId||o.status!=='fulfilled')fail('储物戒里没有这个传音喇叭');
 const me=s.players.find(p=>p.id===a.playerId);if(!me?.enabled)fail('只有已启用的正式球友可以传音');
 if(o.hornText!==undefined){if(o.hornText===c.hornText&&o.hornStart!==undefined)return o;fail('这个传音喇叭已经用过了')}
 if(!o.hornHours)fail('喇叭规格缺失，请联系宗主');
 o.hornText=c.hornText;o.hornStart=now;o.hornEnd=hornEnd(now,o.hornHours);o.updated=now;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'treasureHornUse',reason:'使用储物戒里的传音喇叭',changes:{playerId:a.playerId,orderId:o.id}});
 return o;
}

/** The owner and administrators can take an unsuitable broadcast off the banner early. Coins are not refunded
 * automatically; the owner can adjust coins separately if a refund is wanted. */
export function treasureHornRemove(s:State,a:Account,input:unknown,now:number){
 if(!isClubOwner(s,a)&&a.role!=='admin')fail('403: 只有宗主或副宗主可以撤下传音');
 const c=treasureHornRemoveInput.parse(input),o=s.treasureOrders.find(o=>o.id===c.orderId);
 if(!o||o.kind!=='horn')fail('传音记录不存在');
 if(o.hornRemovedAt!==undefined)return o;
 if(o.hornEnd===undefined||o.hornEnd<=now)fail('这条传音已经结束，无需撤下');
 o.hornRemovedAt=now;o.hornRemovedBy=a.id;o.updated=now;
 s.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'treasureHornRemove',reason:'撤下传音喇叭',changes:{playerId:o.playerId,orderId:o.id}});
 return o;
}

/** The owner edits options as one line each, such as "1小时 10" or "3天 60" (hours when no unit is written). */
export function parseHornSpecs(text:string):{specs:HornSpec[]}|{error:string}{
 const specs:HornSpec[]=[];
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const m=/^(\d{1,4})\s*(小时|时|h|天|日|d)?\s*[\s:：,，=]\s*(\d{1,7})\s*(?:羽币|币)?$/iu.exec(line);
  if(!m)return {error:`无法识别「${line}」，请按「时长 价格」每行一个规格，例如「1天 30」`};
  const days=/^(天|日|d)$/i.test(m[2]??''),hours=Number(m[1])*(days?24:1),price=Number(m[3]);
  if(hours<1||hours>hornMaxHours)return {error:`保留时长需在 1 小时到 ${hornMaxHours/24} 天之间：${line}`};
  if(price<1)return {error:`价格至少 1 羽币：${line}`};
  if(specs.some(s=>s.hours===hours))return {error:`保留时长重复：${hornDuration(hours)}`};
  specs.push({hours,price});
 }
 if(!specs.length)return {error:'请至少填写一个规格，例如「1天 30」'};
 if(specs.length>hornMaxSpecs)return {error:`最多 ${hornMaxSpecs} 个规格`};
 return {specs:sortHornSpecs(specs)};
}
export function formatHornSpecs(specs:readonly HornSpec[]){return sortHornSpecs(specs).map(s=>hornDuration(s.hours).replace(' ','')+' '+s.price).join('\n')}
/** Suggested options for a new 传音喇叭; the owner changes them freely. */
export const defaultHornSpecs:HornSpec[]=[{hours:1,price:10},{hours:24,price:30},{hours:72,price:60},{hours:168,price:120}];
