/** Guest nicknames, shared by the server and the friend signup form: one friend is signed up once per activity. */
export const guestNameKey=(name:string)=>name.trim().toLocaleLowerCase('zh-CN');
export const duplicateGuestMessage='这位朋友已经在本场接龙了，要报其他场地请用“代朋友接龙”';
/** A friend who is already signed up for this activity under the same nickname is not added again. */
export function guestAlreadySignedUp(s:{players:{id:string;name:string;guestEventId?:string}[];registrations:{eventId:string;playerId:string;status:string}[]},eventId:string,name:string){
 const key=guestNameKey(name);
 return s.players.some(p=>p.guestEventId===eventId&&guestNameKey(p.name)===key&&s.registrations.some(r=>r.eventId===eventId&&r.playerId===p.id&&r.status!=='cancelled'));
}
