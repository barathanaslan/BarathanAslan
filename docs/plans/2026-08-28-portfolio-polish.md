# Plan — portfolio polish (2026-08-28)

Site is LIVE at https://barathanaslan.com (GitHub Pages, `main`). Do **not** push;
commit locally on a branch and stop. The human reviews every diff before deploy.

## Objective

Four tracks, agreed with the owner. Phases 1–2 below are the structural ones.

## Constraints

- Static site, **no build step**. No npm, no bundler, no framework. Plain HTML/CSS/JS.
- Must keep working when opened as a plain file and from Pages at the domain root.
- Keep the Windows 98 aesthetic exactly as-is. This is a refactor, not a redesign.
- Do not touch `CNAME`. Do not change the FormSubmit `_next` value.
- `BarathanAslanCV.pdf` was just refreshed to the current CV — do not overwrite it.

## Phase 1 — vendor third-party assets

Today 12 assets load from third parties, and `unpkg.com/98.css` is **unpinned**.

1. Create `assets/`. Download into it:
   - `https://unpkg.com/98.css` -> `assets/98.css`
   - these 10 icons from `https://win98icons.alexmeub.com/icons/png/` ->
     `assets/icons/`: `computer-4.png`, `computer_explorer-4.png`,
     `directory_closed-4.png`, `file_lines-0.png`, `msie1-4.png`, `notepad-5.png`,
     `outlook_express-4.png`, `recycle_bin_full-4.png`, `windows-0.png`,
     `wordpad-0.png`
   - `https://raw.githubusercontent.com/smore-inc/clippy.js/master/agents/Clippy/map.png`
     -> `assets/clippy-map.png` (referenced from `style.css`)
2. Repoint every reference in `index.html` and `style.css` to the local copies,
   using **relative** paths (`assets/...`, not `/assets/...`).
3. Verify zero remaining references to `unpkg.com`, `win98icons.alexmeub.com`, or
   `raw.githubusercontent.com`.

## Phase 2 — extract JS and introduce a single CV data source

### 2a. Extract inline JS

`index.html` holds ~320 lines of inline JS (roughly lines 425–743) mixed with
content. Move it verbatim into `app.js`, loaded with `<script defer src="app.js">`.

The functions are called from inline `onclick`/`ondblclick` attributes, so they
must stay reachable as globals. **Behaviour must not change in this step.**
Keep `print.js` a separate file.

### 2b. `cv.json` as the source of truth

Create `cv.json` holding the CV content currently hardcoded in `index.html`'s
`.cv-content` block. Section order on the live site is:

  PROFILE, EDUCATION, LANGUAGES, EXPERIENCE, COMPETITIONS & ACHIEVEMENTS,
  PROFILES, CERTIFICATIONS AND COURSES, ATTENDED EVENTS

Render `.cv-content` from `cv.json` at runtime (plain JS, `fetch` + DOM building).

Hard requirements:
- The rendered DOM must carry the **same class names** the CSS and `print.js`
  already rely on (`.cv-content`, `.section-heading`, `.section-divider`,
  `.profile-handle`, etc.), so styling and printing keep working untouched.
- The rendered page must be **visually identical** to the current site. Diff
  screenshots before/after; any visual change is a bug.
- `fetch` of a local JSON fails on `file://`. That's acceptable (the site is served
  over HTTPS), but the failure must be graceful, not a blank window.
- Escape all text inserted into the DOM; do not build HTML by string concatenation
  of unescaped values.

Extract content faithfully. Do not reword, summarise, or "improve" any CV text.

## Acceptance criteria

- `git diff` shows no change to `CNAME`, `BarathanAslanCV.pdf`, or the FormSubmit
  `_next` value.
- No references to the three third-party hosts remain.
- Opening the site locally over `python3 -m http.server` renders identically to
  https://barathanaslan.com — same layout, same fonts, same icons, all three
  windows open/drag/minimise/maximise/close, taskbar clock ticks, Export PDF works.
- All CV text in `cv.json` matches the current `index.html` character-for-character.

## Out of scope for this phase

Mobile/touch support, SEO metadata, and reshaping the print output to match the
real PDF. Those come next; do not start them.

---

# Phase 3 — mobile / touch support

Branch `polish/structure`. Same rules: no build step, do not push, do not touch
`main`, keep the Win98 aesthetic.

## The problem (verified)

- `style.css` has exactly **1** `@media` query in 793 lines.
- `index.html` uses **10** `ondblclick` handlers. Double-click does not exist on
  touch, so desktop icons cannot be opened on a phone at all.
- `.main-window` is a hard `900px x 600px`; `.window-mycomputer` 350px tall and
  `.window-mail` 400px. On a 390x844 phone these overflow badly.
- Window dragging is wired to `mousedown`/`mousemove`/`mouseup` only — no touch
  events, so windows cannot be moved on a phone.
- 12 resize handles are mouse-only too.

## Required

1. **Touch-open the icons.** Every `ondblclick` needs a touch equivalent. On touch,
   a single tap should open (double-tap-to-open is not a phone idiom and iOS
   Safari treats a fast second tap as a zoom gesture). Keep double-click on
   pointer devices so desktop behaviour is unchanged.
2. **Draggable windows on touch.** Add `touchstart`/`touchmove`/`touchend`
   alongside the mouse handlers in `makeDraggable`. Call `preventDefault` on
   touchmove while dragging so the page doesn't scroll underneath.
3. **Responsive windows.** Below ~700px wide, windows should fill the usable
   viewport (minus the taskbar) rather than sit at fixed px sizes, and should not
   be positioned off-screen by `centerWindow()`.
4. **Keyboard access.** Icons are `<div>`s with no `tabindex` or key handling.
   Give them `tabindex="0"`, `role="button"`, and Enter/Space activation.
5. Respect `prefers-reduced-motion` for the fade-in.

## Non-negotiable

- Desktop appearance and behaviour at >=1280px must be **pixel-identical** to now.
  Verify with a screenshot diff against https://barathanaslan.com before/after.
- Do not redesign the Win98 look. No new colours, fonts, or chrome.
- Do not alter `cv.json` content or the FormSubmit `_next` value.

## Verify

Test at 390x844 (iPhone), 768x1024 (iPad), and 1280x900. At each: every icon
opens its window, windows can be dragged, content is readable without horizontal
page scroll, and the taskbar is usable. Report a screenshot per breakpoint.
