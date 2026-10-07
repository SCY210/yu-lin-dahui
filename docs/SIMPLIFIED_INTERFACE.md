# Simpler application interface

Branch: `feature/simplify-app-interface`, based on `feature/balanced-match-grouping`.
Review and merge the grouping branch before this interface branch.

The default view shows the information needed for the current action. Secondary
data stays available through native, keyboard-accessible disclosures. Content
inside `Disclosure` mounts when opened, rather than fetching or rendering the
whole secondary screen immediately. The existing themes remain available, with
smaller headings and tighter spacing in the club shell.

| Screen | Visible first | Available on expansion |
| --- | --- | --- |
| Home | Next activity, main navigation, quarter leaders | Recent matches |
| Activities | Upcoming/current activities in time order | Past activities |
| Grouping | Playing rounds and the next pending round, profiles, publish/start/score | Other rounds, planning/voting, draft court tools and match administration |
| Fees | Totals, each person's amount, settlement actions and unallocated warnings | Rules, cost records, exemptions, time breakdown and previous versions |
| Ranking | Names, points, basic results and level | Detailed metrics toggle; monthly calculation rules |
| Player profile | Identity and personal information | Equipment, match statistics, achievements and partner/opponent records |
| My account | Identity, headline statistics, profile link and confirmed bills | Account/password, notifications/install, achievements and recent matches |
| Administration | Named management sections | Accounts, word filters, ratings, roles, rules, historical recalculation and audits |
| Event social | Current playing mode and its settings | Awards and style voting, initially expanded when award voting is available |
| Login | Credentials, login button and account help | Legacy login and installation |
| Shared forms | Required fields and save | Optional profile/gear/time fields; their stored values remain in the submitted form |

The random seed is still generated internally, but is no longer a field in the
round-generation form. Profile navigation works for locked matches; position
swap controls disappear while locked. Published matches no longer show an empty
administration disclosure. Draft/published next-round selection uses start time;
completed and future rounds remain expandable. Changing a round's status updates
which round opens automatically.

No authentication, role rules, scoring rules or stored business records change
in this branch. All existing forms and administrative actions remain reachable.

## Verification

- All 415 unit tests and the existing API checks pass on Node 24.
- TypeScript and the production build pass.
- The new disclosure component passes ESLint. Compared with the grouping branch,
  existing modified files introduce no additional lint errors or warnings; the
  repository already contains lint errors, mostly existing `any` annotations.
- Browser checks with fictional branch-local data verified fee tools, planning
  and voting, a profile opened from a locked match, expandable statistics,
  account and rating controls, and compact/detailed ranking toggles.
- Saving a gender choice while optional fields were collapsed preserved the
  existing profile text. Optional fields remain editable after expansion.
- At 390px width, home, ranking, account, grouping and the profile form had no
  horizontal overflow; the temporary viewport override was restored.

Use the repository's `start-local-test.cmd` on this branch for an independent,
persistent local environment. Its records are fictional and separate from the
grouping branch and the deployed site.
