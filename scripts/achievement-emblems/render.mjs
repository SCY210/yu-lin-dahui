import {createRequire} from 'node:module';const {chromium}=createRequire(import.meta.url)('playwright');import {readFileSync,writeFileSync} from 'node:fs';
import {defs,emblems} from './emblems.mjs';
// Usage: node scripts/achievement-emblems/render.mjs public/badges [base-badge-id]. Needs Playwright's Chromium.
// Draws each emblem into the indigo disc of an existing badge so new themes share the generated frame.
const base='data:image/webp;base64,'+readFileSync('public/badges/'+(process.argv[3]??'first-victory')+'.webp').toString('base64');
const b=await chromium.launch();const p=await b.newPage();const out={};
for(const [id,svg] of Object.entries(emblems)){
 const markup=`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">${defs}<g transform="translate(128 124) scale(1.14) translate(-128 -124)">${svg}</g></svg>`;
 out[id]=await p.evaluate(async ([base,markup])=>{const load=async src=>{const i=new Image();i.src=src;await i.decode();return i};
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.drawImage(await load(base),0,0);
  // Repaint the inner disc in the collection's indigo, then lay the new emblem over it.
  x.save();x.beginPath();x.arc(128,128,63,0,Math.PI*2);x.clip();const g=x.createRadialGradient(128,112,6,128,128,66);g.addColorStop(0,'#7c6fe0');g.addColorStop(.55,'#4a3fb3');g.addColorStop(1,'#2a2270');x.fillStyle=g;x.fillRect(0,0,256,256);
  for(let i=0;i<14;i++){x.fillStyle='rgba(255,246,214,'+(.25+(i%3)*.15)+')';x.beginPath();x.arc(80+((i*37)%100),76+((i*53)%96),i%2?1:1.6,0,Math.PI*2);x.fill()}
  x.drawImage(await load('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup)),0,0);x.restore();
  x.strokeStyle='rgba(241,195,90,.85)';x.lineWidth=2.4;x.beginPath();x.arc(128,128,63,0,Math.PI*2);x.stroke();
  return c.toDataURL('image/webp',.74)},[base,markup]);
 writeFileSync(process.argv[2]+'/'+id+'.webp',Buffer.from(out[id].split(',')[1],'base64'));
}
await b.close();
