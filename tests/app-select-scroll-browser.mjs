// Manual browser regression. YULIN_PLAYWRIGHT_MODULE may point to an existing Playwright index.mjs.
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';

const {chromium}=await import(process.env.YULIN_PLAYWRIGHT_MODULE?pathToFileURL(path.resolve(process.env.YULIN_PLAYWRIGHT_MODULE)).href:'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'.test-output/app-select-scroll-browser');mkdirSync(out,{recursive:true});
await build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import Preview from './tests/fixtures/app-select-preview';import './app/wuxia-theme.css';createRoot(document.getElementById('root')).render(<Preview theme={new URLSearchParams(location.search).get('theme')==='wuxia'?'wuxia':'classic'}/>);",resolveDir:root,loader:'tsx'},bundle:true,external:['/wuxia-hero.webp'],platform:'browser',format:'iife',outfile:path.join(out,'app.js'),alias:{'@':root},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},logLevel:'silent'});
const css=await postcss([tailwind({base:root})]).process(readFileSync(path.join(root,'app/globals.css'),'utf8'),{from:path.join(root,'app/globals.css')});writeFileSync(path.join(out,'global.css'),css.css);
writeFileSync(path.join(out,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/global.css"><link rel="stylesheet" href="/app.css"><body><div id="root"></div><script src="/app.js"></script></body></html>');
const files={'/':'index.html','/app.js':'app.js','/app.css':'app.css','/global.css':'global.css'};
const server=createServer((req,res)=>{const file=files[req.url.split('?')[0]];if(!file){res.writeHead(404);res.end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(path.join(out,file)))});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];
try{
 for(const theme of ['classic','wuxia'])for(const width of [320,390,1000]){
  const mobile=width<500,page=await browser.newPage({viewport:{width,height:850},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/?theme='+theme);
  const combo=name=>page.getByRole('combobox',{name,exact:true}),menu=()=>page.locator('[data-app-select-menu]');
  async function exerciseScroll(name){
   await combo(name).click();const list=page.getByRole('listbox');await list.waitFor();await page.waitForTimeout(50);
   const before=await list.evaluate(el=>({top:el.scrollTop,max:el.scrollHeight-el.clientHeight}));assert.ok(before.max>50,name+' needs a real overflowing list');
   const box=await list.boundingBox(),direction=before.top>=before.max/2?-1:1,background=await page.evaluate(()=>({page:scrollY,dialog:document.querySelector('[data-slot=dialog-content]')?.scrollTop??0}));
   if(mobile){
    const cdp=await page.context().newCDPSession(page),x=box.x+box.width/2,from=box.y+box.height*(direction===1?.82:.18),to=box.y+box.height*(direction===1?.18:.82);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
    for(let step=1;step<=8;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*step/8}]});await page.waitForTimeout(16)}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }else{await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,direction*330)}
   await page.waitForTimeout(300);const after=await list.evaluate(el=>el.scrollTop);
   assert.ok((after-before.top)*direction>8,name+': genuine '+(mobile?'touch':'wheel')+' did not scroll '+JSON.stringify({before,after}));
   assert.deepEqual(await page.evaluate(()=>({page:scrollY,dialog:document.querySelector('[data-slot=dialog-content]')?.scrollTop??0})),background,name+' moved the background');
   const bounds=await menu().boundingBox(),height=page.viewportSize().height;assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,JSON.stringify(bounds));
   results.push({theme,width,control:name,input:mobile?'touch':'wheel',before:before.top,after});
  }
  await exerciseScroll('独立长列表');await page.keyboard.press('Escape');await menu().waitFor({state:'hidden'});
  await page.getByRole('button',{name:'打开报名表单',exact:true}).click();
  await exerciseScroll('球馆');await page.getByRole('option',{name:'风行球馆',exact:true}).click();assert.ok((await combo('球馆').textContent()).includes('风行球馆'));assert.ok(await page.getByRole('link',{name:/Calle de San Jaime 7/}).count());
  await exerciseScroll('报名球友');await page.keyboard.press('End');await page.keyboard.press('Enter');await menu().waitFor({state:'hidden'});assert.ok((await combo('报名球友').textContent()).includes('球友24'));
  await exerciseScroll('活动开始 · 时间');await page.keyboard.press('Escape');await menu().waitFor({state:'hidden'});assert.ok(await page.getByRole('heading',{name:'选择球友',exact:true}).count());
  await combo('报名球友').click();await page.getByRole('searchbox',{name:'搜索报名球友',exact:true}).fill('球友20');assert.equal(await page.getByRole('option').count(),1);await page.getByRole('option',{name:/虚构球友20/}).click();
  await combo('报名球友').click();await page.keyboard.press('Tab');await menu().waitFor({state:'hidden'});assert.equal(await page.getByRole('textbox',{name:'补充留言',exact:true}).evaluate(el=>el===document.activeElement),true,'Tab must return to the next form field');
  await combo('报名球友').click();await page.goBack();await menu().waitFor({state:'hidden'});assert.ok(await page.getByRole('heading',{name:'选择球友',exact:true}).count(),'Back must close only the picker');
  await page.setViewportSize({width,height:560});await exerciseScroll('球馆');await page.screenshot({path:path.join(out,`scroll-${theme}-${width}.png`)});await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'关闭',exact:true}).click();
  const pageBefore=await page.evaluate(()=>scrollY);await page.mouse.move(width/2,450);await page.mouse.wheel(0,300);await page.waitForTimeout(200);assert.ok(await page.evaluate(previous=>scrollY>previous,pageBefore),'closing the form must release its scroll lock');
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();
 }
 writeFileSync(path.join(out,'receipt.json'),JSON.stringify(results,null,2)+'\n');console.log('PASS '+results.length+' real wheel/touch scroll checks across venue, player, time and outside-dialog lists; search, nested Escape/Back, Tab, narrow/short viewports and both themes');
}finally{await browser.close();await new Promise(r=>server.close(r))}
