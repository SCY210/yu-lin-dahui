export const genderOptions = [
 ['male','男'], ['female','女'], ['other','其他'], ['undisclosed','不愿透露'],
] as const;
export type ProfileGender = typeof genderOptions[number][0];
export const genderLabels:Record<ProfileGender,string>=Object.fromEntries(genderOptions) as Record<ProfileGender,string>;
