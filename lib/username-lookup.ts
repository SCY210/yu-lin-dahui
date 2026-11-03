import {raw} from './store';
import {legacyUsernameKey,normalizeUsername} from './password';

type Credential={id:string;username:string;salt:string;hash:string};
const olderNames="SELECT id,username,salt,hash FROM password_credentials WHERE username GLOB '*[^ -~]*'";
/** The credential a typed login name opens (docs/ACCOUNT_LOGIN.md): the name as typed (an older name kept the form it
 * was stored in), else its simplified key. An older name stored in traditional form, typed in simplified, matches
 * neither; only then, and only for a name with Chinese in it, the older non-ASCII names are compared by key. */
export async function findLoginCredential(typed:string){
 const legacy=legacyUsernameKey(typed),key=normalizeUsername(typed);
 const direct=await raw().prepare('SELECT id,username,salt,hash FROM password_credentials WHERE username IN (?,?) ORDER BY username=? DESC LIMIT 1').bind(legacy,key,legacy).first<Credential>();
 if(direct||/^[\x20-\x7e]*$/.test(key))return direct;
 return (await raw().prepare(olderNames).all<Credential>()).results.find(c=>normalizeUsername(c.username)===key)??null;
}
/** Whether a new login name (already its key) is in use: by a name stored under the same key, or by an older name that
 * differs only in case or in simplified and traditional form. Older non-ASCII names are few; they are compared here
 * rather than rewritten in the database. */
export async function usernameTaken(key:string,exceptId=''){
 if(await raw().prepare('SELECT id FROM password_credentials WHERE username=? COLLATE NOCASE AND id<>?').bind(key,exceptId).first())return true;
 const older=await raw().prepare("SELECT username FROM password_credentials WHERE id<>? AND username GLOB '*[^ -~]*'").bind(exceptId).all<{username:string}>();
 return older.results.some(r=>normalizeUsername(r.username)===key);
}
