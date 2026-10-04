import {scryptSync,timingSafeEqual,randomBytes} from 'node:crypto';
export function passwordHash(password:string,salt:string){return scryptSync(password,salt,64,{N:16384,r:8,p:5,maxmem:32*1024*1024}).toString('hex')}
export function makePassword(password:string){const salt=randomBytes(32).toString('hex');return {salt,hash:passwordHash(password,salt)}}
export function checkPassword(password:string,salt:string,hash:string){const calculated=Buffer.from(passwordHash(password,salt),'hex'),expected=Buffer.from(hash,'hex');return calculated.length===expected.length&&timingSafeEqual(calculated,expected)}
export function sessionToken(){return randomBytes(32).toString('base64url')}
export const normalizeUsername=(value:string)=>value.normalize('NFKC').trim().toLowerCase();
