'use client';
import {useState} from 'react';
import {ArrowUpRight,Check,Coins,Gift,Minus,Package,Plus,ShoppingBag,Sparkles} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {CardContext} from './match-card';
import {choice,fmt,type Field} from './form-fields';
import Disclosure from './disclosure';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import './treasure-shop.css';

type Product=ClubData['treasureShop']['products'][number];
type Order=ClubData['treasureShop']['orders'][number];
type Ledger=ClubData['treasureShop']['ledger'][number];
type Props={data:ClubData;open:CardContext['open'];busy?:boolean;name?:(id:string)=>string};
const count=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
const statusName={pending:'待领取',fulfilled:'已完成',cancelled:'已取消'};
const ledgerNames:Record<string,string>={grant:'群主调整',redeem:'礼品兑换',refund:'兑换退款',automatic_reward:'活动奖励',automatic_correction:'奖励校正',gift_sent:'赠送球友',gift_received:'收到赠礼'};
const productFields:Field[]=[{key:'name',label:'商品名称'},{key:'description',label:'商品介绍与领取说明',type:'textarea',required:false},choice('kind','商品类型',[['physical','实物礼品'],['digital','虚拟礼品']]),{key:'price',label:'兑换价格 · 羽币',type:'number',min:1,max:1000000,step:1},{key:'stock',label:'可兑换库存',type:'number',min:0,max:1000000,step:1},{key:'active',label:'上架商品',type:'checkbox'}];

function ProductCard({product,busy,onOpen}:{product:Product;busy:boolean;onOpen:()=>void}){
 const available=product.active&&product.stock>0;
 return <article className={'ts-product'+(!available?' ts-product-unavailable':'')}><button type="button" className="ts-product-open" disabled={busy} aria-label={'查看'+product.name+'详情'} aria-haspopup="dialog" onClick={onOpen}>
  <span className="ts-product-meta"><span className="ts-product-kind">{product.kind==='physical'?<Gift size={18} aria-hidden="true"/>:<Sparkles size={18} aria-hidden="true"/>}{product.kind==='physical'?'实物':'虚拟'}</span><span>{available?'余 '+count(product.stock):'已兑完'}</span></span>
  <strong className="ts-product-name">{product.name}</strong>
  <span className="ts-product-footer"><span className="ts-price"><Coins size={14} aria-hidden="true"/><strong>{count(product.price)}</strong><span>羽币</span></span><span className="ts-product-cta">{available?'兑换':'详情'}<ArrowUpRight size={13} aria-hidden="true"/></span></span>
 </button></article>;
}

function ProductDetails({product,balance,busy,onClose,onRedeem}:{product:Product;balance:number;busy:boolean;onClose:()=>void;onRedeem:(product:Product,quantity:number)=>void}){
 const [quantity,setQuantity]=useState(1),max=Math.min(product.stock,99),selected=Math.min(quantity,Math.max(1,max)),total=product.price*selected,available=product.active&&max>0,affordable=balance>=total;
 return <Dialog open onOpenChange={next=>{if(!next)onClose()}}><DialogContent className="app-dialog ts-product-dialog">
  <DialogHeader><DialogTitle>{product.name}</DialogTitle><DialogDescription className="ts-product-description">{product.description||'选择兑换数量，再确认兑换。'}</DialogDescription></DialogHeader>
  <div className="ts-detail-meta"><span>{product.kind==='physical'?'实物礼品':'虚拟礼品'} · {available?'剩余 '+count(product.stock)+' 件':'暂时兑完'}</span><span>{count(product.price)} 羽币 / 件</span></div>
  {available&&<div className="ts-detail-quantity"><span>兑换数量</span><div className="ts-stepper" role="group" aria-label={product.name+'兑换数量'}><button type="button" aria-label={'减少'+product.name+'数量'} disabled={busy||selected<=1} onClick={()=>setQuantity(selected-1)}><Minus size={15}/></button><output aria-label="当前数量">{selected}</output><button type="button" aria-label={'增加'+product.name+'数量'} disabled={busy||selected>=max} onClick={()=>setQuantity(selected+1)}><Plus size={15}/></button></div></div>}
  <div className="ts-detail-total"><span>合计</span><strong>{count(total)} <small>羽币</small></strong></div><p className="ts-detail-balance">当前余额 {count(balance)} 羽币{available&&affordable?' · 兑换后剩余 '+count(balance-total)+' 羽币':''}</p>
  <button type="button" className="primary ts-redeem" disabled={busy||!available||!affordable} onClick={()=>onRedeem(product,selected)}>{!product.active?'已下架':!available?'库存已兑完':!affordable?'羽币不足':'兑换 · '+count(total)+' 羽币'}</button>
 </DialogContent></Dialog>;
}

