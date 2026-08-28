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

### Small screens and touch

The desktop layout is unchanged; small-screen support is a layer on top of it.

- Breakpoint **700px**, declared twice — `@media screen and (max-width: 700px)`
  at the end of `style.css` and `matchMedia('(max-width: 700px)')` in `app.js`.
  **Keep the two in sync.** Below it the three windows fill the viewport minus
  the taskbar, and `app.js` stops writing inline pixel geometry (which would
  otherwise beat the stylesheet) — see `fitWindowToScreen()`.
- Icons open on double-click on a pointer device and on a single tap on touch.
  `app.js` wires every element carrying an `ondblclick` attribute, reading the
  handler back off the element as `el.ondblclick`, so adding an icon in
  `index.html` needs no JS change. The same pass adds Enter/Space activation;
  the icons carry `tabindex="0" role="button"` in the markup.
- `makeDraggable()` has a touch path beside the mouse one. It calls
  `preventDefault` on `touchmove`, and `.title-bar` sets `touch-action: none`.
- `clampIntoView()` pulls a window back on-screen when its stylesheet position
  hangs off the edge (the mail window on a tablet). It measures against
  `documentElement.clientWidth`, **not** `innerWidth`: on a touch device the
  layout viewport grows to cover overflowing content, so `innerWidth` would
  report every window as fitting.

Pre-existing quirks deliberately left alone, because fixing either would move
desktop pixels: the UA's 8px `body` margin plus `.screen-layout { width: 100vw }`
makes the page 8px wider than the viewport above 700px, and there is no
`favicon.ico`, so every load logs one 404.

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
