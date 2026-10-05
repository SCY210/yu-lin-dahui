// Raster app icons are derived from the editable SVG master; no bitmap editing.
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const svg=readFileSync('public/yulin-mark.svg');
writeFileSync('public/favicon.svg',svg);
for(const [name,size]of [['app-192',192],['app-512',512],['apple-touch-icon',180]]){
 const icon=await sharp(svg).resize(size,size).png().toBuffer();
 writeFileSync(`public/icons/${name}.png`,icon);
 writeFileSync(`public/icons/${name}-feather.png`,icon);
}
const mark=await sharp(svg).resize(448,448).png().toBuffer();
const mask=await sharp({create:{width:512,height:512,channels:4,background:'#6c293d'}}).composite([{input:mark,left:32,top:32}]).png().toBuffer();
writeFileSync('public/icons/app-maskable-512.png',mask);
writeFileSync('public/icons/app-maskable-feather-512.png',mask);
