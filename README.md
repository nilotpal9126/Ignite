# Project Ignite

A static, no-build prototype of the Project Ignite learning platform: a public landing page with a
one-student pilot admission, a focused 3-step study mission dashboard, and a local owner portal.

> **Prototype.** There is no server. Everything a visitor enters (admission details, progress, the
> owner account) is stored only in *that visitor's own browser* (`localStorage` / `sessionStorage`).
> Nothing is uploaded, and nothing a visitor does is visible to anyone else.

## Pages

| Page | Purpose |
|---|---|
| `index.html` | Landing page, student admission, login |
| `dashboard.html` | Student dashboard: mission, subjects, worksheet browser |
| `admin.html` | Owner portal (device-local prototype) |

## About the data

`data/catalog.js` (and `catalog.json`) contain **anonymised sample data** (36 generated entries), not
the real worksheet library. Every entry is marked `inventory_only` / `studentVisible: false`.

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
