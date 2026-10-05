// Verified live identities; display names and administrator role alone never grant access.
export const aquariumAccountId='account:2decd719-99de-4679-9f4d-897f39f818ce';
export const aquariumPlayerId='ca023b58-7c95-4fa0-89f8-6a85f27ed1dd';
export const legacyThemeOwnerId='uoVo7RaSrpRMqVTmKzLB3vvo0m9s8pOKfx7c6JAUxtROd5NVdL4z7B';
export function isAquariumQueen(account:{id:string;playerId:string}|null|undefined){return account?.id===aquariumAccountId&&account.playerId===aquariumPlayerId}
export function canUseAquariumTheme(account:{id:string;playerId:string;role?:string}|null|undefined,ownerAccountId=legacyThemeOwnerId){return isAquariumQueen(account)||!!account&&account.id===ownerAccountId&&account.role==='admin'}
