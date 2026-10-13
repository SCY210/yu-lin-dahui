import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';
mkdirSync('.test-output',{recursive:true});
writeFileSync('.test-output/guest-levels-ui-entry.ts',"export {default as GuestLevels} from '../app/guest-levels';export {default as GroupPlayer} from '../app/group-player';");
await build({entryPoints:['.test-output/guest-levels-ui-entry.ts'],bundle:true,platform:'node',format:'esm',outfile:'.test-output/guest-levels-ui.mjs',loader:{'.css':'empty'},external:['react','react/*','react-dom','react-dom/*','lucide-react']});
const {GuestLevels,GroupPlayer}=await import(pathToFileURL(resolve('.test-output/guest-levels-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;let ui;
const text=n=>typeof n==='string'?n:(Array.isArray(n)?n:n?.children??[]).map(text).join('');
const data={me:{id:'host',playerId:'p0',role:'member'},players:[{id:'p0',name:'Fictional host',ownerId:'host'},{id:'g',name:'Fictional guest',ownerId:'host',guest:true,guestHost:'Fictional host',guestLevel:1150}],registrations:[{eventId:'e',playerId:'g',status:'confirmed'}]},e={id:'e',creatorId:'organizer'},forms=[],profiles=[];
const ctx={data,name:id=>data.players.find(p=>p.id===id)?.name??id,busy:false,open:(...args)=>forms.push(args),openProfile:id=>profiles.push(id)};
const mount=async(Component,props)=>{if(ui)await act(()=>ui.unmount());await act(()=>{ui=renderer.create(React.createElement(Component,props))})};
try{
 await mount(GuestLevels,{e,ctx});assert.ok(text(ui.toJSON()).includes('Fictional host的朋友'));assert.ok(text(ui.toJSON()).includes('较强'));
 await act(()=>ui.root.findByType('button').props.onClick());const form=forms.at(-1);assert.equal(form[1],'guestLevel');assert.equal(form[2].playerId,'g');assert.equal(form[3][0].options.length,4);assert.deepEqual(form[4]({level:'1300'}),{playerId:'g',level:1300});
 data.me={id:'outsider',playerId:'p9',role:'member'};await mount(GuestLevels,{e,ctx});assert.equal(ui.root.findAllByType('button').length,0);
 data.me={id:'organizer',playerId:'p8',role:'member'};await mount(GuestLevels,{e,ctx});assert.equal(ui.root.findAllByType('button').length,1);
 await mount(GroupPlayer,{id:'g',ctx});assert.ok(ui.root.findByType('button').props.disabled);assert.ok(text(ui.toJSON()).includes('Fictional host的朋友'));
 await mount(GroupPlayer,{id:'p0',ctx});assert.ok(!ui.root.findByType('button').props.disabled);await act(()=>ui.root.findByType('button').props.onClick());assert.deepEqual(profiles,['p0']);
 console.log('PASS guest levels UI: host label, four-level form conversion, registrant/organizer controls, outsider read-only view and disabled guest profile navigation');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
