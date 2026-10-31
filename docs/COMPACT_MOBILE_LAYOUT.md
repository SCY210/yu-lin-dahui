# Compact mobile sections

Primary actions and short summaries stay visible. Secondary lists and explanations use explicit native disclosures rather than hidden CSS content or smaller typography.

| View | Initially visible | Open on demand |
| --- | --- | --- |
| Court signup | Court/time, capacity, signup action, first six profile avatar links | Formal and waiting lists, per-person changes; pending cancellation requests initially expand the roster |
| Live play | Current matches and score controls, own rest preference | Other players, completed matches and partner setup |
| Fees | Confirmation state, own amount, confirmation/notification controls and recipient in one card | Complete per-person split, cost summary/rules, expense editing and exemptions |
| Player profile | Identity, realm, short motto preview and permitted edit controls | Personal information/style, equipment/photos, statistics and achievements |
| My | Profile/realm, achievement entry, newest personal split and settings entry | Achievement collection and earlier confirmed activity splits |
| Social play | Open post-event MVP voting; active arena/KOC information | Ordinary play setup and pre-event MVP preview |

Amounts, financial confirmation, score permissions, account restrictions, profile perspective and navigation are unchanged. Profile avatar/name links still use the existing navigation history. No data migration is required. Achievement content loads only on first expansion and remains mounted on later collapse so its filters are retained. Other native disclosure sections preserve the existing lazy-mount behavior.

Validation: `tests/compact-sections-ui.mjs` exercises the actual React components and verifies collapse/expand, profile links, registration editing, own rest changes, fee notification payloads, complete split access, and latest-confirmed/history selection. Existing profile, score, signup and API suites remain required. The checks use isolated fictional fixtures and do not write to production. CSS retains theme variables, readable text and touch targets; browser/device rendering must be reported separately from component tests.

## Club header

Inside the club the header is one compact block, so content starts high on a phone:

- The theme picker is an icon button in the header icon row, next to the treasure and reminder icons. The separate theme toolbar row above the page appears only on pages outside the club, such as sign-in.
- On phones, the three icons are 36 px boxes and the reminder shows only its bell. Its text stays available to screen readers, and the unread count sits on the corner.
- The page gradient and texture are painted on the root element, and the body is transparent. A separate body background let a plain strip of the root colour show at the top: a collapsed top margin exposed it, and it also showed under the iOS status bar.
