'use client';
import {useState} from 'react';
import {Check,Coins,Gift,Minus,Package,Plus,ShoppingBag,Sparkles} from 'lucide-react';
import type {ClubData} from '../lib/contracts/club';
import type {CardContext} from './match-card';
import {choice,fmt,type Field} from './form-fields';
import Disclosure from './disclosure';
import './treasure-shop.css';

type Product=ClubData['treasureShop']['products'][number];
type Order=ClubData['treasureShop']['orders'][number];
type Ledger=ClubData['treasureShop']['ledger'][number];
type Props={data:ClubData;open:CardContext['open'];busy?:boolean;name?:(id:string)=>string};
const count=(n:number)=>new Intl.NumberFormat('zh-CN').format(n);
const statusName={pending:'待领取',fulfilled:'已完成',cancelled:'已取消'};
const productFields:Field[]=[{key:'name',label:'商品名称'},{key:'description',label:'商品介绍与领取说明',type:'textarea',required:false},choice('kind','商品类型',[['physical','实物礼品'],['digital','虚拟礼品']]),{key:'price',label:'兑换价格 · 羽币',type:'number',min:1,max:1000000,step:1},{key:'stock',label:'可兑换库存',type:'number',min:0,max:1000000,step:1},{key:'active',label:'上架商品',type:'checkbox'}];

function FeatherMark(){return <svg className="ts-feather" viewBox="0 0 160 160" fill="none" aria-hidden="true"><circle cx="80" cy="80" r="62" stroke="currentColor" opacity=".18"/><circle cx="80" cy="80" r="48" stroke="currentColor" strokeDasharray="2 9" opacity=".4"/><g stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"><path d="M61 103 43 44 61 50 75 39 88 50 106 45 93 103Z"/><path d="m61 50 7 53m7-64 2 64m11-53-5 53m-29-37 44 0m-39 15h34" opacity=".6"/><path d="M61 103h32v10c0 11-32 11-32 0Z"/></g><path d="m117 103 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="currentColor" opacity=".65"/></svg>}


function ProductCard({product,balance,busy,onRedeem}:{product:Product;balance:number;busy:boolean;onRedeem:(product:Product,quantity:number)=>void}){
 const [quantity,setQuantity]=useState(1),max=Math.min(product.stock,99),selected=Math.min(quantity,Math.max(1,max)),total=product.price*selected,available=product.active&&max>0,affordable=balance>=total;
 return <article className={'ts-product'+(!available?' ts-product-unavailable':'')}>
  <div className="ts-product-art" aria-hidden="true">{product.kind==='physical'?<Gift size={42} strokeWidth={1.25}/>:<Sparkles size={42} strokeWidth={1.25}/>}<span className="ts-art-orbit"/></div>
  <div className="ts-product-body"><div className="ts-product-meta"><span>{product.kind==='physical'?'实物礼品':'虚拟礼品'}</span><span>{!product.active?'已下架':product.stock>0?'剩余 '+count(product.stock)+' 件':'暂时兑完'}</span></div><h3>{product.name}</h3><p className="ts-product-description">{product.description}</p>
  <div className="ts-price"><Coins size={18}/><strong>{count(product.price)}</strong><span>羽币 / 件</span></div>
  {available&&<div className="ts-quantity-row"><span>兑换数量</span><div className="ts-stepper" role="group" aria-label={product.name+'兑换数量'}><button type="button" aria-label={'减少'+product.name+'数量'} disabled={busy||selected<=1} onClick={()=>setQuantity(selected-1)}><Minus size={15}/></button><output aria-label="当前数量">{selected}</output><button type="button" aria-label={'增加'+product.name+'数量'} disabled={busy||selected>=max} onClick={()=>setQuantity(selected+1)}><Plus size={15}/></button></div></div>}
  <button type="button" className="primary ts-redeem" disabled={busy||!available||!affordable} onClick={()=>onRedeem(product,selected)}>{!product.active?'已下架':!available?'库存已兑完':!affordable?'羽币不足':'兑换 · '+count(total)+' 羽币'}</button></div>
 </article>;
}

