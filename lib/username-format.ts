/** New login names (docs/ACCOUNT_LOGIN.md): 2–32 Chinese characters, English letters or digits, shared by the forms and
 * the server. Chinese is the CJK unified ideographs (with extension A and the compatibility block, which the server folds
 * into the unified ones); full-width letters are not accepted. Written as plain ranges, not `\p{…}`, so older browsers
 * still parse the forms' script. */
const characters='A-Za-z0-9\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF';
export const usernamePattern='['+characters+']{2,32}';
export const usernameCharacters=new RegExp('^['+characters+']+$');
export const isNewUsername=(value:string)=>new RegExp('^'+usernamePattern+'$').test(value);
export const usernameRule='2–32位中文、英文字母或数字';
