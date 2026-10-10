import {ceilHalfHour} from '../lib/time-planning';
import {dt,epoch,choice,halfTimed,number,text,money,type Form} from './form-fields';
export function newEventForm(now:number):Form{
 const start=ceilHalfHour(now+86400000),end=start+3*3600000,practice={key:'matchFormat',value:'practice'};
 return {title:'创建活动',action:'event',values:{matchFormat:'doubles',venue:'',address:'',start:dt(start),end:dt(end),capacity:16,cancelDeadline:dt(start-86400000),note:'',status:'open',courtName:'1号场',courtPrice:6.9,practiceShuttleCents:200,practiceBallCount:0},
 fields:[choice('matchFormat','活动类型',[['doubles','双打 · 每方2人'],['singles','单打 · 每方1人'],['practice','练球 · 专项练习']]),
  {key:'venue',label:'球馆',type:'venue'},halfTimed('start','开始'),halfTimed('end','结束'),number('capacity','接龙人数上限'),
  {key:'courtPrice',label:'每小时场地价格 · 欧元',type:'price-stepper',step:0.1,min:0},
  {...text('note','活动说明 / 具体练习内容'),type:'textarea',optional:true,requiredWhen:practice},
  {...money('practiceShuttleCents','单颗球价 · 欧元'),min:0,when:practice},
  {...number('practiceBallCount','耗球数量（可后补，未使用填 0）'),min:0,max:10000,when:practice},
  {...text('courtName','场地名称'),optional:true},{...choice('status','状态',[['open','开放报名'],['draft','草稿']]),optional:true}],
 convert:v=>{const {courtName,courtPrice,practiceShuttleCents,practiceBallCount,...rest}=v,start=epoch(v.start),end=epoch(v.end);return {...rest,start,end,cancelDeadline:epoch(v.cancelDeadline),...(v.matchFormat==='practice'?{practiceShuttleCents,practiceBallCount}:{}),bookings:[{name:courtName?.trim()||'1号场',start,end,pricing:'hourly',cents:Math.round(courtPrice*100),signupCapacity:v.capacity}]}},
 description:'活动名称自动生成。单打与双打分别计分；练球请填写具体练习内容，不计积分。球费按单颗价格 × 耗球数量记录，之后可在费用页补录。'};
}
