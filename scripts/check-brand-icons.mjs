import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const sharp=createRequire(import.meta.url)('sharp');
const names=readdirSync('public/brand').filter(n=>n.endsWith('-v4.svg'));
for(const name of names){
 const theme=name.slice(0,-7),svg=readFileSync('public/brand/'+name,'utf8');
 for(const [suffix,size]of [['192',192],['512',512],['apple',180],['maskable',512]]){
  const icon=readFileSync(`public/icons/${theme}-${suffix}-v4.png`),metadata=await sharp(icon).metadata();
  assert.equal(metadata.width,size);assert.equal(metadata.height,size);assert.equal(metadata.hasAlpha,false);
  assert.deepEqual(icon,readFileSync(`public/icons/${theme}-${suffix}-v3.png`));
 }
 // Rasterize only the essential shuttle silhouette. Android launchers may
 // crop anything outside the central circle of radius 40% of the icon width.
 const defs=svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
 const start=svg.indexOf('<g transform='),end=svg.lastIndexOf('</g>')+4;
 assert.ok(defs&&start>0&&end>start);
 const foreground=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">${defs}${svg.slice(start,end)}</svg>`;
 const {data,info}=await sharp(Buffer.from(foreground)).resize(512,512).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let extent=0;for(let y=0;y<512;y++)for(let x=0;x<512;x++)if(data[(y*512+x)*info.channels+3]>16)extent=Math.max(extent,Math.hypot(x-255.5,y-255.5));
 assert.ok(extent<512*.4,`${theme} shuttle exceeds the maskable safe circle: ${extent}`);
}
mkdirSync('.test-output',{recursive:true});
console.log(`PASS ${names.length} theme icons: 180/192/512 sizes, opaque RGB, legacy compatibility and rasterized Android safe-circle check`);
