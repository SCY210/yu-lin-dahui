# Contextual feature guides

app/feature-guide.tsx provides a shared guide entry:

```tsx
import FeatureGuide from './feature-guide';
<FeatureGuide topic="ranking" rules={viewedSeasonRules} />
<FeatureGuide topic="accounts" label="Account help" />
```

Props: required topic: GuideTopic, optional rules: Rules, and optional label. GuideTopic, guideTopics, guideLabels, and getFeatureGuide(topic, rules?) are exported from lib/feature-guides.ts. Without rules, the domain defaults are used. Ranking/history pages must pass the actual viewed season so historical rules are not replaced by current defaults.

Topics: ranking, rating, titles, activities, signup, grouping, matches, fees, partners, challenges, state, modes, photos, annual, accounts. Each entry opens its own topic and permits switching to all topics. Reopening restores the entry topic.

Radix Dialog handles modal focus, Escape, and focus restoration. DialogTitle/DialogDescription supply accessible naming. Buttons use type=button, touch targets at least 44px, and visible focus. The bounded dialog uses a separately scrollable 16px body; tables have captions and row/column headers. Verify the integrated 390px layout, keyboard access, and screen-reader labels.

## Rules represented by the guide

Guides describe current domain/API behavior and do not change scoring:

- ranking.ts: monthly matches ordered by start time/ID, first cap eligible games (cap=0 means unlimited); no minimum-game qualification; points, win rate, then average point difference; exact ties share rank. Elo replays by completion time with team means, K, and a 400-point scale.
- types.ts: defaults win=3, loss=0, cap=12, target=21, lead=2, ceiling=30, K=32; Madrid months. rules.minimum is retained only for compatibility.
- social.ts: bronze below 900, silver 900-1049, gold 1050-1199, platinum 1200-1399, diamond from 1400. Elo is provisional below ten rated matches. Form uses at most ten recent complete matches; fewer than five is insufficient. Integer form >=70 is hot, <=30 is low. Relationship labels need three matches; the weakest-partner label needs at least two qualifying alternatives.
- commands.ts: capacity, waitlist ordering/promotion, late cancellation requests, participation state, draft/publish/start transitions, valid terminal game scores, best-of-three, preserved season rules, and settlement versions.
- grouping.ts/play.ts: opportunity deficits and waiting priority, Elo balance and repetition costs, locked drafts, arena winners/challengers, rotating partners, within-team role labels, and suggested handicap from a team-mean gap of at least 120 (round(gap/60), capped at eight).
- social-commands.ts: tag votes keyed by account/player/tag and retractable; activity award votes keyed by account/category and changeable, excluding self-votes. The current eligible-activity rules come from activity-voting.ts. Challenges require an actual historical loss and place accepted opponents on different teams in an unstarted match. Applied handicap disables monthly points and Elo.
- money.ts: equal/duration/interval splits, actual participation, integer-cent largest remainder, and participant/subsidy/unallocated reconciliation. The current app does not promise payment collection.
- photo API: at most 5 MiB JPEG/PNG/WebP, checked structure/dimensions, explicit uploader rights confirmation, protected reads, match-based four-player associations, or manually selected actual attendees. No facial recognition.
- social.ts/social-hub.tsx: annual calculations use Madrid start years and complete matches, but the annual entry is currently hidden. Played minutes mean match duration. Annual opponent metrics and all-time relationship labels use their respective sample/win-rate rules.
- auth/club APIs: administrator-managed accounts/reset, identity preservation, username/password without email, authentication, and numeric Elo hidden from ordinary members.

Examples are labeled examples rather than fabricated current data. Score examples follow the viewed season's rules; point examples account for a cap smaller than their example sample.

## Integration

Entries exist on home, monthly rankings, personal account/profile, activity signup/grouping/scoring/modes, fees, social pages, albums, and account administration.

Home/ranking/personal pages use the viewed month; activities use their start month; other entries use current defaults. Verify all fifteen topics, headings, tables, 390px overflow, Escape focus restoration, and related-topic navigation after modifications. Generated screenshots and session-specific reports are local outputs.
