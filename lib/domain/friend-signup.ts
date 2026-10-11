import {z} from 'zod';
import {applyCourtSignup} from './court-commands';
import {businessTimestamp} from './timestamp';
import {guestLevelInput} from './guest-commands';
import {fail,type State,type Account} from './types';

const common={bookingId:z.string().min(1).max(100),arrival:businessTimestamp,departure:businessTimestamp,note:z.string().max(500)};
const inputSchema=z.discriminatedUnion('mode',[
 z.object({...common,mode:z.literal('new'),name:z.string().trim().min(1).max(150),guestLevel:guestLevelInput.optional()}),
 z.object({...common,mode:z.literal('existing'),playerId:z.string().min(1).max(100)}),
]);
export function friendSignupCreatesProfile(input:unknown){return typeof input==='object'&&input!==null&&'mode' in input&&input.mode==='new'}

/** One atomic domain change: a failed signup must never leave an orphan profile. */
export async function applyFriendSignup(s:State,a:Account,action:string,input:unknown,now:number){
 if(action!=='friendSignup')return false;
 const p=inputSchema.parse(input),work=structuredClone(s),booking=work.bookings.find(b=>b.id===p.bookingId)??fail('场地时段不存在');
 if(now>=booking.end)fail('该场地时段已结束，不能添加接龙');
 let playerId:string;
 if(p.mode==='new'){
  playerId=crypto.randomUUID();work.players.push({id:playerId,ownerId:a.id,name:p.name,initialRating:1000,rating:1000,ratedGames:0,enabled:true,ratingReason:'代报名朋友',...(p.guestLevel?{guestLevels:[{at:0,level:p.guestLevel}]}:{})});
 }else{playerId=p.playerId;if(playerId===a.playerId)fail('请通过我的接龙修改本人报名')}
 await applyCourtSignup(work,a,'courtRegister',{bookingId:p.bookingId,playerId,arrival:p.arrival,departure:p.departure,note:p.note},now);
 work.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'friendSignup',reason:p.mode==='new'?'添加朋友并接龙':'代已有朋友接龙',changes:{mode:p.mode,bookingId:p.bookingId,playerId}});
 Object.assign(s,work);return true;
}
