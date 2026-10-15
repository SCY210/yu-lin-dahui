import type {State} from './types';

/** A woman is protected when both men of the opposing pair are at least this much stronger (修为 / grouping rating). */
export const genderGapPoints=150;
/** Two women may face two men only when both women are at least two realms (300 points) above both men. */
export const womenPairGapPoints=2*genderGapPoints;

/** Only players who declared themselves female are protected; everyone else (male, other, undisclosed or unset)
 * counts as a man for this rule, as the club owner decided. Friends brought to one activity have no profile; they
 * give their gender when they are signed up (`guestGender`). */
export function isFemale(s:Pick<State,'players'>,id:string){const p=s.players.find(p=>p.id===id);return (p?.profile?.gender??p?.guestGender)==='female'}

/** Doubles line-ups to avoid, counted per woman so the optimiser can prefer splits with none:
 * - a pair of men facing a pair of women, unless both women are at least `womenPairGapPoints` above both men;
 * - a pair of men facing a team with a woman whose rating is at least `genderGapPoints` below both of them.
 * Two men and two women can therefore always be split into two mixed pairs instead. Strong women against weaker
 * men in mixed pairs are fine. Singles and incomplete teams never count. */
export function genderMismatches(s:Pick<State,'players'>,a:string[],b:string[],rating:(id:string)=>number){
 if(a.length!==2||b.length!==2)return 0;
 const against=(men:string[],other:string[])=>{
  if(men.some(id=>isFemale(s,id)))return 0;
  if(other.every(id=>isFemale(s,id)))return other.every(w=>men.every(m=>rating(w)-rating(m)>=womenPairGapPoints))?0:other.length;
  return other.filter(id=>isFemale(s,id)&&men.every(m=>rating(m)-rating(id)>=genderGapPoints)).length;
 };
 return against(a,b)+against(b,a);
}
