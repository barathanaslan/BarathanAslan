# barathanaslan.com — personal portfolio

A Windows 98 desktop that presents Barathan Aslan's CV, with
working apps around it: folders of links, Internet Explorer, Notepad, an
MS-DOS prompt, Minesweeper, Solitaire, wallpapers, and a live view of which of
Barathan's computers are awake.

**Copy rule (Barathan's call, 2026-10-14):** no first-person or
self-describing text anywhere on the site. Link descriptions come from the CV
or from the linked site's own description; interface text stays neutral, as
in Windows. Don't add "about me" blurbs, taglines or jokes in Barathan's voice. Static site, no build step, served by GitHub
Pages from `main` at the apex domain `barathanaslan.com`. The live machine
status comes from a small Cloudflare Worker (`status/`).

## Architecture

| File | Role |
|---|---|
| `index.html` | Markup for the desktop icons, the two windows that need real HTML (CV, Send Mail) and the taskbar. Every other window is built by its app script. `.cv-content` ships empty and is filled at runtime. |
| `app.js` | The shell: helpers (`h()`, `store`), Clippy, popup menus (`Menus`, `menubar()`), the window manager (`WM`), desktop icons and context menu, Start menu, clock, `Wallpaper`, and the `cv.json` renderer. Boot sequence at the end. |
| `apps/system.js` | `LINKS` (the outside sites), `FolderView` (Explorer-style windows), My Documents, Recycle Bin, Internet Explorer (a Links page), Notepad (one Untitled document), Display Properties, Run, Shut Down. |
| `apps/network.js` | `MACHINES`, the status client (`MachineStatus`), My Computer, machine Properties, the MS-DOS Prompt (`ping`, `tailmon`, `dir`...), the tray icon. |
| `apps/minesweeper.js`, `apps/solitaire.js` | The games, written from scratch. Graphics are CSS and inline SVG (canvas for the Solitaire finale). |
| `apps/apps.css` | Styles for everything in `apps/`. `style.css` keeps the shell, CV, mail, print and Clippy styles. |
| `cv.json` | **Source of truth for the CV content.** Edit the CV here, not in `index.html`. |
| `print.js` | Print / PDF export of the CV window — clones `.cv-content` into an iframe, so it depends on the class names `app.js` emits. |
| `assets/` | Vendored: `98.css` v0.1.21 + its four `ms_sans_serif*` webfonts, `icons/`, `clippy-map.png`. |
| `status/` | The machine-status relay: `worker/` (Cloudflare Worker) and `reporter/` (the Mac mini's launchd job). Excluded from the Pages build by `_config.yml`. |
| `_config.yml` | Keeps `docs/`, `status/` and other non-site files out of the GitHub Pages (Jekyll) build. |
| `cv-html-template.html` | **ORPHAN** — not referenced by the site. |
| `BarathanAslanCV.pdf` | The real CV PDF. |
| `CNAME` | `barathanaslan.com` — binds the Pages site to the apex domain. |

Scripts load with `defer` in this order: `app.js`, then `apps/*.js`. The apps
use globals from `app.js`; `network.js` also uses `FolderView` and
`runCommand` from `system.js`.

No dependencies are fetched at runtime and every asset is same-origin, except
the status JSON from `status.barathanaslan.com`. The webfonts must stay next to
`assets/98.css`: its `@font-face` rules reference them by bare relative filename.

### Icons

`assets/icons/<name>-32.png` and `<name>-16.png`, referenced through
`iconSrc(name, size)`. They are the classic Windows 98 icons, taken from the
`alexh/vintage-icons` repository on GitHub (the win98icons site the originals
came from now refuses requests). Shortcut arrows are drawn by adding the class
`shortcut` to an `.icon-img`.

### The window manager

`WM.register(id, options)` declares an app; `WM.open(id, args)` shows it,
building the window on first use; `launch(id, args)` does the same and has
Clippy apologise for unknown ids. The options are documented above
`const WM` in `app.js`. A window is built from scratch unless `options.element`
adopts existing markup (the CV and Send Mail windows). Title-bar buttons are
matched by `aria-label`. Hidden (closed or minimised) windows carry the class
`wm-hidden`; maximised ones carry `maximized`. Dialogs (`dialog: true`) have no
taskbar button; `fixedSize` windows size to their content. `WM.messageBox()`
returns a Promise of the button pressed.

Desktop icons declare what they do in markup: `data-open="<app id>"` (plus an
optional `data-file`) or `data-href="<url>"`. No JS change is needed to add one.

### Boot and shut-down

- No name or wordmark for the desktop itself: the boot splash, shut-down
  screens and Start banner use the Windows flag icon (`windows-32.png`).
- `Boot` (end of `app.js`) runs on every page load: a BIOS screen with a
  memory count, the splash screen with a moving bar, then the desktop filling
  in (wallpaper, taskbar, icons one at a time, the CV window), about 6.5 s in
  all. Any click or key press skips to the finished desktop; with reduced
  motion it is skipped entirely. The `#boot` overlay is in `index.html` and
  only shows when the inline script in `<head>` has added the `js` class, so
  a browser without JavaScript never gets stuck behind it.
- Shut Down → Stand by / Shut down show `bounceScreen()` (`apps/system.js`):
  the Windows flag icon drifts and shifts hue at each edge, DVD-player style. A
  click wakes from stand-by back to the same desktop; after Shut down it
  reloads the page, which boots again. Restart reloads straight away.

### Small screens and touch

- Breakpoint **700px**, declared in `style.css`, `apps/apps.css` and
  `app.js` (`smallScreen`). **Keep them in sync.** Below it, ordinary windows
  fill the viewport minus the taskbar and are not draggable; dialogs and
  fixed-size windows (Minesweeper) stay centred. The window manager stops
  writing inline geometry for filling windows, and re-fits everything when the
  breakpoint is crossed.
- Icons open on double-click with a mouse and on a single tap on touch
  (`wireIcon()`), and with Enter/Space from the keyboard.
- Dragging and resizing use pointer events with pointer capture;
  `.title-bar` sets `touch-action: none`.
- `clampIntoView()` measures against the desktop's `clientWidth`, **not**
  `innerWidth`: on a touch device the layout viewport grows to cover
  overflowing content, so `innerWidth` would report every window as fitting.
- Minesweeper: press and hold flags a square, and a Flag mode button appears on
  coarse pointers. Cells grow to fill the phone's width. Solitaire: tapping a
  card sends it to the best legal place, so dragging is optional.

### Visitor state

Everything a visitor changes stays in their own browser (`localStorage`, keys
prefixed `b98.`, every access wrapped by `store`): wallpaper, the Notepad
text, Minesweeper level and best times, Solitaire draw mode, and the Run box's
last command.

### Wallpapers

`Wallpaper` in `app.js`. Patterns are 8x8 one-bit bitmaps (original designs)
rendered as SVG data URLs over the chosen colour; "pictures" are pure CSS.
To add photos, put them in `assets/wallpapers/` (webp, roughly 200 KB each) and
list them in `PHOTOS` as `{id, name, src}`; Display Properties then offers
Stretch / Center / Tile for them.

### Editing the CV

Change `cv.json`. Rich text is expressed as arrays of inline nodes — a plain
string, `{"text","href"}` for a link, or `{"text","bold":true}` for `<b>`. The
renderer only ever creates text nodes, so nothing in the JSON is interpreted as
markup. Rendered class names must not drift: `style.css` and `print.js` key off
`.section-heading`, `.section-divider`, `.profile-handle`, `.cert-list .subitem`
and friends.

### Editing the other content

- Links (My Documents, IE): `LINKS` in `apps/system.js`.
- Recycle Bin: `RECYCLED` in `apps/system.js`.
- Clippy's Start → Help tips: `HELP_TIPS` in `app.js`.
- Machines in My Computer: `MACHINES` in `apps/network.js`, and `HOSTS` in
  both `status/worker/src/index.js` and `status/reporter/report.py`.

## Machine status (`status/`)

```
Mac mini ── every 2 min ──▶ POST /v1/report ──▶ Worker + KV ◀── GET /v1/status ── browsers
(launchd: tailmon json → report.py)              status.barathanaslan.com
```

- **Visitors never reach the machines.** They read a summary cached at the
  edge for 30 s. Nothing in the page can send anything to a machine.
- `report.py` runs `tailmon json` on the mini and keeps only: status, OS, CPU %,
  core count, RAM % and total, first GPU's name, utilisation and VRAM, uptime in
  hours — for the three hosts in `HOSTS`. No IPs, process lists, disks or
  network counters. `--dry-run` prints exactly what would be sent.
- The Worker checks a bearer token (`REPORT_TOKEN` secret, constant-time
  compare), caps the body at 8 KB and re-sanitises every field against the same
  allow-list before storing it in KV (`STATUS` binding, key `status`). It also
  remembers when each host was last seen awake.
- The page treats a report older than 6 minutes as "unknown" rather than
  guessing, so if the mini is off, every machine shows the time of the last report.
- KV free tier allows 1,000 writes a day; one report every 2 minutes is 720.

Operations:

- Deploy the Worker: `cd status/worker && wrangler deploy`.
- The token lives on the mini in `~/.config/barathan98-status/token` (mode 600)
  and in the Worker as `REPORT_TOKEN`. To rotate: write a new token to the file,
  then `tr -d '\n' < ~/.config/barathan98-status/token | wrangler secret put REPORT_TOKEN`.
- Install or reinstall the launchd job (label `com.barathan.barathan98-status`):
  `status/reporter/install.sh`. It points at the script inside this repo, so
  re-run it if the repo moves. Errors go to
  `~/Library/Logs/barathan98-status.log`, which the script truncates past 1 MB.
- Stop it: `launchctl bootout gui/$(id -u)/com.barathan.barathan98-status`.

## Hosting

- Registrar + DNS: Cloudflare. The site's records are **DNS only** (grey cloud)
  on purpose — proxying collides with GitHub's cert provisioning and can cause
  redirect loops.
- Apex is primary; `www` CNAMEs to `barathanaslan.github.io` and GitHub 301s it to apex.
- TLS: Let's Encrypt, auto-provisioned by GitHub Pages. "Enforce HTTPS" is on.
- `status.barathanaslan.com` is a Worker custom domain (`barathan98-status`),
  created by `wrangler deploy`; Cloudflare manages its record and certificate.
- Unrelated record in the same zone: `foconet.barathanaslan.com` (proxied, a Worker).
  **Do not touch it.**

## Contact form

`index.html` posts to FormSubmit (`formsubmit.co`). The `_next` hidden input must
point at the live domain or users get bounced to the wrong host after sending.
