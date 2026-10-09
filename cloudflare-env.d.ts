declare namespace Cloudflare {
  interface Env {
    PROFILE_GENDER_ONLY_PLAYER_IDS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PUSH_VAPID_PUBLIC_KEY?: string;
    PUSH_VAPID_PRIVATE_KEY?: string;
    PUSH_VAPID_SUBJECT?: string;
  }
}
