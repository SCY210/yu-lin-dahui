// Reproducible PNG app icons from the shared editable vector masters.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {brandIconArt,sharedBrandPalettes} from './brand-icon-art.mjs';
const sharp = createRequire(import.meta.url)('sharp');
mkdirSync('public/icons', {recursive:true});
for (const theme of ['classic','wuxia']) {
  const svg = Buffer.from(brandIconArt(sharedBrandPalettes[theme]));
  writeFileSync(`public/brand/${theme}-v4.svg`,svg);
  writeFileSync(`public/brand/${theme}-v3.svg`,svg);
  for (const [suffix,size] of [['192',192],['512',512],['apple',180],['maskable',512]]) {
    const png = await sharp(svg).resize(size,size).flatten({background:'#ffffff'}).png().toBuffer();
    writeFileSync(`public/icons/${theme}-${suffix}-v4.png`,png);
    writeFileSync(`public/icons/${theme}-${suffix}-v3.png`,png);
  }
}
writeFileSync('public/favicon.svg',readFileSync('public/brand/classic-v4.svg'));
writeFileSync('public/yulin-mark.svg',readFileSync('public/brand/classic-v4.svg'));
for (const [name,suffix] of [['app-192','192'],['app-512','512'],['apple-touch-icon','apple'],['app-maskable-512','maskable']]) {
  const png=readFileSync(`public/icons/classic-${suffix}-v4.png`);
  writeFileSync(`public/icons/${name}.png`,png);
  const old=name==='app-maskable-512'?'app-maskable-feather-512':name==='apple-touch-icon'?'apple-touch-icon-feather':`${name}-feather`;
  writeFileSync(`public/icons/${old}.png`,png);
}
writeFileSync('public/apple-touch-icon.png',readFileSync('public/icons/classic-apple-v4.png'));
