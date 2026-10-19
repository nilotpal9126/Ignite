# Project Ignite

A static, buildless sample preview of the Project Ignite learning platform: anonymous practice,
mistake recovery, same-question recall, and a device-local dashboard for existing prototype accounts.

> **Sample preview, not an approved learning product.** New admissions are paused. Anonymous
> answers stay in page memory; dashboard attempts stay in that browser. No production account,
> payment or cloud learning-history service is enabled by this release. Do not enter real child data.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Anonymous sample practice and existing prototype login; new admissions paused |
| `dashboard.html` | Real practice sets, one-question workspace, recovery and device-local progress |
| `admin.html` | Owner portal (device-local prototype) |

## About the data

`data/catalog.js` (and `catalog.json`) contain **anonymised sample data** (36 generated entries), not
the real worksheet library. Every entry is marked `inventory_only` / `studentVisible: false`.
Those inventory entries are excluded from the student practice library. Eight original practice sets
(48 questions, Maths and science) ship separately as labelled teacher-review-pending samples. Only one worksheet
question has targeted recovery mappings. Other mistakes offer recall of the same question, not
a fabricated diagnosis or a newly generated assessment. Pending follow-up banks are excluded.

## Important limits

- The **owner portal is not real access control.** The first visitor on a device creates an owner
  account for *their own* browser. Real authentication needs a backend.
- Do not enter real children's personal data on a public demo until a proper backend, privacy
  notice and consent flow exist.

## Run locally

Open `index.html` in a browser, or serve the folder: `python -m http.server 8000`.

## Deploy with GitHub Pages

1. Repository **Settings -> Pages**.
2. **Build and deployment -> Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Save. The site appears at `https://<your-user>.github.io/<repo-name>/` after about a minute.

All links are relative, so the site works at that sub-path with no changes.
