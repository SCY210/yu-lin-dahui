import type {Account,Player,State} from './types';

/** Levels a registrant can pick for a friend they bring. The level is a fixed rating: it balances teams and is the
 * strength members are rated against, but a friend never gains or loses rating or season points. */
export const guestLevels=[[850,'刚入门'],[1000,'一般'],[1150,'较强'],[1300,'很强']] as const;
export const defaultGuestLevel=1000;
export const guestLevelValues:readonly number[]=guestLevels.map(([value])=>value);
export function guestLevelLabel(value:number|undefined){return guestLevels.find(([v])=>v===(value??defaultGuestLevel))?.[1]??'一般'}

type GuestState={players:Pick<Player,'id'|'ownerId'|'guestLevels'|'guestEventId'>[];accounts?:Pick<Account,'id'|'playerId'>[]};
/** The friend's level at a time: the last change made before it, or the default. A change only affects later games. */
export function guestLevelAt(p:Pick<Player,'guestLevels'>,at=Infinity){let level=defaultGuestLevel,latest=-Infinity;for(const x of p.guestLevels??[])if(x.at<=at&&x.at>=latest){level=x.level;latest=x.at}return level}
/** A friend brought by a member: a player without an account of their own, owned by another member's account.
 * Members become regular players (profile, rating, points) once they have their own account. */
export function guestIds(s:GuestState){
 const own=new Set(s.accounts?.map(a=>a.playerId)),owners=new Set(s.accounts?.map(a=>a.id));
 return new Set(s.players.filter(p=>!own.has(p.id)&&(p.guestEventId||owners.has(p.ownerId))).map(p=>p.id));
}
export function isGuest(s:GuestState,playerId:string){return guestIds(s).has(playerId)}
/** All guests, by player id, with their level history. */
export function guestRatings(s:GuestState){
 const guests=guestIds(s);
 return new Map(s.players.filter(p=>guests.has(p.id)).map(p=>[p.id,(at?:number)=>guestLevelAt(p,at)]));
}
/** The member who brought this friend, for "X 的朋友". */
export function guestHostName(s:Pick<State,'players'|'accounts'>,playerId:string){
 const owner=s.players.find(p=>p.id===playerId)?.ownerId,host=s.accounts.find(a=>a.id===owner);
 return host?s.players.find(p=>p.id===host.playerId)?.name:undefined;
}
