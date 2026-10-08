# Privacy and legal readiness

This is an engineering readiness record, not a certification that the app cannot create legal liability. The operator's actual country, organizational role, users' ages, and commercial scope have not yet been confirmed. Spain/EU and a private adult club are provisional review assumptions, not facts enforced by the app.

## Implemented measures

- Public /privacy and /terms pages, linked before login and throughout the app.
- Versioned public operator configuration in config/legal.ts. Missing identity/contact, jurisdiction, lawful bases, retention, processor/transfer information, minors policy, or complaint authority keeps the notice visibly marked as a draft. Presence checks are not legal validation.
- An unchecked image-rights confirmation in avatar, activity, and racket upload forms, enforced by the server before quota reservation/storage. Audits record the uploader's statement and policy version, not supposed consent from each person depicted.
- Existing membership-based access, protected photos, credential/session safeguards, limited inputs/quotas, and no private PWA cache remain in place.
- English shared documentation, local-report untracking with a verified backup path, and preserved third-party notices.

Do not invent the operator's identity, select a universal consent checkbox for every use of data, or publish placeholders as a completed privacy policy.

## Decisions required from the operator before deployment

Complete every config/legal.ts field with verified, public information. The software does not supply the facts:

1. Identify the actual controller/operator and a monitored rights-request contact. A GitHub collaborator is not automatically the data controller.
2. Confirm countries, applicable rules, whether the group is an organization/commercial service, and whether minors participate. A private login is not by itself evidence of the GDPR household exception.
3. Describe purposes and the applicable basis separately for accounts, activity records, results/rankings, cost allocation, optional profiles, images, and security logs. Assess indirect profiles created for friends as well.
4. Establish retention periods and a workable access/correction/erasure/restriction/objection/portability process. Current event deletion is reversible and does not erase personal data; no automated account erasure or retention scheduler exists. Consider credentials, photographs, audit payloads, exports, and backups.
5. Review the actual Sites/Cloudflare/identity-provider processing arrangements, locations, contractual terms, and transfer safeguards. No data-region or processor-contract claim has been verified here.
6. Assess cookies actually set by the deployed host. Source cookies manage authentication; that does not exempt future analytics/advertising. Add appropriate choices before introducing nonessential tracking.
7. Establish image-permission evidence, moderation/removal handling, and any guardian process. The uploader's acknowledgement is not verified consent. The app does not verify age. Do not upload minors' photographs until an appropriate process exists.
8. Check venue reservations, organizer responsibilities, insurance/sports obligations, taxes or invoicing where applicable, and additional obligations if payments/commercial activity are introduced. The app only computes cost shares.
9. Provide the final notice in languages members understand. English is useful for development collaboration but not necessarily sufficient for the existing Chinese-language audience.

The PR does not deploy these notices, reset real accounts, change hosting audiences, erase production records, or rewrite Git history.

## Current technical limits relevant to privacy

Uploaded bytes may retain EXIF, GPS, or other metadata. Structural validation does not remove it; sanitize photos before sharing. Existing profile/attendance/result data is shared with club members. Administrators can export complete business records, so exports require access/retention handling outside Git.

Erasure may require preserving or pseudonymizing historical records involving other people rather than deleting all matches indiscriminately. A dedicated erasure workflow needs its own design and verification. Security/incident handling and vendor arrangements also require operational ownership.

## Primary references reviewed on 2026-10-05

The following sources guide the provisional Spain/EU review; apply them to the actual circumstances rather than treating the repository as legal approval.

- [EU GDPR text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679): scope, lawful processing, transparency, individual rights, privacy by design, processors, and security.
- [AEPD information duties](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/6-el-deber-de-informacion): understandable information about processing and the controller.
- [AEPD cookie guidance](https://www.aepd.es/guias/guia-cookies.pdf): distinguish necessary technical cookies from uses needing additional choices.
- [AEPD consent guidance](https://www.aepd.es/preguntas-frecuentes/2-tus-obligaciones-como-responsable-del-tratamiento/5-bases-legitimadoras-del-tratamiento/FAQ-0211-segun-el-rgpd-como-debe-solicitarse-el-consentimiento-de-los-interesados-para-tratar-sus-datos-personales): affirmative choices; prechecked boxes or inaction do not establish consent.
- [Spanish protection of image/privacy rights](https://www.boe.es/buscar/act.php?id=BOE-A-1982-11196): image-sharing issues are not resolved solely by restricting login.
- [Spanish information-society services law](https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758): assess applicability and operator information obligations if the service falls within its scope.

Have the final operational choices reviewed by an appropriately qualified adviser when the actual scope warrants it. Until the real details are supplied, the notice is intentionally incomplete.
