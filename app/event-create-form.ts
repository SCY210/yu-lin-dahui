import {ceilHalfHour} from '../lib/time-planning';
import {mergeCourtSlots} from '../lib/domain/booking-advancers';
import {fitParts,partsFit,rowParts,type CourtRow} from './court-parts-model';
import {dt,epoch,choice,halfTimed,number,text,money,type Form} from './form-fields';
/** members: [playerId, name] of members with an account, who can book courts and buy balls. */
export function newEventForm(now:number,tournament=false,canRank=false,members:string[][]=[]):Form{
 const start=ceilHalfHour(now+86400000),end=start+3*3600000,practice={key:'matchFormat',value:'practice'};
 return {title:tournament?'创建比赛':'创建活动',action:'event',values:{tournament,ranking:canRank?'ranked':'ordinary',matchFormat:'doubles',...(tournament?{category:'mens-doubles'}:{}),venue:'',address:'',start:dt(start),end:dt(end),capacity:16,cancelDeadline:dt(start-86400000),note:'',status:'open',courts:[{name:'1号场',start:dt(start),end:dt(end),advancedBy:''}],courtPrice:6.9,practiceShuttleCents:200,practiceBallCount:0,practiceBallBy:''},
 // A competition picks its category; singles or doubles follows from it (lib/domain/tournament.ts).
 fields:[tournament?choice('category','比赛项目',[['singles','单打 · 不限性别'],['mens-singles','男单'],['mens-doubles','男双 · 固定搭档'],['mixed-doubles','混双 · 一男一女固定搭档']]):choice('matchFormat','活动类型',[['doubles','双打 · 每方2人'],['singles','单打 · 每方1人'],['practice','练球 · 专项练习']]),
  ...(canRank?[choice('ranking','单打 / 双打计分（练球不计分）',[['ranked','积分赛 · 计入积分与修为'],['ordinary','普通活动 · 不计积分与修为']])]:[]),
  {key:'venue',label:'球馆',type:'venue'},halfTimed('start','开始'),halfTimed('end','结束'),number('capacity','接龙人数上限'),
  {key:'courts',label:'场地时段与约场人',type:'court-bookings',options:members},
  {key:'courtPrice',label:'每小时场地价格 · 欧元',type:'price-stepper',step:0.1,min:0},
  {...text('note','活动说明 / 具体练习内容'),type:'textarea',optional:true,requiredWhen:practice},
  {...money('practiceShuttleCents','单颗球价 · 欧元'),min:0,when:practice},
  {...number('practiceBallCount','耗球数量（可后补，未使用填 0）'),min:0,max:10000,when:practice},
  {...choice('practiceBallBy','练球用球是谁的（球费由他垫付）',members),when:practice},
  {...choice('status','状态',[['open','开放报名'],['draft','草稿']]),optional:true}],
 convert:v=>{const {courts,courtPrice,practiceShuttleCents,practiceBallCount,practiceBallBy,ranking,category,...rest}=v,start=epoch(v.start),end=epoch(v.end);
  if(tournament){rest.matchFormat=['singles','mens-singles'].includes(category)?'singles':'doubles';if(category!=='singles')rest.category=category}
  // Each court's parts as they fit its time; every part needs the member who booked it.
  const rows=(courts as CourtRow[]).map(r=>({...r,parts:fitParts(r.start,r.end,rowParts(r))}));
  if(rows.some(r=>r.parts.some(p=>!p.advancedBy)))throw new Error('请为每个场地、每一段选择是谁约的');
  if(rows.some(r=>!partsFit(r.start,r.end,r.parts)))throw new Error('每一段至少 1 小时，请拖动分界点调整');
  if(v.matchFormat==='practice'&&practiceBallCount>0&&!practiceBallBy)throw new Error('请选择练球用球是谁的');
  return {...rest,ranked:v.matchFormat!=='practice'&&canRank&&ranking==='ranked',start,end,cancelDeadline:epoch(v.cancelDeadline),...(v.matchFormat==='practice'?{practiceShuttleCents,practiceBallCount,...(practiceBallBy?{practiceBallBy}:{})}:{}),
   // Slots of one court that follow each other become one slot with one sign-up list; later bookers are handovers.
   bookings:mergeCourtSlots(rows.map(r=>({name:r.name.trim()||'1号场',start:epoch(r.start),end:epoch(r.end),pricing:'hourly' as const,cents:Math.round(courtPrice*100),signupCapacity:v.capacity,advancedBy:r.parts[0].advancedBy,...(r.parts.length>1?{handovers:r.parts.slice(1).map(p=>({at:epoch(p.start),advancedBy:p.advancedBy}))}:{})})),String(v.venue))}},
 description:!canRank?'普通活动支持接龙、分组和录分，不计积分或修为；群主、管理员或本活动的测试员创建者可以在开打前开启积分赛。练球请填写练习内容。':tournament?'先报名，再由群主或管理员设置赛制、计分和报名费，创建者选人抽签。比赛名称自动生成。':'活动名称自动生成。单打与双打可选积分赛或普通活动，普通活动不计积分与修为；练球请填写具体练习内容，不计积分。球费按单颗价格 × 耗球数量记录，之后可在费用页补录。'};
}
