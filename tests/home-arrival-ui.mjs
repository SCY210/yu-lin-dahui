// Real React components with fictional activities; never contacts production.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync,readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
import ts from 'typescript';
function assertCardBadgePosition(source){
 const file=ts.createSourceFile('activity-card.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),cards=[];
 const visit=node=>{if(ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(file)==='className'&&p.initializer&&ts.isStringLiteral(p.initializer)&&p.initializer.text==='event-info'))cards.push(node);ts.forEachChild(node,visit)};
 visit(file);assert.equal(cards.length,1,'one activity-card content area is checked');
 const children=cards[0].children.filter(c=>!ts.isJsxText(c)||c.text.trim()),last=children.at(-1);
 assert.ok(last&&ts.isJsxSelfClosingElement(last)&&last.tagName.getText(file)==='PointsMatchBadge','the points badge is the last item in the card content area');
}
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/home-arrival-entry.ts',"export {default as HomeArrival} from '../app/home-arrival';export {default as PointsMatchBadge} from '../app/points-match-badge';");
await build({entryPoints:['.test-output/home-arrival-entry.ts'],outfile:'.test-output/home-arrival-ui.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'}});
const {HomeArrival,PointsMatchBadge}=await import(pathToFileURL(resolve('.test-output/home-arrival-ui.mjs')).href);
const prior=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=node=>typeof node==='string'?node:(Array.isArray(node)?node:node?.children??[]).map(text).join('');
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(async()=>{ui=renderer.create(React.createElement(Component,props))})};
try{
 const now=Date.parse('2026-10-25T17:00:00Z'),hour=3600000,sent=[],opened=[];
 const event={id:'e',title:'Fictional doubles',start:now-hour,end:now+hour,status:'open',pointsSession:{attendance:[{playerId:'me',late:true,available:false,at:now-60000},{playerId:'friend',late:true,available:false,at:now-30000}],waiting:[]}};
 const props={events:[event],players:[{id:'me',ownerId:'alice',name:'Fictional Alice'},{id:'friend',ownerId:'alice',name:'Fictional Friend'}],me:{id:'alice',playerId:'me'},now,onArrive:(...args)=>sent.push(args),onOpen:id=>opened.push(id)};
 await mount(HomeArrival,props);const shown=text(ui.toJSON());
 assert.ok(shown.includes('你还没确认到场，暂时不会排你上场')&&shown.includes('被报告迟到'));
 const buttons=ui.root.findAllByType('button');
 await act(()=>buttons.find(b=>text(b).includes('我已到场')).props.onClick());
 assert.deepEqual(sent.at(-1),['pointsPresence',{eventId:'e',playerId:'me',status:'arrived'}]);
 await act(()=>buttons.find(b=>text(b).includes('Fictional Friend 已到场')).props.onClick());assert.equal(sent.at(-1)[1].playerId,'friend');
 await act(()=>buttons[0].props.onClick());assert.equal(opened.at(-1),'e');
 await act(async()=>ui.update(React.createElement(HomeArrival,{...props,now:event.end})));assert.equal(ui.toJSON(),null,'nothing after the activity ends');
 await act(async()=>ui.update(React.createElement(HomeArrival,{...props,me:{id:'bob',playerId:'bob'}})));assert.equal(ui.toJSON(),null,'other members see nothing');
 await mount(PointsMatchBadge,{e:{matchFormat:'doubles'}});assert.ok(text(ui.toJSON()).includes('积分赛'));assert.ok(ui.root.findAllByType('svg').length===1,'the badge carries its own mark');
 for(const e of [{matchFormat:'doubles',ranked:false},{matchFormat:'practice'}]){await mount(PointsMatchBadge,{e});assert.equal(ui.toJSON(),null,JSON.stringify(e))}
 assert.match(readFileSync('app/points-match-badge.css','utf8'),/html\.wuxia-theme \.badge\.points-match-badge/,'the badge keeps its look in the ink theme');
 // The badge rule must outrank every theme rule for badges, such as the ink theme's activity-card rule that replaced the gold.
 const specificity=sel=>[(sel.match(/#[\w-]+/g)??[]).length,(sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g)??[]).length,(sel.replace(/[.#][\w-]+|\[[^\]]+\]|::?[\w-]+/g,' ').match(/(^|[\s>+~])[a-z]+/gi)??[]).length];
 const beats=(x,y)=>x[0]-y[0]||x[1]-y[1]||x[2]-y[2];
 const own=readFileSync('app/points-match-badge.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'').match(/^([^{]*\.points-match-badge[^{]*)\{/m)[1].split(',').map(s=>specificity(s.trim()));
 const themeRules=readdirSync('app').filter(n=>n.endsWith('.css')&&n!=='points-match-badge.css').flatMap(n=>[...readFileSync('app/'+n,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{[^}]*background[^}]*\}/g)].flatMap(m=>m[1].split(',').map(s=>s.trim()).filter(s=>/\.badge(?![\w-])/.test(s)&&!/event-status-badge|points-match-badge/.test(s))));
 assert.ok(themeRules.some(r=>r.includes('.wuxia-theme .event-card .event-info .badge')),'the ink card rule is among those checked');
 for(const rule of themeRules)assert.ok(own.some(o=>beats(o,specificity(rule))>0),'the points badge outranks '+rule);
 // On activity cards the smaller corner badge must also outrank the badge's own rule in both themes.
 const corner=readFileSync('app/points-match-badge.css','utf8').match(/^([^{]*\.event-card[^{]*\.points-match-badge[^{]*)\{[^}]*margin:[^;}]* auto/m);
 assert.ok(corner,'activity cards push the badge to the bottom-right corner');
 assert.ok(own.every(o=>beats(specificity(corner[1].trim()),o)>0),'the corner badge rule outranks the badge rule');
 assertCardBadgePosition(readFileSync('app/club-app.tsx','utf8'));
 // Decorative siblings outside the content area must not affect its badge position.
 const card=(content,decoration='')=>`const card=<button><div className="event-info">${content}</div>${decoration}</button>`;
 assertCardBadgePosition(card('<h3>Activity</h3><PointsMatchBadge e={ev}/>'));
 assertCardBadgePosition(card('<h3>Activity</h3><PointsMatchBadge e={ev}/>','<svg aria-hidden="true"/>'));
 assert.throws(()=>assertCardBadgePosition(card('<PointsMatchBadge e={ev}/><h3>Activity</h3>')),/last item/);
 assert.throws(()=>assertCardBadgePosition(card('<h3>Activity</h3>','<PointsMatchBadge e={ev}/>')),/last item/);
 console.log('PASS home arrival and points badge UI: own and proxy holds, resume commands, navigation, hidden after the end and for others, badge only on ranked activities');
}finally{if(ui)await act(()=>ui.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=prior}
