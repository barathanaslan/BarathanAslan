# Interactive desktop — 2026-10-13

Goal: make the site something to play with, not just a frame around the CV.
Most icons only showed Clippy's "not yet" bubble, and My Computer listed
machines that no longer exist.

## Decisions

- **One window manager first.** The old `app.js` had a copy of
  open/close/minimise/maximise per window. Adding ~10 apps needed a generic
  `WM` instead; the CV and Send Mail windows are adopted from the existing
  markup so their behaviour and the print path stay the same.
- **"Ping my computers" without exposing them.** Opening ports or showing
  Tailscale addresses was ruled out. The Mac mini already sees the whole
  fleet through tailmon, so it alone pushes an allow-listed summary outbound
  to a Worker; browsers read the Worker's cached copy. No software on the CUDA
  box or the MacBook, no scheduled task on Windows. Shown per machine: awake or
  asleep, last report, CPU/RAM/GPU load, core count, RAM size, GPU model,
  uptime. Not shown: IPs, processes, disks, network, other tailnet devices.
  Visitor pings do not notify anyone (considered, left out: spam).
- **Games written from scratch.** Game rules are not copyrightable and the
  names are generic; Microsoft's sprites and card art are not used. Everything
  is CSS, SVG and canvas, ~12 KB gzipped for both games.
- **External sites open in new tabs.** The Observatory and GitHub send
  `X-Frame-Options: DENY`, so Internet Explorer is a home page of links rather
  than a real browser. It says so.
- **Wallpapers are original.** CSS patterns and pictures; the Win98 originals
  are Microsoft's. Personal photos can be added later (`PHOTOS`).
- **Visitor state stays local.** localStorage only, nothing sent anywhere.

## Not done / ideas

- A screen saver tab in Display Properties.
- Wallpaper photos (waiting for the pictures).
- A fresh `og-image.png` showing the new desktop.
