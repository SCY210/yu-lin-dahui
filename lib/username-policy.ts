import {z} from 'zod';

// Validate original characters before normalization: full-width letters are not
// valid new account names. Existing login names keep their legacy reader.
export const newUsername=z.string().trim().min(2,'登录账号至少2位').max(32,'登录账号最多32位').regex(/^[A-Za-z0-9]+$/,'登录账号只能包含英文字母和数字').transform(value=>value.toLowerCase());
export const changeUsernameInput=z.object({
 action:z.literal('changeUsername'),
 newUsername,
 currentPassword:z.string().min(1,'请填写当前密码').max(128,'密码最多128位').optional(),
 accountId:z.string().min(1).max(100).optional(),
 requestId:z.string().uuid(),
}).strict();
export type ChangeUsernameInput=z.infer<typeof changeUsernameInput>;
export function canChangeOwnUsername(isOwner:boolean,credential:{usernameChangedAt:number|null}|null){return !!credential&&(isOwner||credential.usernameChangedAt===null)}
