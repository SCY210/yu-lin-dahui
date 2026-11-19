import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdirSync} from 'node:fs';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import React from 'react';import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});await build({stdin:{contents:"export {default as BookingClaims,bookingClaimForm} from './app/booking-claims';",resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'node',format:'esm',outfile:'.test-output/booking-claims-ui.mjs',external:['react','react/*','react-dom','lucide-react'],loader:{'.css':'empty'},alias:{'@':resolve('.')},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'claims-shell',setup(b){b.onResolve({filter:/components\/ui\/dialog$/},()=>({path:'dialog',namespace:'claims-shell'}));b.onLoad({filter:/.*/,namespace:'claims-shell'},()=>({loader:'js',contents:"import {createElement as h} from 'react';export const Dialog=({open,children,onOpenChange})=>open?h('section',{role:'dialog',onOpenChange},children):null;export const DialogContent=({children})=>h('article',null,children);export const DialogHeader=({children})=>children;export const DialogTitle=({children})=>h('h2',null,children);export const DialogDescription=({children})=>h('p',null,children);"}))}}]});
const {BookingClaims,bookingClaimForm}=await import(pathToFileURL(resolve('.test-output/booking-claims-ui.mjs'))),previous=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join(''),hour=3600000,start=Date.parse('2035-01-06T12:00:00Z');
const b={id:'court',eventId:'event',name:'1号场',venue:'虚构馆',start,end:start+6*hour,pricing:'hourly',cents:690,advancedBy:'p0'},e={id:'event',creatorId:'creator',status:'open'},opened=[],sent=[];
const data={me:{id:'member',playerId:'p1',role:'member'},players:[{id:'p0',name:'组织者',enabled:true},{id:'p1',name:'实际约场者',enabled:true}],settlements:[]},ctx={data,busy:false,name:id=>data.players.find(p=>p.id===id)?.name,open:(...args)=>opened.push(args),send:(...args)=>sent.push(args)};
const mount=async()=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=renderer.create(React.createElement(BookingClaims,{b,e,ctx}))});const details=ui.root.findAllByType('details')[0];if(details)await act(()=>details.props.onToggle({currentTarget:{open:true}}))};
try{
 await mount();assert.ok(JSON.stringify(ui.toJSON()).includes('组织者登记'),'the state is named on the segment');assert.equal(ui.root.findAllByType('details').length,0,'the timeline is shown open, not folded');
 const segments=()=>ui.root.findAll(n=>n.type==='li'&&/^is-/.test(n.props.className??'')&&n.props.style).map(n=>[n.props.className,n.props.style.flexGrow]);
 const segmentButtons=()=>ui.root.findAll(n=>n.type==='button'&&/(查看详情|点按认领)$/.test(n.props['aria-label']??''));
 const dialog=()=>ui.root.findAll(n=>n.props.role==='dialog')[0];const dialogButtons=()=>dialog()?dialog().findAllByType('button').map(x=>text(x.children)):[];
 const pick=()=>text(dialog().findAll(n=>n.props.className==='claim-range-pick')[0].children);
 const handle=label=>dialog().findAll(n=>n.type==='input'&&n.props['aria-label']===label)[0];
 // No tip, colour legend or claim buttons under the timeline: the timeline itself is what one taps.
 assert.deepEqual(segments(),[['is-registered',6*hour]]);for(const gone of ['认领我约的时间','纠正约场人','点时间段可查看详情','颜色说明'])assert.ok(!JSON.stringify(ui.toJSON()).includes(gone),gone+' is gone');
 // Booked time: the details offer 这段是我约的, which opens the claim dialog with the draggable time bar.
 await act(()=>segmentButtons()[0].props.onClick());assert.ok(dialogButtons().includes('这段是我约的'));await act(()=>dialog().findAllByType('button').find(x=>text(x.children)==='这段是我约的').props.onClick());
 assert.ok(dialog().findAll(n=>n.props.className==='claim-range-track').length===1,'the claim dialog shows the time bar');assert.match(pick(),/^\d\d:\d\d–\d\d:\d\d2 小时$/,'the chosen time is shown in large type: '+pick());
 assert.equal(handle('开始时间').props.value,0);assert.equal(handle('结束时间').props.value,2);assert.equal(handle('结束时间').props.max,6,'whole-hour steps over the whole booking');
 await act(()=>handle('结束时间').props.onChange({target:{value:'3'}}));assert.ok(pick().endsWith('3 小时'));
 await act(()=>handle('结束时间').props.onChange({target:{value:'0'}}));assert.equal(handle('结束时间').props.value,1,'a claim lasts at least an hour');assert.ok(pick().endsWith('1 小时'));
 await act(()=>handle('结束时间').props.onChange({target:{value:'2'}}));assert.equal(dialog().findAll(n=>n.props['aria-label']==='约场人').length,0,'members claim only for themselves');
 await act(()=>dialog().findAllByType('button').find(x=>text(x.children).startsWith('认领 ')).props.onClick());
 assert.equal(dialog(),undefined,'the dialog closes once the claim is sent');const [sa,sp]=sent.at(-1);assert.equal(sa,'bookingClaim');assert.deepEqual({...sp,expected:typeof sp.expected},{bookingId:'court',start:b.start,end:b.start+2*hour,expected:'string',correct:false,reason:''});
 // Organisers correct a booker from the details, choosing the time on the same bar and the member below it.
 data.me.id='creator';await mount();await act(()=>segmentButtons()[0].props.onClick());await act(()=>dialog().findAllByType('button').find(x=>text(x.children)==='纠正约场人').props.onClick());
 assert.equal(dialog().findAll(n=>n.props['aria-label']==='约场人'&&n.props.value==='p0').length>0,true,'the current booker is preselected');await act(()=>dialog().findAllByType('button').find(x=>text(x.children)==='保存约场人').props.onClick());assert.equal(sent.at(-1)[1].correct,true);assert.equal(sent.at(-1)[1].playerId,'p0');
 b.claims=[{start:b.start,end:b.start+2*hour,playerId:'p0',at:0}];const later=bookingClaimForm(b,'p1');assert.equal(later.convert(later.values).start,b.start+2*hour);
 await mount();assert.deepEqual(segments(),[['is-claimed',2*hour],['is-registered',4*hour]]);assert.ok(text(ui.toJSON()).includes('已全部登记'));
 // Time nobody booked is 待认领: its own colour, counted in the header, and tapping it opens the claim dialog at once.
 const open={...b,advancedBy:undefined,handovers:[{at:b.start+2*hour,advancedBy:'p0'},{at:b.start+4*hour}],claims:[{start:b.start+2*hour,end:b.start+4*hour,playerId:'p0',at:0}]};
 await act(()=>ui.update(React.createElement(BookingClaims,{b:open,e,ctx})));assert.deepEqual(segments(),[['is-pending',2*hour],['is-claimed',2*hour],['is-pending',2*hour]]);assert.ok(text(ui.toJSON()).includes('还有 4 小时待认领'));assert.ok(text(ui.toJSON()).includes('点此认领'));
 const fresh=bookingClaimForm(open,'p1');assert.equal(fresh.convert(fresh.values).start,b.start);
 data.me.id='member';await act(()=>ui.update(React.createElement(BookingClaims,{b:open,e,ctx})));
 await act(()=>segmentButtons()[2].props.onClick());assert.ok(dialog().findAll(n=>n.props.className==='claim-range-track').length===1,'tapping 待认领 time opens the claim dialog directly');assert.equal(handle('开始时间').props.value,4);assert.equal(handle('结束时间').props.value,6);
 assert.equal(dialog().findAll(n=>n.props.className==='claim-range-taken').length,1,'time another member claimed is shown on the bar');
 await act(()=>handle('开始时间').props.onChange({target:{value:'3'}}));assert.ok(text(dialog().children).includes('别人已认领'));assert.ok(dialog().findAllByType('button').find(x=>text(x.children).startsWith('认领 ')).props.disabled,'cannot take time another member claimed');await act(()=>dialog().props.onOpenChange(false));
 // Tapping booked time still shows it in full: a long name cut off in a short segment is readable here.
 data.me.id='creator';await act(()=>ui.update(React.createElement(BookingClaims,{b:open,e,ctx})));
 await act(()=>segmentButtons()[1].props.onClick());assert.ok(text(dialog().children).includes('组织者'));assert.ok(text(dialog().children).includes('已认领'));
 assert.ok(dialogButtons().includes('纠正约场人')&&dialogButtons().includes('改回待认领'),'organisers correct or release any segment');
 const before=opened.length;await act(()=>dialog().findAllByType('button').find(x=>text(x.children)==='改回待认领').props.onClick());assert.equal(dialog(),undefined,'the details close when an action opens');
 const [rt,ra,rv,rf]=opened[before];assert.equal(ra,'bookingClaim');assert.equal(rv.release,true);assert.equal(rv.start,b.start+2*hour);assert.equal(rv.end,b.start+4*hour);assert.deepEqual(rf,[]);assert.ok(rt.startsWith('改回待认领'));
 // A member sees only what they may do: claim time nobody else claimed, release their own.
 data.me.id='member';await act(()=>ui.update(React.createElement(BookingClaims,{b:open,e,ctx})));await act(()=>segmentButtons()[1].props.onClick());assert.deepEqual(dialogButtons(),[],'another member claim is read-only for members');assert.ok(text(dialog().children).includes('联系组织者'));await act(()=>dialog().props.onOpenChange(false));
 const own={...open,handovers:[{at:b.start+2*hour,advancedBy:'p1'},{at:b.start+4*hour}],claims:[{start:b.start+2*hour,end:b.start+4*hour,playerId:'p1',at:0}]};await act(()=>ui.update(React.createElement(BookingClaims,{b:own,e,ctx})));await act(()=>segmentButtons()[1].props.onClick());assert.deepEqual(dialogButtons(),['改回待认领'],'members release their own time');await act(()=>dialog().props.onOpenChange(false));
 data.me.id='creator';
 // Confirmed fees: segments only show their details, which say how to correct.
 data.settlements=[{eventId:'event',confirmed:true}];await mount();assert.equal(ui.root.findAllByType('button').filter(x=>!x.props['aria-label']?.endsWith('查看详情')).length,0,'only the read-only segment details stay');await act(()=>segmentButtons()[0].props.onClick());assert.deepEqual(dialogButtons(),[]);assert.ok(text(dialog().children).includes('费用已确认'));
 ctx.readOnly=true;await mount();assert.equal(ui.toJSON(),null);
 console.log('PASS booking claim UI: open timeline coloured by claim state without tip or legend, 待认领 time opening the draggable claim bar with the chosen time in large type, tappable segment details with claim, correction and release by permission, 待认领 time, own-range form, Madrid choices, price attribution disclosure, organiser correction, claim status, confirmed fees and read-only protection');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=previous}
