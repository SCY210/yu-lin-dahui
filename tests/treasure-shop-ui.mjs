import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import React,{act} from 'react';
import {create} from 'react-test-renderer';

const shell=`import {createElement as h} from 'react';const box=({children})=>h('section',null,children);const heading=({children})=>h('h2',null,children);const button=({children,...props})=>h('button',props,children);`;
await build({entryPoints:['tests/fixtures/treasure-shop-preview.tsx'],outfile:'.test-output/treasure-shop-ui-fixture.mjs',bundle:true,platform:'node',format:'esm',jsx:'automatic',alias:{'@':resolve('.')},external:['react','react/*','react-dom','react-dom/*'],loader:{'.css':'empty'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},plugins:[{name:'headless-dialog-shells',setup(b){
 b.onResolve({filter:/components\/ui\/(dialog|alert-dialog|checkbox)$/},a=>({path:a.path.split('/').at(-1),namespace:'treasure-ui'}));
 b.onLoad({filter:/.*/,namespace:'treasure-ui'},a=>({loader:'js',contents:a.path==='dialog'?shell+`export const Dialog=({open,children})=>open?children:null;export const DialogContent=box,DialogHeader=box,DialogTitle=heading,DialogDescription=box;`:a.path==='alert-dialog'?shell+`export const AlertDialog=({open,children})=>open?children:null;export const AlertDialogContent=box,AlertDialogHeader=box,AlertDialogTitle=heading,AlertDialogDescription=box,AlertDialogFooter=box,AlertDialogCancel=button,AlertDialogAction=button;`:`import {createElement as h} from 'react';export const Checkbox=({checked,onCheckedChange})=>h('input',{type:'checkbox',checked,onChange:e=>onCheckedChange(e.target.checked)});`}));
}}]});
const {default:Preview}=await import(pathToFileURL(resolve('.test-output/treasure-shop-ui-fixture.mjs')).href);
const previous=globalThis.IS_REACT_ACT_ENVIRONMENT;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let renderer;const forms=[],calls=[];
const text=n=>typeof n==='string'||typeof n==='number'?String(n):Array.isArray(n)?n.map(text).join(''):n?.children?.map(text).join('')??'';
const buttons=()=>renderer.root.findAllByType('button');
const button=label=>buttons().find(b=>text(b)===label);
async function click(label){await act(()=>{const b=button(label);assert.ok(b,label);assert.ok(!b.props.disabled,label+' must be enabled');b.props.onClick()})}
async function mount(props={}){if(renderer)await act(()=>renderer.unmount());await act(()=>{renderer=create(React.createElement(Preview,{onOpen:f=>forms.push(f),onAction:(action,payload)=>calls.push({action,payload}),...props}))})}
async function expand(label){const d=renderer.root.findAllByType('details').find(d=>text(d.findByType('summary')).startsWith(label));assert.ok(d,label);await act(()=>d.props.onToggle({currentTarget:{open:true}}))}
async function viewProduct(name){await act(()=>{const b=buttons().find(b=>b.props['aria-label']==='查看'+name+'详情');assert.ok(b,'Product detail entry');assert.ok(!b.props.disabled);b.props.onClick()})}
async function submit(){await act(async()=>renderer.root.findByType('form').props.onSubmit({preventDefault(){}}))}
try{
 await mount({mode:'member'});
 assert.ok(text(renderer.toJSON()).includes('羽林宝阁'));assert.ok(!text(renderer.toJSON()).includes('库存保留款'),'Inactive products hidden from members');
 assert.equal(button('添加商品'),undefined);assert.equal(button('调整羽币'),undefined);assert.ok(!renderer.root.findAllByType('summary').some(n=>text(n).includes('群主管理')));
 let products=renderer.root.findAllByType('article').filter(n=>n.props.className?.includes('ts-product'));assert.equal(products.length,3);
 assert.ok(!buttons().some(b=>b.props['aria-label']?.startsWith('增加')),'Exhibition does not render quantity controls before opening a product');
 await viewProduct('虚构礼品 · 羽毛球挂件');const increment=buttons().find(b=>b.props['aria-label']?.startsWith('增加'));await act(()=>increment.props.onClick());
 await click('兑换 · 40 羽币');let form=forms.at(-1);assert.equal(form.action,'treasureRedeem');assert.equal(form.values.quantity,2);assert.equal(form.values.expectedPrice,20);assert.ok(form.description.includes('40 羽币'));assert.ok(form.description.includes('剩余 60 羽币'));
 await submit();assert.equal(calls.at(-1).action,'treasureRedeem');assert.equal(calls.at(-1).payload.quantity,2);assert.equal(calls.at(-1).payload.expectedPrice,20);assert.ok(!Object.hasOwn(calls.at(-1).payload,'reason'),'Shared automatic reason must not enter strict exchange command');
 assert.ok(text(renderer.toJSON()).includes('虚构操作已保存'));await expand('我的兑换');assert.equal(renderer.root.findAllByType('article').filter(n=>n.props.className==='ts-order').length,2,'Member sees only own history');assert.equal(button('确认完成'),undefined);
 await click('虚拟礼品');products=renderer.root.findAllByType('article').filter(n=>n.props.className?.includes('ts-product'));assert.equal(products.length,1);await viewProduct('虚构礼品 · 网前小霸王称号');await act(()=>buttons().find(b=>b.props['aria-label']?.startsWith('增加')).props.onClick());assert.ok(button('羽币不足')?.props.disabled);
 await mount({mode:'admin'});assert.equal(button('添加商品'),undefined);assert.ok(!renderer.root.findAllByType('summary').some(n=>text(n).includes('群主管理')),'Non-owner admin cannot manage shop');
 await mount();await expand('群主管理');await click('添加商品');form=forms.at(-1);assert.equal(form.action,'treasureProduct');assert.ok(form.fields.some(f=>f.key==='price'&&f.min===1));assert.ok(form.fields.some(f=>f.key==='stock'&&f.min===0));const productInput=form.convert({...form.values,name:'虚构新礼品',price:15,stock:9,reason:'ignored'});assert.equal(productInput.name,'虚构新礼品');assert.ok(!Object.hasOwn(productInput,'reason'));assert.ok(!Object.hasOwn(productInput,'expectedVersion'),'Creation has no existing version');
 await mount();await expand('群主管理');await click('编辑');form=forms.at(-1);assert.ok(Number.isInteger(form.values.expectedVersion),'Existing product dialog snapshots stock version');const editInput=form.convert({...form.values,reason:'ignored'});assert.equal(editInput.expectedVersion,form.values.expectedVersion);assert.ok(!Object.hasOwn(editInput,'reason'));await submit();assert.equal(calls.at(-1).payload.expectedVersion,editInput.expectedVersion,'Version reaches actual Forms submission');
 await mount();await expand('群主管理');await click('调整羽币');form=forms.at(-1);assert.ok(form.fields.some(f=>f.key==='adjustmentReason'&&f.required));assert.ok(renderer.root.findByType('textarea').props.required,'Manual grant reason renders and is required');assert.deepEqual(form.convert({playerId:'fixture-player-1',operation:'subtract',amount:5,adjustmentReason:' 修正测试发放 ',reason:'ignored'}),{playerId:'fixture-player-1',amount:-5,reason:'修正测试发放'});
 await mount();await expand('群主管理');const pending=renderer.root.findAllByType('article').filter(n=>n.props.className==='ts-order');assert.equal(pending.length,3);await act(()=>pending[1].findAllByType('button').find(b=>text(b).includes('取消并退还羽币')).props.onClick());form=forms.at(-1);assert.equal(form.action,'treasureOrder');assert.equal(form.values.status,'cancelled');await submit();assert.equal(calls.at(-1).payload.status,'cancelled');assert.ok(!Object.hasOwn(calls.at(-1).payload,'reason'));
 await mount({busy:true});assert.ok(buttons().filter(b=>b.props['aria-haspopup']==='dialog').every(b=>b.props.disabled));await expand('群主管理');assert.ok(button('添加商品').props.disabled);assert.ok(button('调整羽币').props.disabled);assert.ok(buttons().filter(b=>text(b).includes('确认完成')).every(b=>b.props.disabled));
 await mount({mode:'member',fail:true});await viewProduct('虚构礼品 · 羽毛球挂件');await click('兑换 · 20 羽币');await submit();assert.ok(renderer.root.findAll(n=>n.props.role==='alert').some(n=>text(n).includes('保存失败')));assert.equal(renderer.root.findAllByType('form').length,1,'Failure keeps confirmation available for recovery');
 console.log('PASS treasure shop UI: quantity/total confirmation and expected price, strict payloads, insufficient balance, owner-only management, required reason, pending refund, busy state and failed write recovery');
}finally{if(renderer)await act(()=>renderer.unmount());globalThis.IS_REACT_ACT_ENVIRONMENT=previous}
