// Real ranking view with fictional rows: each row's points breakdown; never contacts production.
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/ranking-view.tsx'],outfile:'.test-output/ranking-breakdown-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','lucide-react'],loader:{'.css':'empty'},plugins:[{name:'ranking-shells',setup(builder){
 builder.onResolve({filter:/^\.\//},a=>a.importer.replaceAll('\\','/').endsWith('/app/ranking-view.tsx')&&!a.path.endsWith('.css')?{path:a.path,namespace:'ui'}:undefined);
 builder.onLoad({filter:/.*/,namespace:'ui'},({path})=>({loader:'js',contents:path==='./disclosure'?`export default function Disclosure({children}){return children}`:path==='./avatar'?`export const Avatar=()=>null;`:path==='./realm-badge'?`export default function Badge(){return null}export const PlacementBadge=()=>null;`:path==='./month-picker'?`export const QuarterPicker=()=>null,YearPicker=()=>null;`:`export default function Shell(){return null}`}));
}}]});
const Ranking=(await import(pathToFileURL(resolve('.test-output/ranking-breakdown-ui.mjs')).href)).default;
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.children?.map(text).join('')??'';
try{
 const row=(playerId,name,rank,fields)=>({playerId,name,rank,realm:'炼气',realmScore:{score:1000,stage:'初期',progressPercent:0},provisional:false,total:fields.wins+fields.losses,totalMatches:fields.wins+fields.losses,games:fields.wins+fields.losses,rate:fields.wins/(fields.wins+fields.losses||1),margin:0,upsetPoints:0,streakPoints:0,notificationPoints:0,attendancePoints:0,mvpPoints:0,bountyPoints:0,manualPoints:0,pendingPoints:0,pendingGames:0,...fields});
 const rows=[row('ann','Fictional Ann',1,{wins:15,losses:6,upsetPoints:3,streakPoints:4,mvpPoints:5,attendancePoints:-1,manualPoints:-8,pendingGames:2,pendingPoints:5,points:42}),row('ben','Fictional Ben',2,{wins:0,losses:0,points:0})];
 const data={rankingQuarter:'2026-Q4',quarterlyLeaderboard:rows,seasons:[],settings:{rules:{}},players:rows.map(r=>({id:r.playerId,name:r.name})),me:{playerId:'ben'}};
 const profiles=[];
 await act(async()=>{ui=create(React.createElement(Ranking,{data,period:'2026-10',setPeriod(){},year:2026,onProfile:id=>profiles.push(id)}))});
 const toggle=name=>ui.root.findAllByType('button').find(b=>b.props['aria-label']===name+'的积分明细');
 assert.equal(toggle('Fictional Ann').props['aria-expanded'],false,'collapsed at first');
 assert.equal(ui.root.findAll(n=>n.props.className==='rv-breakdown').length,0);
 await act(async()=>toggle('Fictional Ann').props.onClick());
 assert.equal(toggle('Fictional Ann').props['aria-expanded'],true);
 const panel=ui.root.findByProps({className:'rv-breakdown'});
 assert.equal(panel.props.id,toggle('Fictional Ann').props['aria-controls'],'the toggle controls its panel');
 const lines=panel.findAllByType('dt').map((dt,i)=>[text(dt),text(panel.findAllByType('dd')[i])]);
 assert.deepEqual(lines,[['胜局 15 × 3','+45'],['负局 6 × 1','-6'],['强弱加成','+3'],['连胜加分','+4'],['MVP 加分','+5'],['迟到扣分','-1'],['群主调整','-8']],'non-zero sources only, signed');
 assert.equal(lines.reduce((n,[,v])=>n+Number(v),0),42);
 assert.match(text(panel.findByProps({className:'rv-breakdown-total'})),/^合计42 分$/);
 assert.match(text(panel),/含进行中 2 局（\+5），活动结束后确认。/);
 await act(async()=>toggle('Fictional Ben').props.onClick());
 assert.equal(toggle('Fictional Ann').props['aria-expanded'],false,'one breakdown open at a time');
 const ben=ui.root.findByProps({className:'rv-breakdown'});
 assert.equal(ben.findAllByType('dl').length,0,'no sources: no empty list');assert.match(text(ben),/合计0 分/);
 await act(async()=>toggle('Fictional Ben').props.onClick());
 assert.equal(ui.root.findAll(n=>n.props.className==='rv-breakdown').length,0,'tapping again closes it');
 await act(async()=>ui.root.findAllByType('button').find(b=>b.props.className==='rv-name-link'&&text(b)==='Fictional Ann').props.onClick());
 assert.deepEqual(profiles,['ann'],'the name still opens the profile');
 assert.ok(readFileSync('app/ranking-view.css','utf8').includes('.rv-breakdown{grid-column:1/-1;min-width:0'),'the panel spans the whole row and cannot widen it');
 console.log('PASS ranking breakdown: collapsed by default, accessible toggle per row, non-zero signed sources adding up to the total, in-progress note, one open at a time, profile links unchanged');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
