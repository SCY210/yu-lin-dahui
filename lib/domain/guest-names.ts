/** Guest nicknames, shared by the server and the friend signup form: one friend is signed up once per activity. */
/** Full-width and half-width forms, letter case and every space are ignored, so 「小 王」, 「小王 」 and 「ＡＭＹ」/「amy」 are
 * one nickname. */
export const guestNameKey=(name:string)=>name.normalize('NFKC').replace(/\s+/gu,'').toLocaleLowerCase('zh-CN');
export const duplicateGuestMessage='这位朋友已经在本场接龙了，要报其他场地请用“代朋友接龙”';
/** A friend who is already signed up for this activity under the same nickname, or as the same merged friend
 * (`guestFriendId`), is not added again. `except` leaves out the friend's own records, for a rename. */
export function guestAlreadySignedUp(s:{players:{id:string;name:string;guestEventId?:string;guestFriendId?:string}[];registrations:{eventId:string;playerId:string;status:string}[]},eventId:string,name:string,friendId?:string,except?:Set<string>){
 const key=guestNameKey(name);
 return s.players.some(p=>p.guestEventId===eventId&&!except?.has(p.id)&&(guestNameKey(p.name)===key||!!friendId&&p.guestFriendId===friendId)&&s.registrations.some(r=>r.eventId===eventId&&r.playerId===p.id&&r.status!=='cancelled'));
}
/** Loose nickname match for spotting likely duplicates: case, spaces and a trailing number ("aq", "AQ", "aq 2"). */
export const looseGuestName=(name:string)=>guestNameKey(name).replace(/\s+/g,'').replace(/\d+$/,'');
type SignupState={players:{id:string;name:string;guestEventId?:string}[];registrations:{eventId:string;playerId:string;status:string;sequence:number}[]};
/** A friend signed up more than once for one activity (before duplicates were refused), as 临时来宾 lists them: active
 * guest signups of this activity under one loose nickname. The first by signup order is kept; this is one of the others. */
export function duplicateGuestSignup(s:SignupState,eventId:string,playerId:string){
 const guest=(id:string)=>s.players.find(p=>p.id===id&&p.guestEventId===eventId);
 const me=guest(playerId);if(!me)return false;
 const same=s.registrations.filter(r=>r.eventId===eventId&&r.status!=='cancelled'&&guest(r.playerId)&&looseGuestName(guest(r.playerId)!.name)===looseGuestName(me.name)).sort((a,b)=>a.sequence-b.sequence);
 return same.length>1&&same[0].playerId!==playerId&&same.some(r=>r.playerId===playerId);
}
