# Player directory and individual profiles

The player entry shows a directory (`app/player-directory.tsx`) with a search box (name, motto or racket), a sort (rating, the viewer's bond, or name in pinyin order) and two views. The list view, the default, shows every member as a compact row with avatar, name, tier, motto and the viewer's bond stage, so a member is found without swiping. The card view keeps the flip cards; on phones it is a one-card-at-a-time carousel, and it shows only the members that match the search. The chosen view is remembered in the browser. Personal details, equipment, photos, voting, and relationship statistics appear when opening a player.

On a profile, personal details and rackets always come first, then the bond with the viewer, then match statistics and achievements.

Each player has a dedicated profile view with a back-to-directory action. The directory and social tabs are hidden in detail view; returning resets the directory to the top. Ranking avatars, the personal page, and relationship names can open a player directly.

The relationship graph maintains its own central-player selection. It does not implicitly select the default profile. Existing ownership checks, administrator editing, avatars, equipment uploads, and photo access remain authoritative. Missing information is displayed as missing rather than invented.

The annual-summary entry/rendering is currently hidden, while backend calculations and historical data remain. Old annual-tab values fall back to the directory.

Scoped pl-* CSS uses indigo/purple. Mobile controls target at least 44px, support keyboard focus, and respect reduced motion.
