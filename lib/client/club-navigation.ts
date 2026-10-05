export type ClubPage = 'home'|'events'|'ranking'|'me'|'social'|'admin';
export type EventTab = 'overview'|'signup'|'rounds'|'fees'|'social';
export type SocialTab = 'players'|'network'|'challenges'|'funny';
export type ClubRoute = {page:ClubPage; eventId:string; tab:EventTab; playerId:string; socialTab:SocialTab};
export const homeRoute:ClubRoute = {page:'home',eventId:'',tab:'overview',playerId:'',socialTab:'players'};
const pages = new Set(['home','events','ranking','me','social','admin']);
const eventTabs = new Set(['overview','signup','rounds','fees','social']);
const socialTabs = new Set(['players','network','challenges','funny']);
const safeId = (value:unknown)=>typeof value==='string'&&value.length<=150?value:'';

export function normalizeRoute(value:Partial<ClubRoute>):ClubRoute {
 const page = pages.has(value.page??'')?value.page!:'home';
 return {page,eventId:page==='events'?safeId(value.eventId):'',tab:page==='events'&&eventTabs.has(value.tab??'')?value.tab!:'overview',playerId:page==='social'?safeId(value.playerId):'',socialTab:page==='social'&&socialTabs.has(value.socialTab??'')?value.socialTab!:'players'};
}
export function readClubRoute(href:string):ClubRoute {
 const q = new URL(href).searchParams;
 return normalizeRoute({page:(q.get('page')||(q.has('event')?'events':'home')) as ClubPage,eventId:q.get('event')??'',tab:(q.get('tab')==='matches'?'rounds':q.get('tab')) as EventTab,playerId:q.get('player')??'',socialTab:q.get('social') as SocialTab});
}
export function clubRouteUrl(href:string,route:ClubRoute):string {
 const url = new URL(href);
 for(const key of ['page','event','tab','player','social'])url.searchParams.delete(key);
 if(route.page!=='home')url.searchParams.set('page',route.page);
 if(route.eventId){url.searchParams.set('event',route.eventId);if(route.tab!=='overview')url.searchParams.set('tab',route.tab)}
 if(route.page==='social'){if(route.playerId)url.searchParams.set('player',route.playerId);else if(route.socialTab!=='players')url.searchParams.set('social',route.socialTab)}
 return url.pathname+url.search+url.hash;
}
export const sameRoute = (a:ClubRoute,b:ClubRoute)=>JSON.stringify(a)===JSON.stringify(b);
export type RankingSelection={period:string;year:number;rankingPeriod:'monthly'|'annual'};
export type ProfileSource={route:ClubRoute;scrollY:number;ranking?:RankingSelection};
type Frame = {route:ClubRoute;dialog:string|null;scrollY:number;profileSource?:ProfileSource;ranking?:RankingSelection};
type Marker = {session:string;owner:string;index:number;route:ClubRoute;dialog:string|null;scrollY?:number;profileSource?:ProfileSource;ranking?:RankingSelection};
export type NavigationPort = {href:()=>string; state:()=>unknown; push:(state:unknown,url:string)=>void; replace:(state:unknown,url:string)=>void; go:(delta:number)=>void; scrollY:()=>number; scrollTo:(y:number)=>void};
const markerOf = (state:unknown):Marker|undefined => {
 const marker=state&&typeof state==='object'?(state as any).__yulinNavigation:undefined;
 return marker&&typeof marker==='object'&&typeof marker.session==='string'&&typeof marker.owner==='string'&&typeof marker.index==='number'&&marker.route&&typeof marker.route==='object'?marker:undefined;
};
const safeScroll=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(2000000,value)):0;
const rankingOf=(value:unknown):RankingSelection|undefined=>{
 if(!value||typeof value!=='object')return;
 const v=value as any;
 if(typeof v.period!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(v.period)||!Number.isInteger(v.year)||v.year<2000||v.year>2100||!['monthly','annual'].includes(v.rankingPeriod))return;
 return {period:v.period,year:v.year,rankingPeriod:v.rankingPeriod};
};
const sourceOf=(value:unknown):ProfileSource|undefined=>{
 if(!value||typeof value!=='object')return;
 const v=value as any;if(!v.route||!pages.has(v.route.page))return;
 const route=normalizeRoute(v.route);if(route.page==='social'&&route.playerId)return;
 const ranking=rankingOf(v.ranking);return {route,scrollY:safeScroll(v.scrollY),...(ranking?{ranking}:{})};
};

