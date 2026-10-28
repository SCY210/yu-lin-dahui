# Pairing odds

The owner and administrators can set, for one activity that has not ended, the chance that given members play as partners rather than opponents when they share a court (`lib/domain/pairing-odds.ts`). The panel is in group management (`app/pairing-odds-panel.tsx`) and carries no explanation on screen. Saving with no rule left clears the activity.

- **Default rules.** One or more members, one or more other members, and a partner chance from 0 to 100% (50% by default). Whenever one of the first and one of the second share a court, they are partners with that chance and opponents otherwise.
- **Conditional rules.** Two chosen members, one or more condition members, and two chances. When the two chosen members share a court and one of the other two players is a condition member, they are partners with the first chance; when both other players are condition members, with the second.

A conditional rule takes precedence over the default rules for the same two members. Rules are drawn in that order, each keeping only the team splits where its two members are partners (or opponents); a rule that no split can satisfy any more is skipped.

The odds only decide partners and opponents. Fair turns, rests, venue limits and balance still choose who plays and who shares a court, exactly as without odds; among the splits the draw allows, the usual balance cost picks one. They apply to rotating doubles in every scheduling mode: rounds generated one at a time, planned schedules, gap rounds and live courts. Fixed partners and singles have no partners to choose, so the odds do not apply there.

Draws use a random stream of their own, mixed from the round's seed (from the time and court on live courts), so the lineup search is unchanged when there are no odds.

Storage and visibility: the rules live in `settings.pairingOdds`, one entry per activity. Only the owner and administrators receive them in the club view, and only for activities that have not ended; members never receive them, and saving drops entries of activities that are over. Saving adds an administrator audit row with the activity only.

Validation: `tests/pairing-odds.test.ts` checks the chances over many seeds, the precedence of conditional rules, that lineups and court sharing stay the same, live courts, and who may set and see the rules. `tests/pairing-odds-ui.mjs` covers the panel.
