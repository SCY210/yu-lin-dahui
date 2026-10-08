# Player directory and individual profiles

The player entry shows a compact directory with name, avatar, tier, and form. Personal details, equipment, photos, voting, and relationship statistics appear when opening a player.

Each player has a dedicated profile view with a back-to-directory action. The directory and social tabs are hidden in detail view; returning resets the directory to the top. Ranking avatars, the personal page, and relationship names can open a player directly.

The relationship graph maintains its own central-player selection. It does not implicitly select the default profile. Existing ownership checks, administrator editing, avatars, equipment uploads, and photo access remain authoritative. Missing information is displayed as missing rather than invented.

The annual-summary entry/rendering is currently hidden, while backend calculations and historical data remain. Old annual-tab values fall back to the directory.

Scoped pl-* CSS uses indigo/purple. Mobile controls target at least 44px, support keyboard focus, and respect reduced motion.
