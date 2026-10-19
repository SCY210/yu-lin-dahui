import {guestNameKey} from './guest-names';

/** One recorded friend is the group of their per-activity guest records: those sharing a merged `guestFriendId`, or,
 * before any merge, the same host and nickname. The server passes the stored owner as host; the view, where other
 * members' owners are hidden, passes the projected host player. */
export function friendKey(p:{id:string;name:string;guestFriendId?:string},host:string|undefined){return p.guestFriendId?'friend:'+p.guestFriendId:(host??'guest:'+p.id)+'|'+guestNameKey(p.name)}
