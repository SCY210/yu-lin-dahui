/** Fixed representations keep upload URLs stable and prevent arbitrary transforms. */
export function photoUrl(id:string,variant?:'avatar'|'preview'){
 return '/api/photos/'+encodeURIComponent(id)+(variant?'?size='+variant:'');
}