function OrderRow({order,owner,busy,name,onHandle}:{order:Order;owner?:boolean;busy:boolean;name:(id:string)=>string;onHandle?:(order:Order,status:'fulfilled'|'cancelled')=>void}){return <article className="ts-order"><div className="ts-order-main"><span className="ts-order-icon" aria-hidden="true"><Package size={20}/></span><div><strong>{order.productName}</strong><small>{owner?name(order.playerId)+' · ':''}{order.quantity} 件 · {count(order.total)} 羽币</small><small>{fmt(order.created)}</small></div><span className={'ts-order-status ts-order-status-'+order.status}>{statusName[order.status]}</span></div>{order.status==='pending'&&<div className="ts-order-next">{owner?<div className="ts-order-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>onHandle?.(order,'fulfilled')}><Check size={15}/>确认完成</button><button type="button" className="ghost" disabled={busy} onClick={()=>onHandle?.(order,'cancelled')}>取消并退还羽币</button></div>:<span>{order.kind==='physical'?'兑换成功，请联系群主安排领取。':'兑换成功，等待群主为你安排。'}</span>}</div>}{order.status==='cancelled'&&<p className="ts-order-note">羽币已退回，库存已恢复。</p>}</article>}

export default function TreasureShop({data,open,busy=false,name}:Props){
 const [filter,setFilter]=useState<'all'|'physical'|'digital'>('all');
 const shop=data.treasureShop,owner=!!data.me.isOwner,ownId=data.me.playerId,playerName=name??((id:string)=>data.players.find(p=>p.id===id)?.name??'已移除球友');
 const products:Product[]=shop.products,orders:Order[]=shop.orders,ledger:Ledger[]=shop.ledger;
 const catalog=products.filter(p=>p.active&&(filter==='all'||p.kind===filter));
 const ownOrders=orders.filter(o=>o.playerId===ownId).sort((a,b)=>b.created-a.created||b.id.localeCompare(a.id));
 const ownLedger=ledger.filter(l=>l.playerId===ownId).sort((a,b)=>b.at-a.at||b.id.localeCompare(a.id));
 const walletPlayers=owner?data.players.filter(p=>shop.wallets.some(wallet=>wallet.playerId===p.id)):[];
 const pending=orders.filter(o=>o.status==='pending').sort((a,b)=>a.created-b.created||a.id.localeCompare(b.id));
 const editProduct=(p?:Product)=>open(p?'编辑商品':'添加商品','treasureProduct',p?{id:p.id,expectedVersion:p.version??0,name:p.name,description:p.description,kind:p.kind,price:p.price,stock:p.stock,active:p.active}:{name:'',description:'',kind:'physical',price:10,stock:1,active:true},productFields,v=>({...v.id?{id:v.id,expectedVersion:v.expectedVersion}:{},name:v.name,description:v.description,kind:v.kind,price:v.price,stock:v.stock,active:v.active}),'价格使用整数羽币。库存是当前可兑换数量；下架后不再开放新兑换，已有兑换记录会保留。虚拟礼品也由群主安排发放。');
 const redeem=(p:Product,quantity:number)=>open('确认兑换','treasureRedeem',{productId:p.id,quantity,expectedPrice:p.price},[],v=>({productId:v.productId,quantity:v.quantity,expectedPrice:v.expectedPrice}),`兑换「${p.name}」${quantity} 件，共 ${count(p.price*quantity)} 羽币。当前余额 ${count(shop.balance)} 羽币，兑换后剩余 ${count(shop.balance-p.price*quantity)} 羽币。${p.kind==='physical'?'实物礼品由群主安排领取。':'虚拟礼品由群主安排发放。'}`);
 const handleOrder=(o:Order,status:'fulfilled'|'cancelled')=>open(status==='fulfilled'?'确认礼品已完成':'取消兑换并退款','treasureOrder',{id:o.id,status},[],v=>({id:v.id,status:v.status}),status==='fulfilled'?`确认已向 ${playerName(o.playerId)} 发放「${o.productName}」${o.quantity} 件？完成后将保留兑换记录。`:`取消 ${playerName(o.playerId)} 的「${o.productName}」${o.quantity} 件，退回 ${count(o.total)} 羽币并恢复库存。`);
 const grant=()=>open('调整球友羽币','treasureGrant',{playerId:'',operation:'add',amount:10,adjustmentReason:''},[choice('playerId','球友',walletPlayers.map(p=>[p.id,p.name])),choice('operation','操作',[['add','发放羽币'],['subtract','扣除羽币']]),{key:'amount',label:'羽币数量（整数）',type:'number',min:1,max:1000000,step:1},{key:'adjustmentReason',label:'调整原因',type:'textarea',required:true}],v=>({playerId:v.playerId,amount:(v.operation==='subtract'?-1:1)*Number(v.amount),reason:String(v.adjustmentReason??'').trim()}),'只允许群主操作，原因会出现在球友自己的羽币明细中。羽币独立于排行积分和修为，余额不能扣成负数。');
 return <div className="treasure-shop">
  <section className="ts-hero"><div><span className="ts-eyebrow">羽林好物 · 以币换礼</span><h1>羽林宝阁</h1><p>把一起打球的快乐，换成一份小礼物。</p><div className="ts-wallet"><Coins size={24}/><span><small>我的羽币</small><strong>{count(shop.balance)}</strong></span></div></div><FeatherMark/></section>
  <p className="ts-wallet-hint">羽币由群主发放，用于兑换礼品；不影响排行积分与修为。</p>
  <div className="ts-catalog-heading"><h2><ShoppingBag size={20}/>兑换好物</h2><span>{catalog.length} 件商品</span></div>
  <div className="ts-filters" role="group" aria-label="商品类型">{([['all','全部'],['physical','实物礼品'],['digital','虚拟礼品']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}</button>)}</div>
  {catalog.length?<div className="ts-products">{catalog.map(product=><ProductCard key={product.id} product={product} balance={shop.balance} busy={busy} onRedeem={redeem}/>)}</div>:<div className="ts-empty"><Gift size={34} strokeWidth={1.25}/><strong>{products.some(p=>p.active)?'这一类还没有礼品':'好物正在准备中'}</strong><p>{owner?'添加商品、设置价格和库存，即可开放兑换。':'等群主上架好物，再来看看吧。'}</p>{owner&&<button type="button" className="secondary" disabled={busy} onClick={()=>editProduct()}><Plus size={17}/>添加商品</button>}</div>}
  <Disclosure label={'我的兑换 · '+ownOrders.length+' 笔'} className="ts-disclosure"><div className="ts-history">{ownOrders.length?ownOrders.map(order=><OrderRow key={order.id} order={order} busy={busy} name={playerName}/>):<p className="muted">还没有兑换记录，遇到喜欢的礼品再出手。</p>}</div></Disclosure>
  <Disclosure label="羽币明细" className="ts-disclosure"><div className="ts-ledger">{ownLedger.length?ownLedger.map(row=><div className="ts-ledger-row" key={row.id}><div><strong>{row.reason}</strong><small>{fmt(row.at)}</small></div><div><b className={row.delta>0?'ts-credit':''}>{row.delta>0?'+':''}{count(row.delta)}</b><small>余额 {count(row.balance)}</small></div></div>):<p className="muted">暂无羽币收支记录。</p>}</div></Disclosure>
  {owner&&<Disclosure label={'群主管理'+(pending.length?' · '+pending.length+' 笔待处理':'')} className="ts-disclosure ts-management"><div className="ts-owner-heading"><h2>宝阁管理</h2><div className="actions"><button type="button" className="primary" disabled={busy} onClick={()=>editProduct()}><Plus size={17}/>添加商品</button><button type="button" className="secondary" disabled={busy||!walletPlayers.length} onClick={grant}><Coins size={17}/>调整羽币</button></div></div>
   <h3>商品与库存</h3><div className="ts-management-products">{products.length?products.map(p=><div className="ts-management-product" key={p.id}><div><strong>{p.name}</strong><small>{p.active?'已上架':'已下架'} · {count(p.price)} 羽币 · 库存 {count(p.stock)}</small></div><button type="button" className="secondary" disabled={busy} onClick={()=>editProduct(p)}>编辑</button></div>):<p className="muted">还没有商品。</p>}</div>
   <h3>待处理兑换 · {pending.length}</h3>{pending.length?pending.map(order=><OrderRow key={order.id} order={order} owner busy={busy} name={playerName} onHandle={handleOrder}/>):<p className="muted">当前没有待处理的兑换。</p>}
   <Disclosure label="已处理兑换"><div className="ts-history">{orders.filter(o=>o.status!=='pending').sort((a,b)=>b.updated-a.updated).map(order=><OrderRow key={order.id} order={order} owner busy={busy} name={playerName}/>)}{!orders.some(o=>o.status!=='pending')&&<p className="muted">暂无已处理记录。</p>}</div></Disclosure>
   <Disclosure label="球友羽币余额"><div className="ts-owner-wallets">{(shop.wallets??[]).map(wallet=><div key={wallet.playerId}><span>{playerName(wallet.playerId)}</span><strong>{count(wallet.balance)} 羽币</strong></div>)}</div></Disclosure>
  </Disclosure>}
 </div>;
}

