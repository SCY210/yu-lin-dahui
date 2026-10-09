'use client';
import {eventFormat,formatLabel} from '../lib/domain/match-format';
type EditForm={eventId:string;matchFormat:'singles'|'doubles';venue:string;address:string;capacity:number;cancelDeadline:string;note:string};
import Disclosure from './disclosure';
import Deferred from './deferred';
import EventCourtSignup from './event-court-signup';
import EventLivePlay from './event-live-play';
import {useActivityClock} from '../lib/client/use-activity-clock';
import {eventStatusAt} from '../lib/domain/event-lifecycle';
import {canManageEvent} from '../lib/domain/permissions';
import {lazy} from 'react';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {ChevronLeft,Clock,MapPin,Trash2} from 'lucide-react';
import {Pick,fmt,hm,dt,text,number,why,labels,choice} from './ui';
const Fees=lazy(()=>import('./fees'));
const EventSocial=lazy(()=>import('./event-social'));
const EventShuttles=lazy(()=>import('./event-shuttles'));
const EventPointsPlan=lazy(()=>import('./event-points-plan'));
import {cancellationDeadline} from '../lib/domain/cancellation';
import './event-registration.css';
import './event-overview-signup.css';
import FeatureGuide from './feature-guide';
import {month} from '../lib/domain/types';
import {findVenue,googleMapsUrl} from '../lib/venues';
import {plannedEpoch} from '../lib/time-planning';
export default function EventView({e,ctx,tab,setTab,back}:any){const {data,open,send,setDanger}=ctx;
const clock=useActivityClock(e);e={...e,status:eventStatusAt(e,clock)};
const activityTab=tab==='overview'?'signup':tab==='matches'?'rounds':tab;
const manager=canManageEvent(data.me,e);const eventRules=data.seasons.find((s:any)=>s.id===month(e.start))?.rules??data.settings.rules;
const venueAddress=findVenue(e.venue)?.address||e.address||'';
return <><div className="event-toolbar"><button className="ghost" onClick={back}><ChevronLeft size={18}/> 全部活动</button>{manager&&<Disclosure label="管理活动"><button type="button" className="ghost danger" onClick={()=>setDanger({action:'deleteEvent',payload:{eventId:e.id},title:'删除活动「'+e.title+'」',description:'活动及其接龙、分组、费用将从列表移除。已完成比赛的历史战绩与积分保留，可从活动页的“已删除活动”恢复。',reason:'删除活动'})}><Trash2 size={17}/>删除活动</button></Disclosure>}</div><div className="event-heading"><p className="eyebrow">{fmt(e.start,{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p><h1>{e.title}</h1><div className="meta"><span><Clock size={17}/>{hm(e.start)}–{hm(e.end)}</span><a href={e.mapUrl??googleMapsUrl(e.venue,venueAddress)} target="_blank" rel="noopener noreferrer" className="venue-heading-link"><MapPin size={17}/>{e.venue}<span>地图导航</span></a><span className="badge">{formatLabel(eventFormat(e))}</span><span className="badge">{labels[e.status]}</span></div></div><Tabs value={activityTab} onValueChange={setTab}><TabsList className="event-tabs" variant="line">{[['signup','活动接龙'],['rounds','分组 / 比赛'],['fees','费用'],['social','玩法']].map(([v,l])=><TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}</TabsList></Tabs><div className={activityTab==='signup'?'event-guides-empty':'feature-actions'}>{(tab==='rounds'||tab==='matches')&&<><FeatureGuide rules={eventRules} topic="grouping" label="分组规则"/><FeatureGuide rules={eventRules} topic="matches" label="比分与计分"/></>}{tab==='social'&&<><FeatureGuide rules={eventRules} topic="modes" label="玩法规则"/><FeatureGuide rules={eventRules} topic="titles" label="最佳球员与称号"/></>}</div>
{activityTab==='signup'&&<div className="ev-combined"><EventCourtSignup e={e} ctx={ctx} rules={eventRules}/><details className="ev-details"><summary>用球与搭档方式</summary><div className="ev-details-content"><Deferred><EventShuttles e={e} ctx={ctx}/></Deferred><Deferred><EventPointsPlan e={e} ctx={ctx}/></Deferred></div></details><details className="ev-details"><summary>活动详情</summary><div className="ev-details-content"><dl className="ev-deadlines"><div><dt>自由取消截止</dt><dd>{fmt(cancellationDeadline(e))}</dd></div></dl><section className="card"><div className="row"><h3>活动说明</h3>{manager&&<button className="ghost" onClick={()=>open('编辑活动','eventEdit',{eventId:e.id,matchFormat:eventFormat(e),venue:e.venue,address:e.address,navigationUrl:e.mapUrl,navigationVenue:e.venue,capacity:e.capacity,cancelDeadline:dt(e.cancelDeadline),note:e.note,reason:''},[choice('matchFormat','比赛类型',[['doubles','双打'],['singles','单打']]),{key:'venue',label:'球馆',type:'venue'},number('capacity','未单独设置的场地默认上限'),text('note','备注'),why],(v:EditForm)=>({...v,cancelDeadline:plannedEpoch(v.cancelDeadline,e.cancelDeadline)}))}>编辑</button>}</div><p className="prewrap">{e.note||'一起打球，请按时到场。'}</p><a className="venue-address" href={e.mapUrl??googleMapsUrl(e.venue,venueAddress)} target="_blank" rel="noopener noreferrer"><MapPin size={17}/><span>{venueAddress||e.venue}<small>打开地图导航</small></span></a>{manager&&<Pick value={e.status} options={Object.entries(labels).filter(([k])=>['draft','open','locked','live','ended','cancelled'].includes(k))} onChange={(status:string)=>send('eventStatus',{eventId:e.id,status})}/>}</section></div></details><details className="ev-details"><summary>带朋友参加</summary><div className="ev-details-content"><section className="card"><h3>带一位朋友</h3><p className="muted">朋友有独立档案、名额、比赛和费用分摊，代报名朋友不进入排行榜。你、活动创建者与管理员可管理其报名。</p><button className="secondary" onClick={()=>open('添加朋友档案','friend',{name:''},[text('name','朋友昵称')])}>添加朋友</button></section></div></details></div>}
{(tab==='rounds'||tab==='matches')&&<EventLivePlay e={e} ctx={ctx}/>}
{tab==='fees'&&<Deferred><Fees e={e} ctx={ctx}/></Deferred>}
{tab==='social'&&<Deferred><EventSocial e={e} ctx={ctx}/></Deferred>}</>}
