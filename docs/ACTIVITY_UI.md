# Activity workflow and interface

An activity groups a badminton session's bookings, registrations, rounds, matches, and costs. Its grouping/matches tab provides draft generation, rest lists, publishing, starting, and scoring. There is no separate bottom-navigation match page. Home shows up to six upcoming signup cards without a recent-match section; personal match summaries link to their parent activity. Deleted activity recovery is restricted to its creator and the club owner; see [visibility rules](EVENT_PRIVACY_AND_HOME.md).

Rankings include avatars and all enabled players without a minimum-game threshold. A month selector supports previous/next months and an explicit year/month panel.

Select menus use an opaque white overlay, dark 16px text, at least 44px rows, a selected highlight, and a checkmark. Venue and status selectors retain the indigo/purple design.

Renaming the club preserves the existing invitation hash for compatibility. See [account management](ACCOUNT_LOGIN.md) for administrator-created logins and legacy migration. Audience/deployment changes require explicit authorization and are independent of source refactoring.

Check venue menu opacity, month-dependent ranking data, grouping/matches inside an activity, keyboard focus, and 390px overflow after UI changes. Historical screenshot/run outputs remain local.

## Direct event sharing

The signup summary prioritizes sharing to WeChat groups. Inside WeChat, use its top-right forwarding menu; outside WeChat, use the native share sheet when available. Invitations exclude rosters and require normal member authentication. See [event sharing](EVENT_SHARING.md).

## Home current games

Home replaces the doubles quarterly preview with current-game cards above the signup list. The region is absent without an actually playing match in an active, visible activity and playing round. Singles and doubles show both sides, court, activity and a link to the activity rounds tab. Data polling uses the existing three-second cadence while home has playing matches; a local clock and foreground listeners remove expired cards even if the data revision is unchanged. Deleted, draft, cancelled, future and completed data is excluded. Home retains up to six signup cards; full ranking boards remain on the ranking page.
