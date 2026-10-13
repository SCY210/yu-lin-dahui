# Gender-aware pairing

At the club owner's request, doubles pairing avoids line-ups where a pair of men faces a team with a much weaker woman.

## Rule (`lib/domain/gender-balance.ts`)

A doubles match counts one **mismatch** for each woman on a team whose rating is at least `genderGapPoints` (150, one realm) below **both** players of an opposing pair of men. The rating is the grouping rating (the doubles-only long-term rating).

- Only players with the profile gender `female` are protected. Everyone else (male, other, undisclosed or unset) counts as a man for this rule.
- The reverse, strong women against weaker men, is allowed.
- Mixed pairs, singles and incomplete teams never count.

## How it is applied

`BalanceCost` has a `mismatches` field that is compared before the rating gaps, the partner variety and every other preference (`compareBalance`). It is used wherever the players already chosen to play are split into teams or courts:

- live rotation (`pair` in `lib/domain/live-play.ts`);
- round-by-round and planned generation (per-court pairings and the cross-court search in `lib/domain/grouping.ts`);
- the fixed-partner opponent search (`lib/domain/fixed-partners.ts`).

It never changes **who** plays or rests. Turn fairness, bench priority, availability and venue rules stay upstream, and fixed partners are never split. When every split has a mismatch (for example three strong men and one weaker woman), the best balanced split is still scheduled. Manual lineup corrections by organisers are not changed.

Tests: `tests/gender-balance.test.ts`.
