# Status — 2026-08-28

## Done

- **Custom domain migration complete.** `barathanaslan.com` serves the site over
  HTTPS. Verified: apex 200; http→https 301; www→apex 301; old
  `barathanaslan.github.io/BarathanAslan/` → apex 301. Cert valid to 2026-11-26.
- 9 DNS records created in Cloudflare (4 A, 4 AAAA, 1 CNAME for www), all DNS-only.
- `CNAME` file added; FormSubmit `_next` and README URL updated off the github.io path.

## In progress

Polish pass — see `docs/plans/2026-08-28-portfolio-polish.md`. Four tracks agreed:
mobile/touch support, SEO+social metadata, self-hosting CDN assets, and a code
structure cleanup driving the CV from a single `cv.json`.

## Known issues (verified, not yet fixed)

- Only **1** `@media` query in 793 lines of CSS; **10** `ondblclick` handlers with no
  touch equivalent. Desktop icons are likely unopenable on a phone.
- No meta description, Open Graph/Twitter tags, or favicon.
- The only *live* CV is `index.html`; its content is current and matches the
  Jul-2026 PDF. `cv-html-template.html` and `BarathanAslanCV.pdf` are **orphans**
  — nothing links to them. The PDF was badly stale (said "Junior", predated TRACE
  and Pegasus, exposed a phone number); replaced with the current CV 2026-08-28.
- The only export path is the Export PDF button -> `print.js`, which prints the
  on-screen `.cv-content` via `style.css`. Its output does **not** resemble the
  real CV PDF's clean typographic layout.
- 12 assets loaded from third-party CDNs; `unpkg.com/98.css` is **unpinned**.
