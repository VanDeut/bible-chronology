# Bible Chronology

A personal, offline-first timeline web app for biblical/historical events — no backend, full data ownership in the browser.

## Features

- Horizontal scrollable timeline with pinch-to-zoom, drag-to-pan, and persisted zoom/scroll
- Timeline ruler, overview minimap, and cursor date readout
- Single-date events and date ranges (including BC dates); optional **featured** events with circular timeline markers when an image URL is set
- **Backgrounds** — date-range spans with full-height optional images, opacity control, and info chip
- Categories with colors; show/hide via **Filter** or the collapsible legend
- **Category bands** — events are grouped into horizontal bands by primary category (band order = Category manager order; hidden categories collapse their band). Multi-category events pick a **primary** category in the event form
- Visible-event culling for large timelines
- Offline-first storage (IndexedDB)
- **Menu → Backup & restore** — JSON import/export (merge or replace), or clear all data to start fresh
- **Menu → GitHub sync** — keep the timeline as `data/timeline.json` in a GitHub repo so every device opens with the same data (see below)
- CSV import with column mapping; AI extraction prompt for PDF/image workflows
- Image URLs you host on your own domain (events and backgrounds)
- Client-side password gate (no user accounts)
- PWA — installable; service worker for offline app shell
- Static export (`out/`) for GitHub Pages, Netlify, Cloudflare Pages, or any static host

## Quick Start

```bash
npm install
cp .env.example .env.local
# Copy .env.local and set NEXT_PUBLIC_APP_PASSWORD for local dev (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Set these in `.env.local` for local development. For production, they must be present **at build time** (see Deploy).

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APP_PASSWORD` | Site unlock password (local dev in `.env.local`). |
| `NEXT_PUBLIC_APP_PASSWORD_HASH` | Optional SHA-256 hash instead of plaintext. |

**Production:** set GitHub Actions secret `APP_PASSWORD` to the same password (see Deploy). The password is fixed at build time; change it only by updating the secret and redeploying.

If neither is set at build time, the app opens without a password gate.

## Data & Backups

- Timeline data lives **only in the browser** (IndexedDB) on each device.
- **Menu → Backup & restore** — download JSON, import on this or another device.
- To move data between devices, copy the JSON file (iCloud, OneDrive, email, etc.).
- Deleting an event or background shows an **Undo** toast for a few seconds.

## GitHub Sync (multi-device)

Optional. The app can commit the timeline to a JSON file in a GitHub repo and pull it again on every device — no manual export/import.

1. On GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Restrict it to this repository and grant **Contents: Read and write**. Copy the token.
2. In the app: **Menu → GitHub sync…**, enter `owner/repo`, keep branch `main` and path `data/timeline.json`, paste the token, **Connect**.
3. Repeat step 2 on each device (same token is fine, or one per device).

Edits are committed a few seconds after you make them; the app pulls the latest file when opened or when the tab regains focus. If two devices edit at the same time the changes are merged by item (newest `updatedAt` wins). The token is stored only in the browser. Note that the data file is as visible as the repo itself — in a public repo it is public.

## Images

The app does **not** upload image files. Host them yourself, then paste the full URL:

1. Put files on your site, e.g. `https://yourdomain.com/timeline-images/photo.jpg`
2. Paste that URL when editing an event or background.

Backups store URLs only — keep the image files on your server.

**Backgrounds** support a separate **image opacity** slider (default 45%) so the timeline stays readable over the image.

## Build & Deploy

```bash
npm run build
```

Static site output is in the **`out/`** directory.

### Custom domain (recommended)

For `https://yourdomain.com` or `https://timeline.yourdomain.com`:

```bash
npm run build
```

Do **not** set `GITHUB_PAGES=true` — that mode is only for project sites at `https://<user>.github.io/<repo>/`.

Upload the contents of `out/` to your host, or use the GitHub Actions workflow below **after** removing `GITHUB_PAGES: true` from `.github/workflows/deploy.yml`.

### GitHub Pages with automatic deploy

1. Push this repo to GitHub.
2. **Settings → Pages → Source:** GitHub Actions.
3. Optional: **Settings → Secrets and variables → Actions** — add `APP_PASSWORD` (or use `NEXT_PUBLIC_APP_PASSWORD_HASH` in the workflow instead of plaintext).
4. Push to `main` to trigger `.github/workflows/deploy.yml`.

**Important:** The included workflow currently sets `GITHUB_PAGES=true`, which adds a `/RepoName` URL prefix. For a **custom domain at the site root**, edit the workflow and remove the `GITHUB_PAGES: true` line from the build step, then set your custom domain under **Settings → Pages**.

For `https://<user>.github.io/<repo>/` only (no custom domain), build with:

```bash
GITHUB_PAGES=true npm run build
```

### Namecheap (or other DNS)

Point your domain at GitHub Pages (CNAME to `<user>.github.io`) or upload `out/` to your hosting. Enable HTTPS on the host. No Namecheap web hosting is required for GitHub Pages.

## Keyboard shortcuts

| Key | Action |
|---|---|
| `+` / `-` | Zoom in / out |
| `f` | Fit entire timeline |
| `/` | Search events |
| `←` / `→` | Pan |

See **Menu → Help & shortcuts** in the app for the full list.

## Data Model

```json
{
  "events": [{
    "id": "uuid",
    "title": "string",
    "startDate": "YYYY-MM-DD or -YYYY-MM-DD for BC",
    "endDate": "optional",
    "notes": "string",
    "categoryIds": ["uuid"],
    "links": ["url"],
    "imageUrl": "https://yourdomain.com/...",
    "featured": false,
    "createdAt": "ISO",
    "updatedAt": "ISO"
  }],
  "backgrounds": [{
    "id": "uuid",
    "title": "string",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "notes": "string",
    "links": ["url"],
    "imageUrl": "optional",
    "imageOpacity": 0.45,
    "createdAt": "ISO",
    "updatedAt": "ISO"
  }],
  "categories": [{
    "id": "uuid",
    "name": "string",
    "color": "#hex",
    "createdAt": "ISO",
    "updatedAt": "ISO"
  }]
}
```

## License

MIT
