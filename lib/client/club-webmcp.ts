import type {ClubData} from '../contracts/club';

type BrowserTool={name:string;description:string;inputSchema:Record<string,unknown>;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>Promise<unknown>};
type ModelContextHost={modelContext?:{registerTool:(tool:BrowserTool,options:{signal:AbortSignal})=>unknown}};
type Options={current:()=>ClubData|null|undefined;refresh:()=>Promise<ClubData|null|undefined>;openSignup:(event:ClubData['events'][number],booking:ClubData['bookings'][number],me:ClubData['me'])=>void};

/** Browser agents can prepare a signup, but may never silently accept participation terms. */
export function registerClubWebMcp(options:Options,host:ModelContextHost=document as Document&ModelContextHost){
 const ctx=host.modelContext;if(!ctx?.registerTool)return()=>{};
 const lifecycle=new AbortController();
 const active=()=>{if(lifecycle.signal.aborted)throw new Error('此页面的操作入口已关闭')};
 const tools:BrowserTool[]=[
  {name:'read_club_overview',description:'读取当前授权活动与本人报名状态',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>{
   active();const fresh=await options.refresh();active();const me=fresh?.me;
   return {events:fresh?.events??[],bookings:fresh?.bookings??[],myRegistrations:me&&fresh?fresh.registrations.filter(r=>r.playerId===me.playerId):[],myPlayerId:me?.playerId};
  }},
  {name:'register_for_event',description:'打开指定场地的接龙表单；本人阅读并勾选活动须知后才能提交，满员时自动候补',inputSchema:{type:'object',properties:{eventId:{type:'string'},bookingId:{type:'string'}},required:['eventId','bookingId'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input)=>{
   active();if(!input||typeof input!=='object'||!('eventId' in input)||typeof input.eventId!=='string'||!('bookingId' in input)||typeof input.bookingId!=='string')throw new Error('请选择活动及场地时段');
   const current=options.current();if(!current?.me)throw new Error('请先登录并加载活动');
   const event=current.events.find(event=>event.id===input.eventId);if(!event)throw new Error('活动不存在');
   const booking=current.bookings.find(booking=>booking.id===input.bookingId&&booking.eventId===event.id);if(!booking)throw new Error('请选择此活动内的场地时段');
   options.openSignup(event,booking,current.me);
   return {requiresConfirmation:true,message:'已打开接龙表单，请本人阅读并勾选活动参与须知，再确认提交。'};
  }},
 ];
 for(const tool of tools)try{void Promise.resolve(ctx.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}
 return()=>lifecycle.abort();
}
