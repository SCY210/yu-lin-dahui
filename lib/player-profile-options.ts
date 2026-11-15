export const genderOptions = [
 ['male','男'], ['female','女'], ['other','其他'], ['undisclosed','不愿透露'],
] as const;
export type ProfileGender = typeof genderOptions[number][0];
export const genderLabels:Record<ProfileGender,string>=Object.fromEntries(genderOptions) as Record<ProfileGender,string>;
/** Scheduling balances mixed doubles by gender, so anything but male or female is asked again (app/gender-prompt.tsx). */
export const needsGender=(gender?:string)=>gender!=='male'&&gender!=='female';
/** Members transfer fee shares to each other directly when there is no single collector, so each member is asked for a
 * phone number until one is saved (app/phone-prompt.tsx, docs/PROFILE_PHONE.md). */
export const needsPhone=(phone?:string)=>!phone?.trim();
/** Digits, an optional leading + and common separators; 5–20 digits. Shared by the form and the server. */
export const phonePattern=/^\+?[\d ()-]+$/;
export function phoneProblem(phone:string){const digits=phone.replace(/\D/g,'').length;return !phone.trim()?'请填写电话号码':!phonePattern.test(phone)?'电话号码只可包含数字、区号及常用分隔符':digits<5||digits>20?'请检查电话号码':''}
