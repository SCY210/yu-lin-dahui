'use client';
import {useState} from 'react';
import GiftPopup from '../../app/gift-popup';
import TreasureShop from '../../app/treasure-shop';
import {fixtureData} from './treasure-shop-preview';

const names=['清风传意','同心玉佩','金兰灵契'],prices=[10,30,80];
/** Synthetic browser fixture. No production requests, account changes or real gift purchases. */
export default function GiftArtPreview(){
 const [selected,setSelected]=useState<number|null>(null),[ack,setAck]=useState(0),data=fixtureData('member');
 data.treasureShop.products=names.map((name,i)=>({id:'art-'+i,name,description:'虚构图标与收礼动效验收：礼物即时送达，羽币与缘值一比一。',price:prices[i],stock:99,kind:'gift',active:true,created:0,updated:0}));
 const notices=selected===null?[]:[{id:'art-notice-'+selected,fromPlayerId:'friend',coins:0,item:names[selected]+' × 1',value:prices[selected],affinity:prices[selected],instant:true,message:'愿下次并肩，仍是好搭档。',at:1}];
 return <main className="shell"><div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>{names.map((name,i)=><button type="button" className="secondary" key={name} onClick={()=>setSelected(i)}>收礼：{name}</button>)}</div><output aria-label="已确认礼物数量">{ack}</output><TreasureShop data={data} open={()=>{}}/><GiftPopup notices={notices} name={()=>'虚构球友'} busy={false} blocked={false} acknowledge={async ids=>{setAck(n=>n+ids.length);setSelected(null)}}/></main>;
}
