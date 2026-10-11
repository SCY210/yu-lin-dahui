import type {State} from './types';

/** A woman is protected when both men of the opposing pair are at least this much stronger (修为 / grouping rating). */
export const genderGapPoints=150;

/** Only players who declared themselves female are protected; everyone else (male, other, undisclosed or unset)
 * counts as a man for this rule, as the club owner decided. */
export function isFemale(s:Pick<State,'players'>,id:string){return s.players.find(p=>p.id===id)?.profile?.gender==='female'}

/** Doubles line-ups to avoid: a pair of men facing a team with a woman whose rating is at least `genderGapPoints`
 * below both of them. The reverse (strong women against weaker men) is fine. Returns how many such women there are,
 * so the optimiser can prefer splits with none. Singles and incomplete teams never count. */
export function genderMismatches(s:Pick<State,'players'>,a:string[],b:string[],rating:(id:string)=>number){
 if(a.length!==2||b.length!==2)return 0;
 const against=(men:string[],other:string[])=>men.some(id=>isFemale(s,id))?0:other.filter(id=>isFemale(s,id)&&men.every(m=>rating(m)-rating(id)>=genderGapPoints)).length;
 return against(a,b)+against(b,a);
}
