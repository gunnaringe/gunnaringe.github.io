# gunnaringe.sort.land

Personal page of Gunnar Inge Gjøvik Sortland: <https://gunnaringe.sort.land/>

Plain HTML, CSS, and a little JavaScript. No framework, no dependencies, and
nothing loaded from third parties.

## How it works

- **Zoom view.** On larger screens the four sections are cards on a canvas, and
  the camera pans and zooms between them (`site/assets/js/site.js`). Card
  positions live in `site/assets/css/site.css` as `--x`, `--y`, `--r`, and `--s`.
- **Plain view.** A normal scrolling page. Used without JavaScript, on small
  screens, when reduced motion is requested, and when printing.
- **Look.** A green CRT terminal (VT323, scan lines), after the hacker theme
  of clock.apphub.casa. Only the name is in the handwriting font.
- **Email.** The address is assembled by JavaScript so it never appears in the
  HTML source. Without JavaScript it reads `gunnar.inge [at] sort.land`.

## Layout

```
site/            what gets published
  index.html     the page
  404.html
  _headers       security and cache headers (Cloudflare)
  assets/        css, js, font (handwriting and VT323, WOFF2), img (portrait, icons, og.png)
  .well-known/keybase.txt
redirect/        the page GitHub Pages serves, forwarding to gunnaringe.sort.land
tools/           og.png/icon sources and the apphub.casa screenshot script
build.sh         site/ -> dist/
wrangler.jsonc   Cloudflare config: build, assets, custom domain
```

## Local preview

```sh
./build.sh
python3 -m http.server -d dist 8000
```

Then open <http://localhost:8000/>.

## Build

`build.sh` copies `site/` to `dist/`, then:

- sets the footer's "Updated" month and the sitemap date from the last commit
- replaces `?v=dev` on asset URLs with the commit hash, so assets can be cached
  for a year (see `_headers`) and still update on every deploy

## Deploy

**Cloudflare** (the site): `wrangler.jsonc` holds the whole setup, so in
Workers & Pages choose "Import a repository", pick this repository, name the
project `gunnaringe` (it must match `name` in `wrangler.jsonc`), and keep the
default deploy command `npx wrangler deploy`. That command runs `build.sh`,
uploads `dist/` as static assets, and attaches `gunnaringe.sort.land` as a
custom domain, which creates its DNS record and certificate. This needs the
`sort.land` zone to be on Cloudflare in the same account.

**GitHub Pages** (the old address): Settings → Pages → Source: "GitHub
Actions". Then run the "Publish GitHub Pages redirect" workflow by hand. It
publishes `redirect/`, which forwards `gunnaringe.github.io` to the new
address. Only run it once the Cloudflare site is live.

## Checks

`.github/workflows/check.yml` validates the HTML (html-validate) and checks
links (lychee) on every pull request and push to `master`.

## Regenerating images

After changing `tools/og.html` or `site/assets/img/icon.svg`:

```sh
npm install --no-save playwright
node tools/render-images.mjs
python3 -c "from PIL import Image; Image.open('site/assets/img/icon-192.png').convert('RGBA').save('site/favicon.ico', sizes=[(16,16),(32,32),(48,48)])"
```

## Refreshing the apphub.casa screenshots

The Apps card shows a screenshot of the live <https://apphub.casa/>, in light
and dark. To refresh both after apphub.casa changes:

```sh
npm install --no-save playwright
node tools/screenshot-apphub.mjs
```

## History

- `v2013`: the original site (Bootstrap, jQuery)
- `v2020`: the impress.js zoom version
