# Deploy Ignite's website and Google Sheets intake

The generated bundle contains three deployment targets:

| Directory | Upload/deploy to | Role |
|---|---|---|
| `website/` | Existing static website host | Quiz, game, branded enrolment form |
| `apps-script/` | Google Apps Script web app owned by the Sheet owner | Validate, deduplicate and write private enquiries |
| `cloudflare/` | A separate `ignite-enrollment` Worker | Verify Turnstile, protect the Sheet secret and return confirmed receipts |

The website alone cannot write to a private Sheet. Deploy the two server components before
enabling submissions. The bundle contains no live credentials. `deployment-manifest.json`
records checksums and missing public settings. All three services use the same validation code.
Deploy only `website/` as static content; do not upload the server configuration to the site.

## 1. Google Sheet and Apps Script (owner setup)

Create a private Sheet and open Extensions → Apps Script. Use the generated `Code.gs`,
`Rules.gs` and `appsscript.json`. Enable showing the manifest in Apps Script settings to edit it.
The manifest selects V8, Asia/Kolkata and the Sheets permission needed to open the configured
spreadsheet. No form, Gmail or Drive permissions are required by this code.

In Script Properties, configure:

- `SPREADSHEET_ID`: the ID in the private Sheet's URL.
- `SHEETS_AUTH_SECRET`: a long cryptographically random shared secret, retained in your
  password manager and later entered into the Worker secrets. Do not put it in source files.

Deploy as Web app, **execute as the owner**, and permit access without Google sign-in.
The script accepts a write only when the server secret and all field checks pass. Authorize
the requested Sheets access as the owner. Copy the `/exec` URL. Use the same script deployment
for all requests to this Sheet so one ScriptLock serializes the duplicate-check/write operation.
Redeploy a new version when updating code, retaining the existing web app deployment URL.

The `Enquiries` tab and column headers are initialized on the first valid submission. Existing
headers must match; a mismatch fails without overwriting rows. Keep the private Sheet restricted
to admissions staff. Never store passwords, student PINs or login tokens in it.

## 2. Worker and bot protection

Create a Cloudflare Turnstile widget for the website hostname (`nilotpal9126.github.io` today).
Keep its secret key private; its site key will be public. In `cloudflare/wrangler.jsonc`,
`ALLOWED_ORIGIN` is the website **origin**, currently `https://nilotpal9126.github.io` (no `/Ignite`).
For a custom domain, update this origin and the Turnstile hostname together.

From `cloudflare/`, with Wrangler installed and your own Cloudflare account authenticated:

```powershell
npx wrangler deploy --config wrangler.jsonc
npx wrangler secret put SHEETS_WEB_APP_URL --config wrangler.jsonc
npx wrangler secret put SHEETS_AUTH_SECRET --config wrangler.jsonc
npx wrangler secret put TURNSTILE_SECRET_KEY --config wrangler.jsonc
```

Enter each value at its hidden prompt. `SHEETS_WEB_APP_URL` is the Apps Script `/exec` URL;
the shared secret must match Script Properties. The first deploy returns 503 for submissions
until secrets are configured. This separate Worker does not replace Ignite's learning API.

`GET https://<worker-host>/health` returns 200 when required settings are present and 503
when they are missing. It returns no credentials or student details. **This is a configuration
check, not proof that Google authorization or spreadsheet writes work.** Use the smoke check below.

## 3. Website configuration and go-live check

Set the repository's `enrollment-config.js` to the production Worker endpoint ending in `/enrollments`
and the production Turnstile site key, then rebuild the bundle to copy it into `website/`.
Add the official WhatsApp Channel invite URL when available.
Do not put the Sheet ID, shared secret or Turnstile secret key in the website. Empty public
settings keep submission disabled; the quiz still works.

To check your repository settings before generating the final bundle:

```powershell
node integrations/enrollment/prepare-deployment.mjs --check-config
```

This command exits with status 1 when public settings are missing or clearly placeholder values.
It does not check or print server secrets. It cannot replace the live smoke check.

Preview the configured website on the allowed origin with a real Turnstile widget and use
clearly labelled synthetic data. Verify:

1. One successful submission creates one Sheet row and the same enquiry reference in the UI.
2. A retry/from another browser creates no extra row for the same student/class/school/phone.
3. A sibling using the same guardian number creates a separate row.
4. Invalid data, missing guardian consent and failed bot verification do not create rows.
5. Losing the connection preserves the form; retrying is safe even if the first save completed.

Only then publish the configured website. For GitHub Pages, commit the website contents to
the existing published branch/root. For Firebase Hosting or another static host, use `website/`
as the public directory, keeping server credentials in their respective account settings.

## Multiple students and concurrency

Multiple people can take the public quiz and send enrolment enquiries from separate devices.
Workers accept separate requests; Apps Script briefly serializes writes with ScriptLock to
avoid duplicate rows. Under contention a request can time out and require a retry. Google
imposes Apps Script quotas, so this is a pilot intake system, not a guaranteed traffic capacity.
The repository tests simulate overlapping requests, retries, duplicates and lock contention;
they do not establish Google production throughput.

**Student authentication is separate from Sheet storage.** Firebase email/password sign-in,
verification, password reset and sign-out are now implemented. See `FIREBASE.md` in the bundle
for provider settings and testing. Session persistence lets separate accounts use independent
tabs/devices. A freshly duplicated tab may inherit its opener's session until switched.
Each Firebase UID has separate browser-local progress; cross-device progress synchronization
and multiple child profiles under one guardian email are not implemented. Keep the Sheet as
the admissions team's enquiry tracker.
Do not use Sheet rows as a password database or treat enrolment receipt IDs as login credentials.

## Rebuild a reviewable bundle

From the repository, Node 20+ and Git are sufficient; no dependency install is needed:

```powershell
node --test integrations/enrollment/enrollment.test.mjs integrations/enrollment/deployment.test.mjs
node integrations/enrollment/prepare-deployment.mjs --out C:\path\to\new-ignite-deployment-folder
```

Use a new output directory. Existing artifacts are never deleted or overwritten. The generator
uses tracked website files plus the explicit new enrolment and account files. It checks HTML resources,
copies validation identically into all three targets, and excludes Git metadata, tests, server
source and credential files from the static website. It does not deploy external resources.

Sources: [Apps Script deployment](https://developers.google.com/apps-script/guides/web),
[quotas](https://developers.google.com/apps-script/guides/services/quotas),
[Firebase Authentication](https://firebase.google.com/docs/auth).
