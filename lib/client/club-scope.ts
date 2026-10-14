/** A scoped response replaces the current workspace; it must never masquerade as a full club on another route. */
export function requestedActivity(page:string,eventId?:string){return page==='events'&&eventId?eventId:''}
export function scopePending(data:{activityScope?:string}|null,activityId:string){return !!data?.activityScope&&data.activityScope!==activityId}
export function validResponseScope(data:{activityScope?:string},activityId:string){return !data.activityScope||data.activityScope===activityId}
export function clubRefreshVersion(value:unknown){
 if(!value||typeof value!=='object')return null;
 const data=value as {revision?:number;activityScope?:string;me?:{id?:string}};
 return Number.isSafeInteger(data.revision)&&data.me?.id?JSON.stringify([data.me.id,data.activityScope??'',data.revision]):null;
}
