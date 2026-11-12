'use client';
import {Gift,HeartHandshake} from 'lucide-react';
import {productGiftPoints,bondGamePoints,bondTierIndex,bondTiers,bondWinPoints,type BondRow} from '../lib/domain/bond-tiers';
import {choice,number,text,type Field} from './ui';
import {hornDuration} from '../lib/domain/horn';
import {showError} from './error-dialog';
import './bond.css';

const count=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
type Product={kind?:'physical'|'digital'|'gift'|'horn';id:string;name:string;price:number;stock:number;active:boolean;hornSpecs?:{hours:number;price:number}[]};
/** One choice in the gift form: a product, or one duration of a 传音喇叭 (which goes into the receiver's 储物戒). */
type Choice={key:string;product:Product;price:number;hours?:number};
type Values=Record<string,unknown>;
type BondContext={busy:boolean;open:(title:string,action:string,values:Values,fields:Field[],convert:(v:Values)=>unknown,description:string)=>void;data:{bonds?:{rows:BondRow[]};treasureShop?:{products:Product[]}}};
const giftNote={...text('message','留言（可不填，最多60字）'),optional:true};

/** A bond stage name in its own colour, as in the stage table. */
export function BondStage({index}:{index:number}){return <span className={'bond-stage bond-tier-'+index}>{bondTiers[index].name}</span>}

/** The viewer's 道缘 with another member, shown on that member's profile (docs/BONDS.md). */
export default function BondCard({p,ctx}:{p:{id:string;name:string;enabled?:boolean;guestEventId?:string;guestFriendId?:string};ctx:BondContext}){
 const row:BondRow=ctx.data.bonds?.rows?.find(r=>r.playerId===p.id)??{playerId:p.id,score:0,games:0,wins:0,giftsSent:0,giftsReceived:0};
 const index=bondTierIndex(row.score),tier=bondTiers[index],next=bondTiers[index+1];
 const progress=next?Math.min(1,(row.score-tier.min)/(next.min-tier.min)):1;
 const products:Product[]=(ctx.data.treasureShop?.products??[]).filter(x=>x.active&&x.stock>0);
 const choices:Choice[]=products.flatMap(x=>x.kind==='horn'?(x.hornSpecs??[]).map(spec=>({key:x.id+'@'+spec.hours,product:x,price:spec.price,hours:spec.hours})):[{key:x.id,product:x,price:x.price}]);
 const label=(c:Choice)=>c.hours!==undefined?`${c.product.name} · ${hornDuration(c.hours)} · ${count(c.price)} 羽币 · +${count(productGiftPoints({kind:'horn',price:c.price}))} 缘值（放进对方储物戒，限 1 个）`:`${c.product.name} · ${count(c.price)} 羽币 · +${count(productGiftPoints(c.product))} 缘值/件`;
 const canGift=p.enabled!==false&&!p.guestEventId&&!p.guestFriendId;
 const giveItem=()=>ctx.open('送礼物给 '+p.name,'treasureRedeem',{productId:choices[0]?.key??'',quantity:1,message:''},
  [choice('productId','礼品',choices.map(c=>[c.key,label(c)])),{...number('quantity','数量'),min:1,max:99,step:1},giftNote],
  (v:Values)=>{
   const picked=choices.find(c=>c.key===v.productId),quantity=Number(v.quantity),message=String(v.message??'').trim();
   if(picked?.hours!==undefined){
    if(quantity!==1){const error='传音喇叭每次只能送 1 个';showError(error);throw new Error(error)}
    return {productId:picked.product.id,quantity:1,expectedPrice:picked.price,hornHours:picked.hours,giftTo:p.id,expectedAffinity:productGiftPoints({kind:'horn',price:picked.price}),message};
   }
   return {productId:v.productId,quantity,expectedPrice:picked?.price??0,giftTo:p.id,expectedAffinity:picked?productGiftPoints(picked.product,quantity):0,message};
  },
  `用你的羽币兑换宝阁里的任意商品送给对方，礼物会收进对方的储物戒：道缘礼物即时送达；传音喇叭由对方自己写内容、决定何时传音；实物和其他虚拟礼品由宗主发放。对方进入首页时会收到礼物提示，每件礼物增加的缘值见礼品选项，按数量累加，不享受阶段倍率。`);
 return <section className={'bond-card bond-tier-'+index} aria-label={'我和'+p.name+'的道缘'}>
  <div className="bond-head">
   <HeartHandshake size={20} aria-hidden="true"/>
   <div className="bond-title"><span>我和 {p.name} 的道缘</span><BondStage index={index}/></div>
   <strong className="bond-score" aria-label={'缘值 '+row.score}>{count(row.score)}<small>缘值</small></strong>
  </div>
  <div className="bond-bar" role="progressbar" aria-valuemin={tier.min} aria-valuemax={next?.min??tier.min} aria-valuenow={row.score} aria-label="距离下一阶段"><span style={{width:(progress*100).toFixed(1)+'%'}}/></div>
  <p className="bond-next">{next?<>距「<BondStage index={index+1}/>」还差 <b>{count(next.min-row.score)}</b></>:<>已达最高阶段</>}</p>
  <p className="bond-boost">默契加成 ×{tier.boost}：一起搭档每局 +{count(bondGamePoints*tier.boost)}，赢球再 +{count(bondWinPoints*tier.boost)}</p>
  <dl className="bond-facts">
   <div><dt>一起搭档</dt><dd>{count(row.games)} 局 · 赢 {count(row.wins)} 局</dd></div>
   <div><dt>互赠礼物（按价值）</dt><dd>送出 {count(row.giftsSent)} · 收到 {count(row.giftsReceived)} 羽币</dd></div>
  </dl>
  {canGift&&<div className="bond-actions">
   <button type="button" className="secondary" disabled={ctx.busy||!choices.length} onClick={giveItem}><Gift size={16} aria-hidden="true"/>送礼物</button>
  </div>}
  {canGift&&!choices.length&&<p className="hint bond-hint">羽林宝阁暂时没有可送的礼品。</p>}
  <details className="bond-ladder"><summary>道缘阶段</summary><ol>{bondTiers.map((t,i)=><li key={t.name} className={i===index?'bond-current':''}><BondStage index={i}/><small>{count(t.min)}{bondTiers[i+1]?'–'+count(bondTiers[i+1].min):'+'}</small></li>)}</ol></details>
 </section>;
}
