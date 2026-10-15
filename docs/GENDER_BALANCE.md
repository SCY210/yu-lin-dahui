# Gender-aware pairing

Doubles pairing avoids line-ups where a pair of men faces a pair of women, or a team with a much weaker woman.

## Rule (`lib/domain/gender-balance.ts`)

A doubles match counts one **mismatch** for each woman on a team that faces a pair of men when:

- the team is two women, unless both women are at least `womenPairGapPoints` (300, two realms) above **both** men (requested by the club in October 2026; previously a pair of women of similar level could face a pair of men); or
- the woman's rating is at least `genderGapPoints` (150, one realm) below **both** men.

Two men and two women of similar level are therefore always split into two mixed pairs. The rating is the grouping rating (the doubles-only long-term rating).

- Only players with the profile gender `female` are protected. Everyone else (male, other, undisclosed or unset) counts as a man for this rule.
- Friends brought to one activity have no profile. They must give a gender (male or female) when they are signed up, stored as `guestGender`; the registrant, the activity organiser or an administrator can correct it later (`guestGender` command). Friends added before this rule have none and count as men until it is filled in; the friends list on the activity points them out.
- Strong women against weaker men in mixed pairs are allowed.
- Mixed pairs, singles and incomplete teams never count.

## How it is applied

`BalanceCost` has a `mismatches` field that is compared before the rating gaps, the partner variety and every other preference (`compareBalance`). It is used wherever the players already chosen to play are split into teams or courts:

- live rotation (`pair` in `lib/domain/live-play.ts`);
- round-by-round and planned generation (per-court pairings and the cross-court search in `lib/domain/grouping.ts`);
- the fixed-partner opponent search (`lib/domain/fixed-partners.ts`).

It never changes **who** plays or rests. Turn fairness, bench priority, availability and venue rules stay upstream, and fixed partners are never split. When every split has a mismatch (for example three strong men and one weaker woman, or two fixed pairs of men and of women), the best balanced split is still scheduled. Manual lineup corrections by organisers are not changed.

Tests: `tests/gender-balance.test.ts`.
