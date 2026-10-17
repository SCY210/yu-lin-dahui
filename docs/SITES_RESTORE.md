# Restoring the original Sites entry

The owner selected the original Sites deployment as the primary entry on
2026-10-17: https://yuqiujv-club.chenyueshanxd.chatgpt.site/ . Access is public;
application authentication, member/admin roles and restricted presentation
permissions still apply. The standalone Worker remains a separate deployment.

The restoration copies a point-in-time database snapshot and referenced image
objects. This is not continuous replication. Subsequent activity should use the
primary entry; writes on the other deployment are not automatically copied.

Before importing, retain both deployments' full database/object backups and the
original Sites source. Pin the imported runtime to the actually deployed shared
commit, preserve restricted assets and access checks, and check schema/foreign
keys. Never put snapshots, passwords, device records, images or private source
in public GitHub.

The host-pinned restore port is disabled without a dedicated expiring secret,
refuses the standalone Cloudflare provider, validates table/column names, limits
batch sizes and checks the destination revision before replacement. Original
append-only consent receipts must be retained; equivalent confirmations are
merged by account, version and content hash. Old sessions, cross-origin push
subscriptions/queued deliveries and the transient incremental feed are not
replayed. Users sign in again and enable notifications on the restored origin.

After importing, verify all business tables and image digests. Disable migration
secrets and the legacy redirect before reopening the Site. A publication is
complete only after the native deployment succeeds and public/login boundaries
are checked. Existing private Worker release protections remain applicable to
that Worker; do not publish a shared checkout over its private channel.
