# Ignite security architecture review — 23 October 2026 (IST)

## Conclusion and scope

Keep the site in its current public-sample mode. Firebase sign-in is implemented, but the
site is **not yet an end-to-end production admissions or student-record system**. Do not
use local scores for official marks, paid access or prizes, and do not connect real
admissions records to the local owner prototype.

Reviewed the static repository, Firebase session adapter, account UI and prepared
Sheets-intake Worker/Apps Script. Ran local automated tests and isolated desktop/mobile
browser checks with synthetic data. Passive live checks were performed around
2026-10-22 19:42 UTC (23 October IST). No real accounts were created, emails sent,
enquiries submitted or private records read. This is a source/configuration review,
not a penetration test, cloud-console audit or compliance certification.

## Actual trust boundaries

| Component | Current boundary / status |
| --- | --- |
| GitHub Pages | Public HTML, JS, diagrams and answer keys. Anyone can download or modify them in their own browser. |
| Firebase Authentication | SDK-managed email/password accounts and email verification. Session-scoped browser persistence; no custom password database in the active student flow. |
| Dashboard and game | Frontend gating and UID-namespaced browser-local progress. No authoritative cloud marks or cross-device student records. |
| Learning API preview | `/v1/meta` reports shared admissions, guardian identity, progress persistence and content catalogue all disabled. A no-token `/v1/session` returned 401 `authentication_required`. |
| Enrolment → Worker → Apps Script → private Sheet | Prepared, **not connected**. Empty endpoint/site key keep submission disabled. No student enquiries are currently saved by this form. |
| `admin.html` / `admin.js` | Explicitly labelled local prototype. Device-local owner setup and local storage are not server authorization. |

## Findings and priorities

### 1. Production blocker: no authoritative admissions/admin boundary

Evidence: `admin.js` uses `ignite-owner-v1`, local/session storage and a local password hash;
`admin.html` warns that it only reads that browser's data. `app.js` and `game.js` save local
progress; trial answers remain in memory. The live learning API advertises disabled services.

Impact: local state and UI checks can be changed by the device user. This is not evidence of
access to someone else's cloud data, but it cannot protect real staff operations, grades or
paid access. Before adding those features, implement server-side Firebase ID-token verification,
server-owned role/guardian-student authorization, least-privilege staff access and admin MFA.
Never trust a posted UID, browser score or frontend `emailVerified` flag as authorization.
Firebase documents [server ID-token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens);
OWASP explains the [limits of browser storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html).

### 2. Medium: missing browser security-header defence in depth

Evidence: the live landing response had HTTPS/HSTS but no `Content-Security-Policy`,
`X-Frame-Options`, `X-Content-Type-Options` or explicit `Referrer-Policy`. The HTML also
has no meta CSP. In contrast, the learning API's responses supplied restrictive CSP,
frame denial, no-sniff and no-referrer headers.

