# Status — 2026-08-28

## Done

- **Custom domain migration complete.** `barathanaslan.com` serves the site over
  HTTPS. Verified: apex 200; http→https 301; www→apex 301; old
  `barathanaslan.github.io/BarathanAslan/` → apex 301. Cert valid to 2026-11-26.
- 9 DNS records in Cloudflare (4 A, 4 AAAA, 1 CNAME for www), all DNS-only.
- **Phase 1 — assets vendored.** All 12 third-party assets now local under
  `assets/`, including the four webfonts 98.css pulls in by relative path. Zero
  off-origin requests. The unpinned `unpkg.com/98.css` dependency is gone.
- **Phase 2 — code split.** ~300 lines of inline JS moved verbatim to `app.js`;
  the CV renders from `cv.json`. Verified byte-identical CV text (3393 chars).
- **Phase 3 — mobile and touch.** Single-tap opens icons, windows drag by touch,
  windows fill the viewport below 700px, icons are keyboard-focusable, and
  `prefers-reduced-motion` is honoured. Desktop ≥1280px is pixel-identical.
- **Phase 4 — SEO and metadata.** description, canonical, Open Graph, Twitter
  card, favicon set, `robots.txt`, `sitemap.xml`, a `<noscript>` fallback, and a
  Download PDF button that finally exposes `BarathanAslanCV.pdf`.
- Fixed a long-standing bug: the taskbar CV icon pointed at `wordpad-0.png`,
  which returns AccessDenied upstream. It had always rendered broken on live.
- Replaced the stale committed CV PDF (it predated TRACE and Pegasus and carried
  a phone number) with the current one.

## Measured before/after at 390x844

| | Before | After |
|---|---|---|
| Horizontal overflow | 23px | 0 |
| CV window | 351x600 at (62,205) | 390x816, fills screen |
| Tap an icon | nothing happens | opens |

## Open items

- The old CV PDF with a phone number is still in git history, and the repo is
  public. Removing it needs a history rewrite and force-push — not done.
- Pre-existing 8px horizontal overflow at desktop widths (`body` UA margin +
  `.screen-layout { width: 100vw }`). Present on the original site too; fixing it
  globally would shift every desktop pixel, so it was fixed only below 700px.
- `cv-html-template.html` is still an unreferenced orphan. Candidate for deletion.
