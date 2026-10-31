import type {Photo} from './domain/types';

// A browser may retain bytes, but must ask the server before every reuse.
// Never apply this policy to shared caches, errors or other private API data.
export const photoCacheControl='private, no-cache, must-revalidate';
const tagPattern=/^"photo-v1-[0-9a-f]{64}"$/;
export function isPhotoEtag(value:string|null):value is string{return value!==null&&tagPattern.test(value)}

export async function photoEtag(photo:Photo,accountId:string){
 // Uploads create media/<new UUID>; deleting a photo removes its database row
 // before its object. Repairs must use a new key, not overwrite existing bytes.
 const identity=JSON.stringify([accountId,photo.id,photo.key,photo.created,photo.type,photo.size]);
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity));
 const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 return '"photo-v1-'+hash+'"';
}

export function matchesPhotoEtag(header:string|null,etag:string){
 if(!header||header.length>4096)return false;
 const tags=header.split(',').map(tag=>tag.trim());
 // Only a valid explicit validator permits skipping object storage. Wildcards,
 // malformed lists and unknown validators safely take the full read path.
 if(!tags.every(tag=>/^(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(tag)))return false;
 return tags.some(tag=>(tag.startsWith('W/')?tag.slice(2):tag)===etag);
}
