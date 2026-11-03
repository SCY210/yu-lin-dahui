import {hanziPairs} from './username-hanzi-data';

let table:Map<string,string>|undefined;
/** Each traditional or regional character of a login name in its simplified form, so "羽林會" and "羽林会" are one account
 * (docs/ACCOUNT_LOGIN.md). Character by character: a login name has no phrases to convert. Server only; the table
 * (lib/username-hanzi-data.ts) is built once per isolate. */
export function simplifyHanzi(value:string){
 if(!table){table=new Map();const chars=Array.from(hanziPairs);for(let i=0;i<chars.length;i+=2)table.set(chars[i],chars[i+1])}
 let out='';for(const c of value)out+=table.get(c)??c;return out;
}
