import {z} from 'zod';
import {applyCourtSignup} from './court-commands';
import {activityAcknowledgementInput} from './activity-acknowledgement';
import {businessTimestamp} from './timestamp';
import {guestGenderInput,guestLevelInput} from './guest-commands';
import {isGuest} from './guests';
import {duplicateGuestMessage,guestAlreadySignedUp} from './guest-names';
import {fail,type State,type Account,type Player} from './types';

const common={...activityAcknowledgementInput,bookingId:z.string().min(1).max(100),arrival:businessTimestamp,departure:businessTimestamp,note:z.string().max(500)};
const inputSchema=z.discriminatedUnion('mode',[
 z.object({...common,mode:z.literal('new'),name:z.string().trim().min(1).max(150),gender:guestGenderInput,guestLevel:guestLevelInput.optional()}),
 z.object({...common,mode:z.literal('existing'),playerId:z.string().min(1).max(100)}),
 z.object({...common,mode:z.literal('saved'),sourcePlayerId:z.string().min(1).max(100)}),
]);
export function friendSignupCreatesGuest(input:unknown){return typeof input==='object'&&input!==null&&'mode' in input&&(input.mode==='new'||input.mode==='saved')}
/** The latest level chosen for a guest, falling back to the level they were created with. */
export const latestGuestLevel=(p:Pick<Player,'guestLevels'|'rating'>)=>p.guestLevels?.at(-1)?.level??p.rating;

/** One atomic domain change: a failed signup must never leave an orphan profile. */
export async function applyFriendSignup(s:State,a:Account,action:string,input:unknown,now:number){
 if(action!=='friendSignup')return false;
 const p=inputSchema.parse(input),work=structuredClone(s),booking=work.bookings.find(b=>b.id===p.bookingId)??fail('场地时段不存在');
 if(now>=booking.end)fail('该场地时段已结束，不能添加接龙');
 let playerId:string;
 if(p.mode!=='existing'&&guestAlreadySignedUp(work,booking.eventId,p.mode==='new'?p.name:work.players.find(x=>x.id===p.sourcePlayerId)?.name??''))fail(duplicateGuestMessage);
 if(p.mode==='saved'){
  // A friend brought before: copy their nickname, gender and latest level into a guest of this activity. The member
  // who first brought them stays responsible for their share. Members reuse their own friends; admins any friend.
  const source=work.players.find(x=>x.id===p.sourcePlayerId&&isGuest(work,x.id))??fail('这位朋友不存在');
  if(source.ownerId!==a.id&&a.role!=='admin')fail('403: 只能选择自己带过的朋友');
  const level=latestGuestLevel(source);
  playerId=crypto.randomUUID();work.players.push({id:playerId,ownerId:source.ownerId,name:source.name,guestEventId:booking.eventId,initialRating:level,rating:level,ratedGames:0,enabled:true,ratingReason:'本次活动临时来宾',...(source.guestGender?{guestGender:source.guestGender}:{}),guestLevels:[{at:0,level}]});
 }else if(p.mode==='new'){
  playerId=crypto.randomUUID();work.players.push({id:playerId,ownerId:a.id,name:p.name,guestEventId:booking.eventId,initialRating:p.guestLevel??1000,rating:p.guestLevel??1000,ratedGames:0,enabled:true,ratingReason:'本次活动临时来宾',guestGender:p.gender,...(p.guestLevel?{guestLevels:[{at:0,level:p.guestLevel}]}:{})});
 }else{playerId=p.playerId;if(playerId===a.playerId)fail('请通过我的接龙修改本人报名')}
 await applyCourtSignup(work,a,'courtRegister',{bookingId:p.bookingId,playerId,arrival:p.arrival,departure:p.departure,note:p.note,noticeAccepted:p.noticeAccepted,noticeVersion:p.noticeVersion},now);
 work.audits.push({id:crypto.randomUUID(),at:now,actor:a.id,action:'friendSignup',reason:p.mode==='new'?'添加本次活动临时来宾':p.mode==='saved'?'带以前的朋友来本次活动':'代已有朋友接龙',changes:{mode:p.mode,bookingId:p.bookingId,playerId,...(p.mode==='saved'?{sourcePlayerId:p.sourcePlayerId}:{})}});
 Object.assign(s,work);return true;
}