Impact: the public site lacks an additional barrier against injected scripts and framing.
No injection exploit was established. Before collecting personal data, deploy a tested CSP,
`frame-ancestors`, `nosniff` and referrer policy through a hosting/edge configuration that
supports response headers. Include the actual Firebase/Turnstile resources and regression-test
sign-in and enrolment. A meta CSP cannot supply `frame-ancestors` or `X-Frame-Options`;
adding those directives to HTML would not fix clickjacking. See
[Chrome's header guidance](https://developer.chrome.com/docs/lighthouse/best-practices/clickjacking-mitigation).
No untested CSP or hosting migration was introduced in this change.

Origin isolation also needs consideration: `/Ignite` is a path, not a separate browser
origin. Other projects served from `https://nilotpal9126.github.io` share the origin's
storage and CORS allowance. Their code was not reviewed. Before sensitive records or staff
access are enabled, use a dedicated trusted origin or ensure all same-origin applications
are equally trusted. [MDN defines origins by scheme, host and port, not path](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy).
Firebase Hosting is one available host with [configurable response headers](https://firebase.google.com/docs/hosting/full-config#headers);
moving hosts or changing domains requires a separate configuration and regression check.

### 3. Before intake launch: anti-abuse and contact verification are incomplete

Prepared controls: Worker-side 16 KB streamed-body limit, JSON/schema validation, exact
origin CORS policy, honeypot, UUID checks, Turnstile **server-side** verification including
action/hostname, bounded upstream timeouts, and confirmed receipt before success. Apps Script
checks a server secret, repeats validation, serializes deduplication/write with ScriptLock,
escapes formula markers and flushes before acknowledging. Client contact data is not persisted.

Remaining: no application-level per-IP/global rate limit, quota circuit breaker or abuse
alerts are implemented in the intake Worker. CORS is not caller authentication; a non-browser
client can forge Origin. Turnstile reduces bot abuse but does not prove contact ownership.
Phone/WhatsApp validation is syntax/placeholder checking, not OTP. Duplicate detection covers
the normalized same child + class + school + guardian phone, not every possible false identity.
Before opening intake, configure rate limits/alerts and private Sheet access, and decide whether
OTP is required. Keep the server Turnstile check: [Cloudflare requires it](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

### 4. Before intake launch: define privacy and record lifecycle

The form has separate guardian enquiry consent and optional WhatsApp updates consent;
it requests a neighbourhood only for Siliguri, not a full home address. However, a full
privacy notice, named contact for data requests, retention/deletion schedule, staff access
review, backups and operational incident procedure were not established by this review.
Set these before collecting children's and guardians' details. Enquiry submission and
Firebase account creation are separate workflows; matching email alone must not create
an automatic guardian-child authorization link. WhatsApp channel following also remains
an explicit user action, not automatic login or automatic opt-in.

### 5. Console verification required: Firebase and cloud settings

The SDK manages session tokens; unverified accounts cannot obtain an Ignite learner identity
or token through the adapter, and unavailable browser storage fails closed. These are useful
frontend controls, not replacements for backend authorization.

The checked-in Firebase web configuration is intentionally public, not a leaked admin key.
Firebase explains that [these API keys identify the project, not authorize data access](https://firebase.google.com/docs/projects/api-keys).
A high-signal scan of the 66 pre-change tracked files found no private-key blocks or common
GitHub/AWS secret patterns; this does not rule out all credentials or historical leaks.

Not verified: project IAM, staff MFA, enabled providers, backend-enforced password policy,
email-enumeration protection, API restrictions, Authentication abuse protections, Firestore /
Realtime Database / Storage rules, billing alerts, Sheet ownership/sharing or deployed intake
secrets. No database security rules are shipped by this static authentication implementation.
Before enabling any database, review its deployed rules and cross-user access tests; never
assume Firebase Auth alone secures it. Use the
[Firebase security checklist](https://firebase.google.com/support/guides/security-checklist).

## Changes and verification in this delivery

- Added four allowlisted, locally authored SVG-option questions to the public trial only;
  external URLs, arbitrary markup and prototype keys cannot select diagrams. Text descriptions
  and native keyboard-operable buttons are retained. Original worksheets/recovery IDs are unchanged.
- State, Regional and Other boards require a typed name in browser and backend validation.
  Siliguri alone requires a preferred area; other cities' area values are removed on the server.
  Mobile, WhatsApp and email remain required, with a same-number checkbox avoiding double entry.
- Regression tests cover sign-in fail-closed behaviour, separate UIDs, shared validation,
  deduplication, overlapping Worker requests, Sheet locking/schema safety, formula text handling,
  malformed/oversized requests, wrong challenge hostname/action, diagram rendering and packaging.
- Browser checks cover all four complete quizzes, keyboard selection, 1280/390/320 px widths,
  board-name requirements, Siliguri switching, invalid contacts and paused submission.

The Google Sheet connection remains deferred as requested. These changes do not claim live
storage verification, OTP verification, a secure production admin portal or official score integrity.
