# Ignite enrolment → private Google Sheet

The website uses its own three-step dialog, not a Google Form. Existing student login and
device-local quiz progress are separate. No student clicks or personal details are stored in
browser storage by this component. Submissions stay disabled until the public endpoint and
Turnstile site key are configured in `enrollment-config.js`.

For the complete deployment order and a three-part website/server bundle, see
[`DEPLOYMENT.md`](DEPLOYMENT.md). Generate it with
`node integrations/enrollment/prepare-deployment.mjs --out <new-output-directory>`.
The public Worker `/health` endpoint checks configuration only; a real test row must be confirmed
in the owner's Sheet before enabling live intake.

## Connect an owner-controlled Sheet

1. Create a **private**, dedicated Google Sheet. Do not publish it. Give admissions staff only
   the access they need. The integration creates a tab named `Enquiries`.
2. In Extensions → Apps Script, use the V8 runtime. Paste `Code.gs` and add a second script
   file `Rules.gs` containing the exact contents of `../../enrollment-validation.js`.
3. Set Script Properties `SPREADSHEET_ID` (from the Sheet URL) and `SHEETS_AUTH_SECRET`
   (a securely generated, long random secret). These values belong only in server settings.
4. Deploy a **Web app**, executing as the Sheet owner. Allow access without Google sign-in
   so the Worker can call it; every request still requires the secret and valid fields.
   Copy the `/exec` deployment URL. Redeploy the script when its code changes.
5. Create a Cloudflare Turnstile widget restricted to the site's hostname. Configure Worker
   secrets `SHEETS_WEB_APP_URL`, `SHEETS_AUTH_SECRET` (same secret), and
   `TURNSTILE_SECRET_KEY`. Use the included Worker source and Wrangler configuration;
   do not deploy over the existing learning API. Change `ALLOWED_ORIGIN` if hosting moves.
6. Set the public `endpointUrl` (`https://<worker-host>/enrollments`) and
   `turnstileSiteKey` in `../../enrollment-config.js`. Supply the real WhatsApp channel URL
   there when available. Never place a Sheet secret, service-account key or OAuth token in it.
7. Test a synthetic submission, retry, duplicate from another browser, sibling with the same
   guardian phone, missing consent and invalid phone. Confirm the UI receipt matches a saved
   Sheet row. A failed response must never show success. The request timeout may occur after
   a row is saved; retries use the same payload ID and the server checks for the existing child.

## What is checked

- Names accept Unicode letters and common name punctuation. Class, board and state are
  allowlisted. School and location fields accept legitimate letters, digits and punctuation,
  with bounded lengths and a few obvious placeholder checks. No restrictive English dictionary.
- Indian mobile format is checked, including obvious repeated/example numbers. Email syntax
  is checked. These checks **do not prove ownership** or establish that a school/name exists.
  Ownership verification requires a separate email/phone verification service or staff follow-up.
- District, city and neighbourhood are free-text fields enabled in order. They are **not** a
  verified geography/centre directory. Supply operational centre data before promising those
  choices or replacing them with dependent dropdowns.
- Both server layers revalidate. The Worker verifies Turnstile on the server; it alone knows
  the Sheet secret. Origin checks help browser isolation, but are not authentication.
- Apps Script holds a ScriptLock across duplicate checking and writing, then flushes before
  returning a receipt. The identity key uses normalized student name + class + school + guardian
  phone. Repeat requests reuse the existing receipt; a sibling can use the same guardian number.
  Deliberately changing identity fields can bypass this match. Name/phone validation is not OTP.
- The Sheet stores consent/version and a `New` status. No existing entry is overwritten.
  Keep the header row unchanged. Review ambiguous duplicates manually; spelling changes cannot
  be safely resolved automatically. Concurrent quotas can cause retryable failures at large scale.
- The UI offers a WhatsApp Channel button only for a configured official channel URL. A
  scannable QR still needs that invite URL and a QR asset/generator; none is fabricated here.

## Verification

Run `node --test integrations/enrollment/enrollment.test.mjs integrations/enrollment/deployment.test.mjs` from the site directory.
These tests use synthetic fixtures and an in-memory Apps Script service double; no real Sheet,
guardian contact or deployed endpoint is used. They verify the shared rules, duplicate handling,
server checks and failure responses. Production permissions/quotas require a deployed smoke test.

References: [Apps Script web apps](https://developers.google.com/apps-script/guides/web),
[Script locks](https://developers.google.com/apps-script/reference/lock/lock-service),
[server-side Turnstile validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
