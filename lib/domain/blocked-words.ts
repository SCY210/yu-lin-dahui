import {z} from 'zod';
import type {Account,State} from './types';

export const blockedWordsInput=z.object({words:z.array(z.string().trim().min(1).max(100).transform(word=>word.normalize('NFC')).refine(word=>[...word].length<=50,'每个屏蔽词最多50个字').refine(word=>!/[\r\n]/.test(word),'屏蔽词不能包含换行')).max(200,'最多设置200个屏蔽词')}).strict();
export function normalizeBlockedWords(words:readonly string[]){
 const seen=new Set<string>();return words.map(word=>word.trim().normalize('NFC')).filter(word=>{const key=word.toLowerCase();if(!word||seen.has(key))return false;seen.add(key);return true});
}
export function blockedWordMasker(words:readonly string[]=[]){
 const terms=normalizeBlockedWords(words).sort((a,b)=>b.length-a.length);
 if(!terms.length)return (text:string)=>text;
 const escape=(word:string)=>word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const wordCharacter=/[\p{L}\p{N}\p{M}_]/u;
 const boundary='[\\p{L}\\p{N}\\p{M}_]';
 const pattern=terms.map(word=>{
  const characters=[...word];
  const before=wordCharacter.test(characters[0])?'(?<!'+boundary+')':'';
  const after=wordCharacter.test(characters.at(-1)!)?'(?!'+boundary+')':'';
  return before+escape(word)+after;
 }).join('|');
 const matcher=new RegExp('(?=('+pattern+'))','giu');
 return (original:string)=>{
  const text=original.normalize('NFC'),hidden=new Uint8Array(text.length);
  // Match complete entries at Unicode word boundaries, never a character inside a longer word/name.
  for(const match of text.matchAll(matcher)){const from=match.index!;hidden.fill(1,from,from+match[1].length)}
  let at=0,result='';for(const character of text){result+=hidden[at]?'*':character;at+=character.length}return result;
 };
}

const contentKeys=new Set(['name','title','note','caption','style','motto','equipment','racket','strings','tension','reason','ratingReason','venue','address']);
const structuralKeys=new Set(['auth','loginAccounts','accounts','me','blockedWords','words']);
/** Presentation only: keep identity, credentials, navigation links and historical facts intact. */
export function maskClubContent<T>(value:T,words:readonly string[]=[]):T{
 if(!words.length)return value;
 const mask=blockedWordMasker(words);
 const walk=(node:unknown,key=''):unknown=>{
  if(structuralKeys.has(key))return node;
  if(typeof node==='string')return contentKeys.has(key)?mask(node):node;
  if(Array.isArray(node))return node.map(item=>walk(item,key));
  if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).map(([key,item])=>[key,walk(item,key)]));
  return node;
 };
 return walk(value) as T;
}

/** Editing a masked but unchanged field must not overwrite its original or alter court identity. */
export function restoreMaskedEdits(s:State,a:Account,action:string,input:unknown):unknown{
 if(!s.settings.blockedWords?.length||!input||typeof input!=='object'||Array.isArray(input))return input;
 const p=input as Record<string,unknown>;let original:Record<string,unknown>|undefined;
 if(action==='profile')original=s.players.find(player=>player.id===(p.playerId??a.playerId)) as unknown as Record<string,unknown>;
 if(action==='profileDetails')original=s.players.find(player=>player.id===p.playerId)?.profile as unknown as Record<string,unknown>;
 if(action==='eventEdit'||action==='booking')original=s.events.find(event=>event.id===p.eventId) as unknown as Record<string,unknown>;
 if(action==='bookingEdit'){const b=s.bookings.find(b=>b.id===p.bookingId),e=b&&s.events.find(e=>e.id===b.eventId);if(b)original={...b,venue:b.venue??e?.venue,address:b.address??e?.address}}
 if(action==='register')original=s.registrations.find(r=>r.eventId===p.eventId&&r.playerId===p.playerId) as unknown as Record<string,unknown>;
 if(action==='courtRegister'){const b=s.bookings.find(b=>b.id===p.bookingId);original=s.registrations.find(r=>r.eventId===b?.eventId&&r.playerId===p.playerId)?.bookingSignups?.find(row=>row.bookingId===b?.id) as unknown as Record<string,unknown>}
 if(action==='settings')original=s.settings as unknown as Record<string,unknown>;
 if(!original)return input;
 const mask=blockedWordMasker(s.settings.blockedWords),next={...p};
 const fields=action==='booking'?['venue','address']:['name','title','note','venue','address','style','motto','equipment','racket','strings','tension'];
 for(const field of fields){const raw=original[field];if(typeof raw==='string'&&next[field]===mask(raw))next[field]=raw}
 return next;
}
