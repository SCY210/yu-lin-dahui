declare namespace Cloudflare {
  interface Env {
    MIGRATION_EXPORT_TOKEN?: string;
    MIGRATION_EXPORT_EXPIRES_AT?: string;
    YULIN_HOSTING_PROVIDER?: "cloudflare";
    YULIN_RELEASE_CHANNEL?: "private";
    CF_VERSION_METADATA?: {id:string;timestamp:string;tag?:string};
    PROFILE_GENDER_ONLY_PLAYER_IDS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PUSH_VAPID_PUBLIC_KEY?: string;
    PUSH_VAPID_PRIVATE_KEY?: string;
    PUSH_VAPID_SUBJECT?: string;
  }
}
