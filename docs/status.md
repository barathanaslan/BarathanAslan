# Status — 2026-10-13

## Done

- **Interactive desktop ("Barathan 98").** Every icon works now. New: a window
  manager shared by all apps, a Start menu (Programs, Documents, Settings,
  Help, Run, Shut Down), a desktop context menu, wallpapers (Display
  Properties), My Documents with shortcuts to the TRACE Observatory, Craving
  Sugar, GitHub and more, an Internet Explorer links page, Notepad, a Recycle
  Bin, an MS-DOS prompt, Minesweeper and Solitaire. Plan and decisions: `plans/2026-10-13-interactive-desktop.md`.
- **Live machine status.** `status.barathanaslan.com` (Worker
  `barathan98-status` + KV) receives a sanitised `tailmon json` summary from
  the Mac mini every 2 minutes (launchd `com.barathan.barathan98-status`).
  My Computer, machine Properties, `ping` and `tailmon` in the DOS prompt, and
  the tray icon all read it. Verified: unauthenticated and wrong-token reports
  get 401, unknown paths 404, missing values stay null.
- Icons replaced with crisp native 16/32px versions (from
  `alexh/vintage-icons`; the old win98icons site now refuses requests).
- The UA's 8px `body` margin is gone, which also removes the old 8px horizontal
  overflow on desktop, and maximise now really fills the screen (it used to stop
  at 90% width).
- Tested in the browser at 1280x800 and 390x844: every app opens without
  console errors; Solitaire was played to a win by a scripted player (rules,
  undo, auto-finish, finale); Minesweeper won and lost by a scripted solver
  (first click safe, flood fill, chord, flags, best time); touch long-press
  flagging and Flag mode; Notepad save/close prompt; DOS ping/tailmon against
  real Worker data.
- An independent review pass found one critical bug (the Solitaire finale
  re-opened its "Deal again?" box every frame) and a dozen smaller ones
  (window restore across the 700px breakpoint, Notepad "No" keeping edits,
  unbounded z-index, status that never aged when fetches failed, timers that
  outlived a game, a missing 16px Minesweeper icon, Worker forgetting
  hardware/last-seen for absent hosts...). All fixed and re-tested.

- 2026-10-14: removed all first-person / self-describing copy at Barathan's
  request (readme.txt, Clippy's welcome, the IE home-page parody, invented
  Recycle Bin jokes, machine "role" blurbs). Meta descriptions now use the CV's
  profile sentence. See the copy rule in `overview.md`.

- 2026-10-14: realistic boot (BIOS → splash → desktop filling in; click to
  skip) and a bouncing-logo screen for Stand by and Shut down, replacing
  "It's now safe to turn off your computer".

## Open items

- The old CV PDF with a phone number is still in git history, and the repo is
  public. Removing it needs a history rewrite and force-push — not done.
- Wallpaper photos: waiting for Barathan's pictures (see "Wallpapers" in
  `overview.md` for how to add them).
- `og-image.png` still shows the old desktop.
- Privacy call for Barathan: the MacBook's awake/asleep state and "last seen
  awake" time are public, which hints at when Barathan is at the laptop. Dropping it
  means removing it from `MACHINES` (`apps/network.js`) and both `HOSTS` lists.
- `cv-html-template.html` is still an unreferenced orphan. Candidate for deletion.