function OrderRow({order,owner,busy,name,onHandle}:{order:Order;owner?:boolean;busy:boolean;name:(id:string)=>string;onHandle?:(order:Order,status:'fulfilled'|'cancelled')=>void}){return <article className="ts-order"><div className="ts-order-main"><span className="ts-order-icon" aria-hidden="true"><Package size={20}/></span><div><strong>{order.productName}</strong><small>{owner?name(order.playerId)+' · ':''}{order.quantity} 件 · {count(order.total)} 羽币</small>{order.giftTo&&<small className="ts-order-gift">送给 {name(order.giftTo)}{order.message?' · “'+order.message+'”':''}</small>}<small>{fmt(order.created)}</small></div><span className={'ts-order-status ts-order-status-'+order.status}>{statusName[order.status]}</span></div>{order.status==='pending'&&<div className="ts-order-next">{owner?<div className="ts-order-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>onHandle?.(order,'fulfilled')}><Check size={15}/>确认完成</button><button type="button" className="ghost" disabled={busy} onClick={()=>onHandle?.(order,'cancelled')}>取消并退还羽币</button></div>:<span>{order.giftTo?'已为对方兑换，群主会把礼物交给对方。':order.kind==='physical'?'兑换成功，请联系群主安排领取。':'兑换成功，等待群主为你安排。'}</span>}</div>}{order.status==='cancelled'&&<p className="ts-order-note">羽币已退回，库存已恢复。</p>}</article>}

type StreakReward=ClubData['treasureShop']['streakReward'];
function RewardRules({policy,pendingCorrection,streak,onEditStreak}:{policy:ClubData['treasureShop']['rewardPolicy'];pendingCorrection:number;streak:StreakReward;onEditStreak?:()=>void}){
 return <div className="ts-rewards">
  {pendingCorrection>0&&<p className="ts-correction" role="status"><strong>待校正 {count(pendingCorrection)} 羽币</strong><span>后续自动奖励先抵扣待校正部分，手动发币和兑换退款不受影响；当前余额不会变成负数。</span></p>}
  <Disclosure label="羽币奖励规则" className="ts-reward-rules">
   <p className="ts-reward-timing">{policy?'活动结束后自动结算，羽币明细可查看每笔记录。':'自动奖励尚未启用，启用前结束的活动不补发。'}</p>
   <dl className="ts-reward-rates"><div><dt>赢球得分</dt><dd>1 积分 <span>奖励</span> 1 羽币</dd></div><div><dt>参加活动</dt><dd>每场活动 <strong>5 羽币</strong></dd></div><div><dt>连续到场</dt><dd>{streak.coins?<>连续 {streak.length} 场积分赛 <strong>{count(streak.coins)} 羽币</strong></>:'已关闭'}</dd></div><div><dt>输球扣分</dt><dd>羽币不扣</dd></div></dl>
   <p>胜局积分包含逆袭和连胜奖励，每获得 1 积分奖励 1 羽币；群主调分、投票和通知等奖励不自动发币。兑换只消耗羽币，不影响排行积分或修为。</p>
   <p>参与奖励每场活动只发一次，多场地、多时段不重复发放；仅候补、未实际参加的取消报名、缺席和临时来宾不计入。整场取消的活动不发奖励。</p>
   <p>连续到场奖励：俱乐部举办的积分赛（单打、双打合并计算）每连续 {streak.length} 场都按时到场，在第 {streak.length} 场结束后发放，之后重新计数。缺席其中任何一场，或在某一场被报告迟到，都从 0 重新计；被误标迟到、撤销后不影响。普通活动、练球和赛事不计入。</p>
   {onEditStreak&&<p className="ts-streak-edit"><button type="button" className="secondary" onClick={onEditStreak}>调整连续到场奖励</button><span>只影响之后满 {streak.length} 场的奖励，已发出的不变。</span></p>}
   <p>同一场比赛不会重复奖励。比分修正或作废时，可收回尚未使用的自动奖励；已花掉的部分从后续自动奖励中抵扣，手动发币和兑换退款不受影响，不向你收费。</p>
   <p className="ts-reward-start">{policy?<>从 {fmt(policy.activatedAt)} 启用，仅限此后结束的活动；更早结束的活动不补发。</>:'群主仍可单独发放羽币，手动发放与自动奖励分别记录。'}</p>
  </Disclosure>
 </div>;
}

function LedgerRow({row}:{row:Ledger}){
 return <div className="ts-ledger-row"><div><span className="ts-ledger-kind">{ledgerNames[row.kind]??'羽币变动'}</span><strong>{row.reason}</strong><small>{fmt(row.at)}</small></div><div><b className={row.delta>0?'ts-credit':''}>{row.delta>0?'+':''}{count(row.delta)}</b><small>余额 {count(row.balance)}</small></div></div>;
}

export default function TreasureShop({data,open,busy=false,name}:Props){
 const [filter,setFilter]=useState<'all'|'physical'|'digital'>('all'),[selectedId,setSelectedId]=useState<string|null>(null);
 const shop=data.treasureShop,owner=!!data.me.isOwner,ownId=data.me.playerId,playerName=name??((id:string)=>data.players.find(p=>p.id===id)?.name??'已移除球友');
 const products:Product[]=shop.products,orders:Order[]=shop.orders,ledger:Ledger[]=shop.ledger;
 const catalog=products.filter(p=>p.active&&(filter==='all'||p.kind===filter)),selectedProduct=products.find(p=>p.id===selectedId&&p.active);
 const ownOrders=orders.filter(o=>o.playerId===ownId).sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id));
 const ownLedger=ledger.filter(l=>l.playerId===ownId).sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id));
 const walletPlayers=owner?data.players.filter(p=>shop.wallets.some(wallet=>wallet.playerId===p.id)):[];
 const pending=orders.filter(o=>o.status==='pending').sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id));
 const editProduct=(p?:Product)=>open(p?'编辑商品':'添加商品','treasureProduct',p?{id:p.id,expectedVersion:p.version??0,name:p.name,description:p.description,kind:p.kind,price:p.price,stock:p.stock,active:p.active}:{name:'',description:'',kind:'physical',price:10,stock:1,active:true},productFields,v=>({...v.id?{id:v.id,expectedVersion:v.expectedVersion}:{},name:v.name,description:v.description,kind:v.kind,price:v.price,stock:v.stock,active:v.active}),'价格使用整数羽币。库存是当前可兑换数量；下架后不再开放新兑换，已有兑换记录会保留。虚拟礼品也由群主安排发放。');
 const redeem=(p:Product,quantity:number)=>open('确认兑换','treasureRedeem',{productId:p.id,quantity,expectedPrice:p.price},[],v=>({productId:v.productId,quantity:v.quantity,expectedPrice:v.expectedPrice}),`兑换「${p.name}」${quantity} 件，共 ${count(p.price*quantity)} 羽币。当前余额 ${count(shop.balance)} 羽币，兑换后剩余 ${count(shop.balance-p.price*quantity)} 羽币。${p.kind==='physical'?'实物礼品由群主安排领取。':'虚拟礼品由群主安排发放。'}`);
 const handleOrder=(o:Order,status:'fulfilled'|'cancelled')=>open(status==='fulfilled'?'确认礼品已完成':'取消兑换并退款','treasureOrder',{id:o.id,status},[],v=>({id:v.id,status:v.status}),status==='fulfilled'?`确认已向 ${playerName(o.playerId)} 发放「${o.productName}」${o.quantity} 件？完成后将保留兑换记录。`:`取消 ${playerName(o.playerId)} 的「${o.productName}」${o.quantity} 件，退回 ${count(o.total)} 羽币并恢复库存。`);
 const grant=()=>open('调整球友羽币','treasureGrant',{playerId:'',operation:'add',amount:10,adjustmentReason:''},[choice('playerId','球友',walletPlayers.map(p=>[p.id,p.name])),choice('operation','操作',[['add','发放羽币'],['subtract','扣除羽币']]),{key:'amount',label:'羽币数量（整数）',type:'number',min:1,max:1000000,step:1},{key:'adjustmentReason',label:'调整原因',type:'textarea',required:true}],v=>({playerId:v.playerId,amount:(v.operation==='subtract'?-1:1)*Number(v.amount),reason:String(v.adjustmentReason??'').trim()}),'只允许群主操作，原因会出现在球友自己的羽币明细中。羽币独立于排行积分和修为，余额不能扣成负数。');
 const editStreak=()=>open('调整连续到场奖励','treasureStreakReward',{coins:shop.streakReward.coins},[{key:'coins',label:`每连续 ${shop.streakReward.length} 场积分赛奖励的羽币（0 为关闭）`,type:'number',min:0,max:1000,step:1}],v=>({coins:Number(v.coins)}),`修改后只影响之后满 ${shop.streakReward.length} 场的奖励，已经发出的连续到场奖励不变。`);
 return <div className="treasure-shop">
  <header className="ts-header"><h1>羽林宝阁</h1><div className="ts-wallet" aria-label={'我的羽币余额 '+count(shop.balance)} title="羽币来自活动奖励或群主发放，用于兑换礼品；不影响排行积分与修为。"><Coins size={18} aria-hidden="true"/><strong>{count(shop.balance)}</strong><span>羽币</span></div></header>
  <RewardRules policy={shop.rewardPolicy} pendingCorrection={shop.pendingCorrection} streak={shop.streakReward} onEditStreak={shop.streakReward.canEdit?editStreak:undefined}/>
  <div className="ts-catalog-heading"><h2><ShoppingBag size={20}/>兑换好物</h2><span>{catalog.length} 件商品</span></div>
  <div className="ts-filters" role="group" aria-label="商品类型">{([['all','全部'],['physical','实物礼品'],['digital','虚拟礼品']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
  {catalog.length?<div className="ts-products">{catalog.map(product=><ProductCard key={product.id} product={product} busy={busy} onOpen={()=>setSelectedId(product.id)}/>)}</div>:<div className="ts-empty"><Gift size={34} strokeWidth={1.25}/><strong>{products.some(p=>p.active)?'这一类还没有礼品':'好物正在准备中'}</strong><p>{owner?'添加商品、设置价格和库存，即可开放兑换。':'等群主上架好物，再来看看吧。'}</p>{owner&&<button type="button" className="secondary" disabled={busy} onClick={()=>editProduct()}><Plus size={17}/>添加商品</button>}</div>}
  <div className="ts-tools"><Disclosure label={'我的兑换 · '+ownOrders.length+' 笔'} className="ts-disclosure"><div className="ts-history">{ownOrders.length?ownOrders.map(order=><OrderRow key={order.id} order={order} busy={busy} name={playerName}/>):<p className="muted">还没有兑换记录，遇到喜欢的礼品再出手。</p>}</div></Disclosure>
  <Disclosure label="羽币明细" className="ts-disclosure"><div className="ts-ledger">{ownLedger.length?ownLedger.map(row=><LedgerRow key={row.id} row={row}/>):<p className="muted">暂无羽币收支记录。</p>}</div></Disclosure>
  {owner&&<Disclosure label={'群主管理'+(pending.length?' · '+pending.length+' 笔待处理':'')} className="ts-disclosure ts-management"><div className="ts-owner-heading"><h2>宝阁管理</h2><div className="actions"><button type="button" className="primary" disabled={busy} onClick={()=>editProduct()}><Plus size={17}/>添加商品</button><button type="button" className="secondary" disabled={busy||!walletPlayers.length} onClick={grant}><Coins size={17}/>调整羽币</button></div></div>
   <h3>商品与库存</h3><div className="ts-management-products">{products.length?products.map(p=><div className="ts-management-product" key={p.id}><div><strong>{p.name}</strong><small>{p.active?'已上架':'已下架'} · {count(p.price)} 羽币 · 库存 {count(p.stock)}</small></div><button type="button" className="secondary" disabled={busy} onClick={()=>editProduct(p)}>编辑</button></div>):<p className="muted">还没有商品。</p>}</div>
   <h3>待处理兑换 · {pending.length}</h3>{pending.length?pending.map(order=><OrderRow key={order.id} order={order} owner busy={busy} name={playerName} onHandle={handleOrder}/>):<p className="muted">当前没有待处理的兑换。</p>}
   <Disclosure label="已处理兑换"><div className="ts-history">{orders.filter(o=>o.status!=='pending').sort((a,b)=>b.updated-a.updated).map(order=><OrderRow key={order.id} order={order} owner busy={busy} name={playerName}/>)}{!orders.some(o=>o.status!=='pending')&&<p className="muted">暂无已处理记录。</p>}</div></Disclosure>
   <Disclosure label="球友羽币余额"><div className="ts-owner-wallets">{(shop.wallets??[]).map(wallet=><div key={wallet.playerId}><span>{playerName(wallet.playerId)}</span><div><strong>{count(wallet.balance)} 羽币</strong>{wallet.pendingCorrection>0&&<small>待校正 {count(wallet.pendingCorrection)} 羽币</small>}</div></div>)}</div></Disclosure>
  </Disclosure>}</div>
  {selectedProduct&&<ProductDetails key={selectedProduct.id} product={selectedProduct} balance={shop.balance} busy={busy} onClose={()=>setSelectedId(null)} onRedeem={(product,quantity)=>{setSelectedId(null);redeem(product,quantity)}}/>}
 </div>;
}

