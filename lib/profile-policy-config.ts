import {z} from 'zod';
import type {ProfileRestrictions} from './domain/types';

const ids=z.array(z.string().trim().min(1).max(100)).max(100);
/** Missing configuration permits the existing behavior; invalid policy fails closed. */
export function profileRestrictionsFromConfig(value:unknown):ProfileRestrictions|undefined{
 if(value===undefined||value==='')return;
 if(typeof value!=='string'||value.length>16384)throw new Error('Invalid profile permission configuration');
 try{
  const genderOnlyPlayerIds=[...new Set(ids.parse(JSON.parse(value)))].sort();
  return genderOnlyPlayerIds.length?{genderOnlyPlayerIds}:undefined;
 }catch{throw new Error('Invalid profile permission configuration')}
}
