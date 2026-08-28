# barathanaslan.com — personal portfolio

A Windows 98 desktop simulation that presents Barathan Aslan's CV. Static site,
no build step, served by GitHub Pages from `main` at the apex domain
`barathanaslan.com`.

## Architecture

| File | Role |
|---|---|
| `index.html` | Desktop icons, three draggable windows (CV / My Computer / Send Mail), taskbar clock. Historically also held ~320 lines of inline JS. |
| `style.css` | Custom styling layered on top of 98.css |
| `print.js` | Print / PDF export of the CV window |
| `cv-html-template.html` | **ORPHAN** — not referenced by the site |
| `BarathanAslanCV.pdf` | The real CV PDF. Was stale + orphaned; refreshed 2026-08-28 |
| `CNAME` | `barathanaslan.com` — binds the Pages site to the apex domain |

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
