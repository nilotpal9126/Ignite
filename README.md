# Project Ignite

A static, buildless sample preview of the Project Ignite learning platform: anonymous practice,
mistake recovery, same-question recall, and account-isolated practice in the current browser.

> **Sample preview, not an approved learning product.** New admissions are paused. Anonymous
> answers stay in page memory; dashboard attempts stay in that browser. Firebase email accounts
> support sign-in, while admissions intake and cloud learning-history activation remain separate.
> No payment is enabled by this release.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Anonymous sample practice, Firebase email sign-in and enrolment enquiries |
| `dashboard.html` | Real practice sets, one-question workspace, recovery and device-local progress |
| `play.html` | Ignite Play: chapter trails, Daily Spark, boss rounds, trophies and saved progress |
| `labs.html` | Board-aware Class 10 interactive studios and wider concept playground |
| `admin.html` | Owner portal (device-local prototype) |

## Interactive labs

The landing page, student dashboard and Ignite Play home link to `labs.html`. Matching ICSE Class 10 chapter trails can also link directly to their studio. `labs-registry.js` contains the explicit board/class/subject/chapter mappings.

The expanded Force, Genetics, Kidney and Chemistry studios currently follow ICSE Class 10. CBSE learners are directed to CBSE activities in the wider Subject Worlds playground. The website's existing school-board preference is reused; direct links to ICSE studios redirect CBSE learners to their selected-board hub. This is content filtering, not access control over public HTML files.

Studio results remain session practice inside each lab; they do not modify worksheet attempts, Ignite Play XP or trophies. Public labs do not require sign-in. Each studio has site return links, and its teaching assumptions remain accessible. The 3D shapes are schematic models rather than scans or quantum orbital simulations.

Generated pages live under `labs/`; `labs-manifest.json` identifies them for release packaging. Source modules and the reproducible integration/build scripts live in the development workspace's `ignite-biology-labs`, `ignite-chemistry-labs`, `station-helios-student` and `dev_tools` folders. Do not edit generated lab pages directly.

## About the data

`data/catalog.js` (and `catalog.json`) contain **anonymised sample data** (36 generated entries), not
the real worksheet library. Every entry is marked `inventory_only` / `studentVisible: false`.
Those inventory entries are excluded from the student practice library. Eight original practice sets
(48 questions, Maths and science) ship as labelled teacher-review-pending samples. Ignite Play also includes
73 AI-reviewed practice sets whose answers were independently checked by a second model; teacher review is still pending.
Only one original worksheet
question has targeted recovery mappings. Other mistakes offer recall of the same question, not
a fabricated diagnosis or a newly generated assessment. Pending follow-up banks are excluded.

## Important limits

- The **owner portal is not real access control.** The first visitor on a device creates an owner
  account for *their own* browser. Real authentication needs a backend.
- Do not enter real children's personal data on a public demo until a proper backend, privacy
  notice and consent flow exist.

## Enrolment component

`Enroll Now!` opens a branded form from the landing page, student login, dashboard and game
results. It collects student/school/board, location preference and guardian contact details.
The Sheet integration is prepared but **not connected**: submissions stay disabled until the
owner's endpoint and Turnstile site key are configured. See
[`integrations/enrollment/README.md`](integrations/enrollment/README.md) for deployment,
duplicate matching and the distinction between input validation and contact verification.
The [deployment guide](integrations/enrollment/DEPLOYMENT.md) includes a generator for a
website + Apps Script + Worker bundle, a configuration check, and the current multi-student
login setup: Sheets stores enquiries; Firebase handles verified email accounts.

## Firebase accounts

Firebase email/password accounts now replace the single-profile prototype login when enabled
in `platform-config.js`. Email verification, reset and sign-out use the Firebase SDK. Each
verified account uses its own UID for browser-local progress; separate accounts can sign in
on separate devices/tabs. Progress is not synchronized across devices. See the
[Firebase setup guide](integrations/firebase/README.md) for provider settings and owner testing.

## Run locally

Open `index.html` in a browser, or serve the folder: `python -m http.server 8000`.

## Deploy with GitHub Pages

1. Repository **Settings -> Pages**.
2. **Build and deployment -> Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Save. The site appears at `https://<your-user>.github.io/<repo-name>/` after about a minute.

All links are relative, so the site works at that sub-path with no changes.
