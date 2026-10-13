'use client';
import {useState} from 'react';
import TreasureShop from '../../app/treasure-shop';
import {Forms} from '../../app/ui';
import type {Form} from '../../app/form-fields';
import type {ClubData} from '../../lib/contracts/club';
import {emptyState,type Account} from '../../lib/domain/types';
import {projectClubState} from '../../lib/club-view';
import {applyTreasure,treasureGrant,treasureProduct,treasureRedeem} from '../../lib/domain/treasure-shop';

const now=1791712800000;
type Mode='owner'|'member'|'admin';
function initialState(){
 const s=emptyState();s.settings.initialized=true;s.settings.ownerAccountId='fixture-owner';
 for(const [i,role]of ['admin','member','admin'].entries()){
  const id=['fixture-owner','fixture-member','fixture-admin'][i],playerId='fixture-player-'+i;
  s.accounts.push({id,playerId,role:role as Account['role'],email:''});
  s.players.push({id:playerId,name:['虚构群主甲','虚构球友乙','虚构管理员丙'][i],ownerId:id,enabled:true,initialRating:1000,rating:1000,ratedGames:0,ratingReason:''});
 }
 const owner=s.accounts[0];
 for(const player of s.players)treasureGrant(s,owner,{playerId:player.id,amount:120,reason:'虚构测试发放',requestId:crypto.randomUUID()},now);
 treasureProduct(s,owner,{name:'虚构礼品 · 羽毛球挂件',description:'原创羽毛球小挂件。领取时间请联系群主确认。',price:20,stock:8,kind:'physical',active:true},now);
 treasureProduct(s,owner,{name:'虚构礼品 · 网前小霸王称号',description:'专属趣味称号，由群主安排发放。',price:60,stock:5,kind:'digital',active:true},now);
 treasureProduct(s,owner,{name:'虚构礼品 · 已兑完毛巾',description:'库存为零，不可继续兑换。',price:40,stock:0,kind:'physical',active:true},now);
 treasureProduct(s,owner,{name:'虚构礼品 · 库存保留款',description:'此商品未上架，仅群主可见。',price:80,stock:3,kind:'physical',active:false},now);
 for(const a of s.accounts)treasureRedeem(s,a,{productId:s.treasureProducts[0].id,quantity:1,expectedPrice:20,requestId:crypto.randomUUID()},now+60000);
 return s;
}
const actorFor=(s:ReturnType<typeof initialState>,mode:Mode)=>s.accounts[mode==='owner'?0:mode==='member'?1:2];
function projection(s:ReturnType<typeof initialState>,mode:Mode):ClubData{const a=actorFor(s,mode),isOwner=mode==='owner';return {...projectClubState(s,a,'2026-10',2026,now+120000),accountNotice:{required:false,currentVersion:'local-preview',contentHash:'',acceptedAt:null,acceptedVersion:null,currentConfirmed:false,receipts:[]},loginAccounts:[],auth:{method:'password',username:mode,passwordEnabled:true,isOwner,canChangeUsername:true,usernameChangedAt:null}}}
export function fixtureData(mode:Mode='owner'){return projection(initialState(),mode)}

/** Synthetic local fixture only: no fetch, credentials, or live persistence. */
export default function Preview({mode='owner',busy=false,fail=false,onOpen,onAction}:{mode?:Mode;busy?:boolean;fail?:boolean;onOpen?:(form:Form)=>void;onAction?:(action:string,payload:Record<string,unknown>)=>void}){
 const [state,setState]=useState(initialState),[form,setForm]=useState<Form|null>(null),[error,setError]=useState(''),[saved,setSaved]=useState('');
 const data=projection(state,mode);
 const open=(title:string,action:string,values:Record<string,unknown>,fields:Form['fields'],convert?:Form['convert'],description?:string)=>{const f={title,action,values,fields,convert,description};setError('');setSaved('');setForm(f);onOpen?.(f)};
 const action=async(command:string,payload:Record<string,unknown>)=>{
  onAction?.(command,payload);
  if(fail){setError('虚构测试：保存失败，请稍后重试。');throw Error('Fixture failure')}
  const next=structuredClone(state),input=['treasureGrant','treasureRedeem'].includes(command)?{...payload,requestId:crypto.randomUUID()}:payload;
  try{applyTreasure(next,actorFor(next,mode),command,input,now+180000);setState(next);setForm(null);setSaved('虚构操作已保存。')}catch(e){setError(e instanceof Error?e.message:'Fixture failure');throw e}
 };
 return <main className="shell app-compact"><p className="hint">羽林宝阁 · 本地虚构验收（不访问线上数据）</p>{error&&<p role="alert" className="error">{error}</p>}{saved&&<p role="status">{saved}</p>}<TreasureShop data={data} open={open} busy={busy}/><Forms form={form} setForm={setForm} danger={null} setDanger={()=>{}} busy={busy} action={action}/></main>;
}
