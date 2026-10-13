# Activity participation acknowledgements

> **Retired.** At the members' request the activity participation notice no longer gates anything. No account is asked to confirm it on entry, no route answers 428, the signup page no longer shows the notice text or past confirmation records, and the checkbox field type was removed. Existing receipts and per-signup records stay stored, append-only, and exportable (`/api/club?noticeExport=1`, owner `=all`). An app installed before the removal may still send `acknowledgeActivityNotice`; it is validated and stored as before, and the projection reports `accountNotice.required` as false so such an app never shows its blocking dialog. The terms and privacy pages describe this. The rest of this page records the former behaviour.

The Chinese activity notice is defined in `lib/activity-notice.ts`. Its version
must change whenever its confirmed text changes. It explains ordinary sports
risks, safety and conduct, activity rules and costs, personal belongings,
voluntary extended profiles, responsibility boundaries, and receipt processing.
It does not promise blanket immunity or waive statutory rights.

Every manual `register`, `courtRegister`, and `friendSignup` operation requires
`noticeAccepted: true` and the current `noticeVersion`. This includes edits and
rejoining. The UI starts unchecked, blocks submission before confirmation, and
resets the checkbox when switching participant, court, or proxy mode. An outdated
notice requires a page reload and a fresh confirmation. Browser-agent tools can
open the manual form; they cannot silently confirm it or directly register.

The server appends a receipt to `Registration.noticeAcknowledgements` using its
own timestamp and the authenticated account. A receipt contains the participant,
original activity/court scope, version, and self/proxy distinction. It records
the submitted acknowledgement, not a verified electronic signature. A proxy
receipt never claims the friend personally signed on the website.

Old registrations retain their places without fabricated acceptance. Automatic
waitlist promotion and cancellation retain the history without creating a new
receipt. Rejoining and manual changes add a new receipt. Activity merges preserve
original receipt scope; an acknowledgement of the source activity is not shown
as acceptance of the target activity.

Members see only receipts for themselves or those they filed. Activity managers
can inspect the relevant activity. Club-view receipts replace raw actor IDs with
a display name and a self flag; authorized administrative exports retain the
server evidence. These receipts use the existing JSON persistence and atomic
transaction/idempotency protections, with no new SQL migration.

The checkbox addresses activity rules and risk awareness. It does not bundle
photo-publication permission, a waiver of privacy rights, or a separate legal
basis for every processing purpose. Extended player profile fields remain
voluntary. Operator identity, contact details, legal bases, retention and other
privacy responsibilities remain covered by the existing configurable notices;
this feature does not invent those facts or certify legal compliance.

Reference context: [Spanish Civil Code](https://www.boe.es/buscar/act.php?id=BOE-A-1889-4763)
and [AEPD guidance on data-processing consent](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0211-segun-el-rgpd-como-debe-solicitarse-el-consentimiento-de-los-interesados-para-tratar-sus-datos-personales).

Validation includes `activity-notice-api`, `activity-notice-ui`, and the
browser-tool unit tests, plus the existing signup, queue, cancellation, guest,
merge, permissions, retry and transaction tests. The browser fixture is synthetic
and never writes production data.
