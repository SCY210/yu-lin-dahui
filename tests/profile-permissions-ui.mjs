import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import renderer,{act} from 'react-test-renderer';

mkdirSync('.test-output',{recursive:true});
await build({entryPoints:['app/player-profile.tsx'],bundle:true,platform:'node',format:'esm',jsx:'automatic',external:['react','react/*','react-dom','react-dom/*','lucide-react'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},outfile:'.test-output/profile-policy-ui.mjs',plugins:[{name:'dialog-shells',setup(builder){
 builder.onResolve({filter:/components\/ui\/(?:alert-)?dialog$/},()=>({path:'dialogs',namespace:'profile-ui'}));
 builder.onLoad({filter:/.*/,namespace:'profile-ui'},()=>({loader:'js',contents:`import React from 'react';const Shell=({children})=>React.createElement('section',null,children);export const Dialog=({open,children})=>open?children:null;export const DialogClose=Shell,DialogContent=Shell,DialogHeader=Shell,DialogTitle=Shell,DialogDescription=Shell,AlertDialog=Dialog,AlertDialogContent=Shell,AlertDialogHeader=Shell,AlertDialogTitle=Shell,AlertDialogDescription=Shell,AlertDialogFooter=Shell,AlertDialogCancel=Shell,AlertDialogAction=Shell;`}));
}}]});
const {default:PlayerProfile}=await import(pathToFileURL(resolve('.test-output/profile-policy-ui.mjs')).href);
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const player={id:'fixture-player',name:'Fictional member',ownerId:'fixture-account',profileEditMode:'gender-only',profile:{gender:'undisclosed',years:5,hand:'left',preference:'mixed',style:'existing style',racket:'existing racket'}};
const calls=[],ctx={admin:false,busy:false,name:()=>player.name,refresh:async()=>{},open:(...args)=>calls.push(args),data:{me:{id:'fixture-account',playerId:player.id,role:'member'},players:[player],photos:[{id:'racket',kind:'racket',playerIds:[player.id],caption:'Existing racket photo',created:1,canDelete:false}],settings:{rules:{target:21,lead:2,ceiling:30,k:32}},achievements:{}}};
const text=node=>typeof node==='string'?node:(node?.children??[]).map(text).join('');
let ui;
try{
 await act(async()=>{ui=renderer.create(React.createElement(PlayerProfile,{p:player,ctx}));});
 const buttons=()=>ui.root.findAllByType('button');
 assert.ok(!buttons().some(button=>/更换头像|修改姓名|编辑档案/.test(text(button))));
 const edit=buttons().find(button=>text(button)==='修改性别');assert.ok(edit);
 await act(()=>edit.props.onClick());assert.equal(calls[0][1],'profileGender');assert.deepEqual(calls[0][2],{playerId:player.id,gender:'undisclosed'});assert.deepEqual(calls[0][3].map(field=>field.key),['gender']);
 const equipment=ui.root.findAllByType('details').find(details=>text(details.findByType('summary'))==='战拍与装备');
 await act(async()=>{equipment.props.onToggle({currentTarget:{open:true}});});
 assert.equal(ui.root.findAllByType('input').filter(input=>input.props.type==='file').length,0);
 assert.ok(!buttons().some(button=>/上传照片|删除战拍|更换头像/.test(text(button))));
 assert.ok(ui.root.findAllByType('img').some(image=>image.props.src==='/api/photos/racket'));
 console.log('PASS profile controls: gender-only dialog contains one field, avatar/rename/upload/delete controls absent, existing racket photo remains visible.');
}finally{if(ui)await act(()=>ui.unmount());delete globalThis.IS_REACT_ACT_ENVIRONMENT}