/** Only route IDs and opaque dialog IDs enter browser history. Form data stays in components. */
export class ClubNavigation {
 private frames:Frame[]=[];
 private index=0;
 private dialogClosers=new Map<string,()=>boolean|void>();
 private listeners=new Set<(route:ClubRoute)=>void>();
 private moving=false;
 private afterMove:(()=>void)|null=null;
 private generation=0;
 private session:string;
 constructor(private port:NavigationPort,private owner:string,private initialSession:string){
  this.session=initialSession;
  const previous=markerOf(port.state());
  const route=previous&&previous.owner!==owner?homeRoute:readClubRoute(port.href());
  const own=previous?.owner===owner,source=own&&route.page==='social'&&route.playerId?sourceOf(previous?.profileSource):undefined,ranking=own?rankingOf(previous?.ranking):undefined;
  this.frames=[{route,dialog:null,scrollY:safeScroll(port.scrollY()),...(source?{profileSource:source}:{}),...(ranking?{ranking}:{})}];
  this.write(false);
 }
 get route(){return this.frames[this.index].route}
 get profileSource(){return this.frames[this.index].profileSource}
 get rankingSelection(){const frame=this.frames[this.index];return frame.ranking??frame.profileSource?.ranking}
 updateRankingSelection(value:RankingSelection){
  const selection=rankingOf(value),frame=this.frames[this.index];
  if(!selection||frame.route.page!=='ranking')return;
  frame.ranking=selection;this.write(false);
 }
 get profileBackLabel(){const source=this.profileSource?.route;if(!source)return '返回球友列表';if(source.page==='events')return source.tab==='signup'?'返回接龙':'返回活动';if(source.page==='ranking')return '返回榜单';if(source.page==='me')return '返回我的';if(source.page==='home')return '返回首页';if(source.page==='admin')return '返回群组管理';return source.socialTab==='network'?'返回关系图':source.socialTab==='challenges'?'返回复仇局':source.socialTab==='funny'?'返回趣味榜':'返回球友列表'}
 subscribe(listener:(route:ClubRoute)=>void){this.listeners.add(listener);listener(this.route);return()=>{this.listeners.delete(listener)}}
 private emit(){for(const listener of this.listeners)listener(this.route)}
 private write(push:boolean){
  const frame=this.frames[this.index],existing=this.port.state();
  const state={...(existing&&typeof existing==='object'?existing:{}),__yulinNavigation:{session:this.session,owner:this.owner,index:this.index,route:frame.route,dialog:frame.dialog,...(frame.scrollY?{scrollY:frame.scrollY}:{}),...(frame.profileSource?{profileSource:frame.profileSource}:{}),...(frame.ranking?{ranking:frame.ranking}:{})}};
  this.port[push?'push':'replace'](state,clubRouteUrl(this.port.href(),frame.route));
 }
 private rememberScroll(){this.frames[this.index].scrollY=safeScroll(this.port.scrollY())}
 private push(frame:Frame){this.rememberScroll();this.write(false);this.frames=this.frames.slice(0,this.index+1);this.frames.push(frame);this.index++;this.write(true);this.emit()}
 openPlayer(playerId:string,selection?:RankingSelection){
  if(this.moving){this.afterMove=()=>this.openPlayer(playerId,selection);return}
  const id=safeId(playerId);if(!id)return;
  const current=this.frames[this.index];if(current.route.page==='social'&&current.route.playerId===id)return;
  const ranking=rankingOf(selection);
  if(current.route.page==='ranking'&&ranking)current.ranking=ranking;
  const source=current.route.page==='social'&&current.route.playerId?current.profileSource:{route:current.route,scrollY:safeScroll(this.port.scrollY()),...(current.route.page==='ranking'&&current.ranking?{ranking:current.ranking}:{})};
  this.closeCurrentDialog();this.push({route:normalizeRoute({page:'social',playerId:id}),dialog:null,scrollY:0,...(source?{profileSource:source}:{})});this.port.scrollTo(0);
 }
 returnFromProfile(){
  if(this.moving){this.afterMove=()=>this.returnFromProfile();return}
  const source=this.profileSource;
  if(!source){this.backTo({page:'social'});return}
  for(let i=this.index-1;i>=0;i--)if(!this.frames[i].dialog&&sameRoute(this.frames[i].route,source.route)){
   this.frames[i].scrollY=source.scrollY;if(source.ranking)this.frames[i].ranking=source.ranking;this.move(i-this.index);return;
  }
  this.closeCurrentDialog();this.frames[this.index]={route:source.route,dialog:null,scrollY:source.scrollY,...(source.ranking?{ranking:source.ranking}:{})};this.write(false);this.emit();this.port.scrollTo(source.scrollY);
 }
 navigate(value:Partial<ClubRoute>){
  if(this.moving){this.afterMove=()=>this.navigate(value);return}
  const route=normalizeRoute({...homeRoute,...value});
  if(sameRoute(route,this.route))return;
  this.closeCurrentDialog();
  this.push({route,dialog:null,scrollY:0});this.port.scrollTo(0);
 }
 replaceRoute(value:Partial<ClubRoute>){
  if(this.moving){this.afterMove=()=>this.replaceRoute(value);return}
  this.closeCurrentDialog();this.frames[this.index]={route:normalizeRoute({...homeRoute,...value}),dialog:null,scrollY:0};this.write(false);this.emit();this.port.scrollTo(0);
 }
 backTo(value:Partial<ClubRoute>){
  if(this.moving){this.afterMove=()=>this.backTo(value);return}
  const route=normalizeRoute({...homeRoute,...value});
  for(let i=this.index-1;i>=0;i--)if(!this.frames[i].dialog&&sameRoute(this.frames[i].route,route)){this.move(i-this.index);return}
  // Directly opened details have no list entry to return to. Replace them with their list.
  this.replaceRoute(route);
 }
 private closeCurrentDialog(){
  const frame=this.frames[this.index];
  if(!frame.dialog)return;
  const close=this.dialogClosers.get(frame.dialog);this.dialogClosers.delete(frame.dialog);frame.dialog=null;this.write(false);close?.();
 }
 private move(delta:number){this.moving=true;this.port.go(delta)}
 openDialog(id:string,close:()=>boolean|void){
  this.dialogClosers.set(id,close);
  const show=()=>{if(this.dialogClosers.has(id))this.push({...this.frames[this.index],route:this.route,dialog:id,scrollY:this.port.scrollY()})};
  if(this.moving)this.afterMove=show;else show();
 }
 dismissDialog(id:string){
  if(!this.dialogClosers.delete(id))return;
  if(!this.moving&&this.frames[this.index].dialog===id)this.move(-1);
 }
 pop(state:unknown){
  this.rememberScroll();
  const previousIndex=this.index,previous=this.frames[this.index],marker=markerOf(state);
  const ownTarget=marker?.session===this.session&&marker.owner===this.owner&&Number.isInteger(marker.index)&&marker.index>=0&&this.frames[marker.index]&&sameRoute(this.frames[marker.index].route,normalizeRoute(marker.route));
  if(ownTarget&&previous.dialog&&previous.dialog!==this.frames[marker!.index].dialog){
   const close=this.dialogClosers.get(previous.dialog);
   const wasMoving=this.moving;this.moving=true;let accepted:boolean|void;
   try{accepted=close?.()}finally{this.moving=wasMoving}
   if(accepted===false){this.move(previousIndex-marker!.index);return}
   this.dialogClosers.delete(previous.dialog);
  }
  if(marker?.session===this.session&&marker.owner===this.owner&&Number.isInteger(marker.index)&&marker.index>=0&&this.frames[marker.index]&&sameRoute(this.frames[marker.index].route,normalizeRoute(marker.route)))this.index=marker.index;
  else {
   const route=marker&&marker.owner!==this.owner?homeRoute:readClubRoute(this.port.href());
   // Old browser entries can carry index 0 from before a reload. A new generation avoids collisions.
   this.session=this.initialSession+':'+(++this.generation);
   const own=marker?.owner===this.owner,source=own&&route.page==='social'&&route.playerId?sourceOf(marker?.profileSource):undefined,ranking=own?rankingOf(marker?.ranking):undefined;
   this.frames=[{route,dialog:null,scrollY:own?safeScroll(marker?.scrollY):0,...(source?{profileSource:source}:{}),...(ranking?{ranking}:{})}];this.index=0;this.write(false);
  }
  if(previous.dialog&&previous.dialog!==this.frames[this.index].dialog){const close=this.dialogClosers.get(previous.dialog);this.dialogClosers.delete(previous.dialog);close?.()}
  const current=this.frames[this.index];
  // Closed dialogs are transient: forward navigation must never resurrect old form values.
  if(current.dialog&&!this.dialogClosers.has(current.dialog)){current.dialog=null;this.write(false)}
  this.emit();this.port.scrollTo(current.scrollY);
  this.moving=false;const next=this.afterMove;this.afterMove=null;next?.();
 }
 reset(){this.closeCurrentDialog();this.frames=[{route:homeRoute,dialog:null,scrollY:0}];this.index=0;this.write(false);this.emit()}
}
