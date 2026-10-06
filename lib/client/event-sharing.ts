import type {Event} from '../domain/types';

export type EventShareData = {title:string;text:string;url:string};
type ShareEvent = Pick<Event,'id'|'title'|'start'|'end'|'venue'|'status'|'deletedAt'|'mergedInto'>;
type SharePort = {share?:(data:EventShareData)=>Promise<void>;canShare?:(data:EventShareData)=>boolean};
const statusNames = {open:'报名中',locked:'报名锁定',live:'进行中',ended:'已结束',cancelled:'已取消'};
const date = (time:number)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Europe/Madrid',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(time);

/** Share only a short event invitation, never rosters, notes or account data. */
export function createEventShare(event:ShareEvent,clubName:string,origin:string):EventShareData|null {
 if(event.status==='draft'||event.deletedAt!==undefined||event.mergedInto)return null;
 const url = new URL('/',origin);
 url.searchParams.set('page','events');
 url.searchParams.set('event',event.id);
 url.searchParams.set('tab','signup');
 const title = `${clubName} · ${event.title}`;
 return {title,text:[title,`${date(event.start)} – ${date(event.end)}（马德里时间）`,event.venue,statusNames[event.status],'打开活动查看详情与接龙（需登录成员账号）'].join('\n'),url:url.href};
}

/** Must be called directly from the click handler to retain user activation. */
export async function shareEvent(data:EventShareData,port:SharePort):Promise<'shared'|'cancelled'|'fallback'> {
 try {
  if(!port.share||port.canShare&&!port.canShare(data))return 'fallback';
  await port.share(data);
  return 'shared';
 }catch(error){
  return error&&typeof error==='object'&&'name' in error&&error.name==='AbortError'?'cancelled':'fallback';
 }
}

export function eventShareTargets(data:EventShareData){
 const message = `${data.text}\n${data.url}`;
 return {
  whatsapp:`https://wa.me/?text=${encodeURIComponent(message)}`,
  telegram:`https://t.me/share/url?url=${encodeURIComponent(data.url)}&text=${encodeURIComponent(data.text)}`,
  email:`mailto:?subject=${encodeURIComponent(data.title)}&body=${encodeURIComponent(message)}`,
 };
}
