/** Client view of a friend brought by a member (projected as `guest` with the registrant's name in `guestHost`). */
type ViewPlayer={id:string;guest?:boolean;guestHost?:string;guestLevel?:number};
export function viewGuest(players:readonly ViewPlayer[],id:string){const p=players.find(p=>p.id===id);return p?.guest?p:undefined}
/** "阿羽的朋友", or '' for members. */
export function guestNote(players:readonly ViewPlayer[],id:string){const p=viewGuest(players,id);return p?(p.guestHost??'球友')+'的朋友':''}
