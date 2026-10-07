# Default player avatar

Players without an uploaded avatar use the shared `/default-avatar.svg` illustration. It contains no surname or nickname lettering and is a static, self-contained asset.

The shared `Avatar` component covers social cards, profiles, the My page, signup rosters, home ranking summaries, podiums and ranking rows. Uploaded avatars keep priority. If an uploaded image fails to load, that component instance switches to the default image; a newly assigned upload ID can load normally. The default is a display fallback, not a database photo or a change to player records.
