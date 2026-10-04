# gunnaringe.sort.land

Personal page. Plain HTML/CSS/JS in `site/`, no framework, no dependencies,
nothing loaded from third parties. `README.md` covers how it works, layout,
build and deploy; this file is the short version for agents.

## Deploy

- Cloudflare Worker `gunnaringe` (static assets only, `wrangler.jsonc`),
  deployed by Workers Builds on push to `master`. Pushing to `master` is
  publishing; work on a branch and open a PR.
- `gunnaringe.github.io` is only a redirect (`redirect/`, published by the
  manual "Publish GitHub Pages redirect" workflow). Don't put site content there.
- History of the old sites lives in tags `v2013` and `v2020`, not branches.

## Working on the page

- Two views share one HTML file: the **zoom view** (cards on a canvas, desktop
  only, `html.zoom`) and the **plain view** (normal scrolling page: phones,
  reduced motion, print, or the toggle). Check both after layout changes.
  Card positions for the zoom view are `--x/--y/--r/--s` in `site.css`.
- Two themes on `<html data-theme>`: `hacker` (default, shipped in the HTML;
  green CRT look after clock.apphub.casa, VT323 font, scan lines) and `suit`
  (paper and ink, follows system light/dark). `site.js` applies the stored
  choice (`localStorage.theme`) before first paint. The name always keeps the
  handwriting font. Check both themes after style changes.
- Asset URLs carry `?v=dev`; `build.sh` swaps in the commit hash. Keep the
  suffix on any new asset URL.
- The email address must never appear literally in HTML; `site.js` builds it.
- Copy is English, first person, plain and short.

## Preview and checks

```sh
./build.sh && python3 -m http.server -d dist 8000
```

CI (`.github/workflows/check.yml`) runs html-validate and lychee on PRs. For a
visual check, screenshot `dist/` with Playwright at a phone width (~390px) and
a desktop width (~1400px); `npm install --no-save playwright` (node_modules is
gitignored).

## Generated images: use the scripts, don't redo them by hand

- `node tools/screenshot-apphub.mjs`: refreshes the Apps card screenshots
  (`site/assets/img/apphub.webp` and `apphub-dark.webp`) from the live
  apphub.casa. Run it when apphub.casa changes; output size is fixed at
  1320x825 to match `index.html`.
- `node tools/render-images.mjs`: `og.png` and the PNG icons, from
  `tools/og.html` and `site/assets/img/icon.svg`. `favicon.ico` step is in the README.

Both need `npm install --no-save playwright` first. Look at the output image
once to check it, then commit.
