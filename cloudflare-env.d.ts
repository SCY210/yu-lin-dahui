declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PUSH_VAPID_PUBLIC_KEY?: string;
    PUSH_VAPID_PRIVATE_KEY?: string;
    PUSH_VAPID_SUBJECT?: string;
  }
}
