export type TensionRecord={tension?:string;tensionMin?:number|null;tensionMax?:number|null};
export function tensionRange(profile:TensionRecord|undefined):{min:number;max:number}|null{
 if(!profile)return null;
 if('tensionMin' in profile||'tensionMax' in profile){
  const min=profile.tensionMin,max=profile.tensionMax;
  return typeof min==='number'&&typeof max==='number'&&Number.isFinite(min)&&Number.isFinite(max)&&min>=1&&max<=80&&min<=max?{min,max}:null;
 }
 const text=profile.tension?.normalize('NFKC').trim()??'';
 const match=text.match(/^(\d+(?:\.\d+)?)\s*(?:[-–—~～至/]\s*(\d+(?:\.\d+)?))?\s*(?:磅|lbs?)?$/i);
 if(!match)return null;
 const min=Number(match[1]),max=Number(match[2]??match[1]);
 return min>=1&&max<=80&&min<=max?{min,max}:null;
}
export function tensionLabel(profile:TensionRecord|undefined){
 const range=tensionRange(profile);
 if(range)return `${range.min}–${range.max} 磅`;
 if(profile&&!('tensionMin' in profile||'tensionMax' in profile)&&profile.tension?.trim())return '旧记录：'+profile.tension.trim();
 return '';
}
