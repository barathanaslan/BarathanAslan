# barathanaslan.com — personal portfolio

A Windows 98 desktop simulation that presents Barathan Aslan's CV. Static site,
no build step, served by GitHub Pages from `main` at the apex domain
`barathanaslan.com`.

## Architecture

| File | Role |
|---|---|
| `index.html` | Markup only: desktop icons, three windows (CV / My Computer / Send Mail), taskbar. `.cv-content` ships empty and is filled at runtime. |
| `app.js` | All desktop behaviour (open/close/min/max/drag/resize, z-order, clock, Clippy) plus the `cv.json` fetch and DOM renderer. Loaded with `defer`. |
| `cv.json` | **Source of truth for the CV content.** Edit the CV here, not in `index.html`. |
| `style.css` | Custom styling layered on top of 98.css |
| `print.js` | Print / PDF export of the CV window — clones `.cv-content` into an iframe, so it depends on the class names `app.js` emits |
| `assets/` | Vendored third parties: `98.css` v0.1.21 + its four `ms_sans_serif*` webfonts, `icons/` (win98icons), `clippy-map.png` |
| `cv-html-template.html` | **ORPHAN** — not referenced by the site |
| `BarathanAslanCV.pdf` | The real CV PDF. Was stale + orphaned; refreshed 2026-08-28 |
| `CNAME` | `barathanaslan.com` — binds the Pages site to the apex domain |

No build step, no dependencies fetched at runtime — every asset is same-origin.
The webfonts must stay next to `assets/98.css`: its `@font-face` rules reference
them by bare relative filename.

### Editing the CV

Change `cv.json`. Rich text is expressed as arrays of inline nodes — a plain
string, `{"text","href"}` for a link, or `{"text","bold":true}` for `<b>`. The
renderer only ever creates text nodes, so nothing in the JSON is interpreted as
markup. Rendered class names must not drift: `style.css` and `print.js` key off
`.section-heading`, `.section-divider`, `.profile-handle`, `.cert-list .subitem`
and friends.

### Known issue

The taskbar CV button points at `assets/icons/wordpad-0.png`, which does not
exist — that icon was never available upstream either, so the button has always
rendered a broken image. `write_wordpad-0.png` on win98icons is the obvious
replacement, but adopting it is a visual change, not a refactor.

## Hosting

- Registrar + DNS: Cloudflare. Records are **DNS only** (grey cloud) on purpose —
  proxying collides with GitHub's cert provisioning and can cause redirect loops.
- Apex is primary; `www` CNAMEs to `barathanaslan.github.io` and GitHub 301s it to apex.
- TLS: Let's Encrypt, auto-provisioned by GitHub Pages. "Enforce HTTPS" is on.
- Unrelated record in the same zone: `foconet.barathanaslan.com` (proxied, a Worker).
  **Do not touch it.**

## Contact form

`index.html` posts to FormSubmit (`formsubmit.co`). The `_next` hidden input must
point at the live domain or users get bounced to the wrong host after sending.
