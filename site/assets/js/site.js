// gunnaringe.sort.land
//
// Loaded synchronously in <head> so the `zoom` class and the theme are on
// <html> before the first paint. Everything else waits for DOMContentLoaded.
//
// Themes: "hacker" (default, also what the HTML ships with) and "suit". The
// choice is kept in localStorage under "theme".
//
// Zoom view: the sections are cards on a large canvas (positions live in
// site.css as --x/--y/--r/--s). A camera { x, y, w, r } describes what is on
// screen: the canvas point at the centre of the viewport, the viewport width in
// canvas units, and the rotation. Moving between cards animates the camera
// along a smooth zoom path (van Wijk & Nuij, the same curve d3-zoom uses).
//
// Plain view: a normal scrolling page. Used without JavaScript, on small
// screens, when reduced motion is requested, when printing, or by choice.

(() => {
  "use strict";

  const root = document.documentElement;
  const capable = matchMedia(
    "screen and (prefers-reduced-motion: no-preference) and (min-width: 60em) and (min-height: 32em)",
  );

  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode, blocked site data). The
      // toggles still work for this visit.
    }
  };
  const wantsZoom = () => capable.matches && read("view") !== "plain";

  root.classList.toggle("zoom", wantsZoom());
  root.dataset.theme = read("theme") === "suit" ? "suit" : "hacker";

  document.addEventListener("DOMContentLoaded", () => {
    setUpEmail();
    setUpTheme();
    setUpHeaderOffset();
    setUpZoom();
  });

  // The header is sticky in plain view; its height (which depends on font and
  // theme) feeds scroll-padding-top in site.css.
  function setUpHeaderOffset() {
    const header = document.querySelector(".site-header");
    new ResizeObserver(() => {
      root.style.setProperty("--header-h", `${header.offsetHeight}px`);
    }).observe(header);
  }

  function setUpTheme() {
    const button = document.querySelector(".theme-toggle");
    const metas = [...document.querySelectorAll("meta[name=theme-color][data-suit]")];

    const show = () => {
      const hacker = root.dataset.theme === "hacker";
      button.textContent = hacker ? "Suit" : "Hacker";
      button.setAttribute("aria-label", hacker ? "Switch to suit theme" : "Switch to hacker theme");
      for (const meta of metas) meta.content = hacker ? "#000000" : meta.dataset.suit;
    };

    button.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "hacker" ? "suit" : "hacker";
      write("theme", root.dataset.theme);
      show();
      // Card sizes change with the font; let the zoom view re-fit once the
      // new font has loaded.
      document.fonts.ready.then(() => dispatchEvent(new Event("resize")));
    });

    show();
  }

  // The address is assembled here so it never appears in the HTML source.
  function setUpEmail() {
    for (const link of document.querySelectorAll("a.email")) {
      const address = `${link.dataset.user}@${link.dataset.domain}`;
      link.href = `mailto:${address}`;
      link.querySelector(".email-text").textContent = address;
    }
  }

  function setUpZoom() {
    const viewport = document.querySelector(".viewport");
    const canvas = document.querySelector(".canvas");
    const linkLayer = document.querySelector("svg.links");
    const frames = [...document.querySelectorAll(".frame")];
    const navLinks = [...document.querySelectorAll(".nav-list a")];
    const overviewButton = document.querySelector(".overview-button");
    const toggle = document.querySelector(".view-toggle");

    const MAX_TEXT_SCALE = 1.25; // never magnify text more than this
    const CHROME = 180; // vertical room kept free for header and footer

    let enabled = false;
    let current = null; // the active frame, or null for the overview
    let camera = null;
    let animation = 0;

    const frameById = (id) => frames.find((frame) => frame.id === id) ?? null;
    const frameFromHash = () => {
      try {
        return frameById(decodeURIComponent(location.hash.slice(1)));
      } catch {
        return null; // malformed escape in the URL
      }
    };

    function geometry(frame) {
      const style = getComputedStyle(frame);
      const number = (name) => parseFloat(style.getPropertyValue(name)) || 0;
      return {
        x: number("--x"),
        y: number("--y"),
        r: number("--r"),
        s: number("--s") || 1,
        w: frame.offsetWidth,
        h: frame.offsetHeight,
      };
    }

    function cameraFor(frame) {
      const availableWidth = innerWidth * 0.86;
      const availableHeight = innerHeight - CHROME;

      if (frame) {
        const g = geometry(frame);
        const k = Math.min(
          availableWidth / (g.w * g.s),
          availableHeight / (g.h * g.s),
          MAX_TEXT_SCALE / g.s,
        );
        return { x: g.x, y: g.y, w: innerWidth / k, r: g.r };
      }

      // Overview: fit the bounding box of every (rotated, scaled) card.
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const f of frames) {
        const g = geometry(f);
        const angle = (g.r * Math.PI) / 180;
        const halfW = ((g.w * g.s) / 2) * Math.abs(Math.cos(angle)) + ((g.h * g.s) / 2) * Math.abs(Math.sin(angle));
        const halfH = ((g.w * g.s) / 2) * Math.abs(Math.sin(angle)) + ((g.h * g.s) / 2) * Math.abs(Math.cos(angle));
        minX = Math.min(minX, g.x - halfW);
        maxX = Math.max(maxX, g.x + halfW);
        minY = Math.min(minY, g.y - halfH);
        maxY = Math.max(maxY, g.y + halfH);
      }
      const k = Math.min(availableWidth / (maxX - minX), availableHeight / (maxY - minY), 1);
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: innerWidth / k, r: 0 };
    }

    function apply({ x, y, w, r }) {
      const k = innerWidth / w;
      canvas.style.transform = `scale(${k}) rotate(${-r}deg) translate(${-x}px, ${-y}px)`;
    }

    // Smooth zoom path between two views [x, y, w]. Zooms out while panning
    // far, so long moves read as "pull back, fly over, zoom in".
    function zoomPath([x0, y0, w0], [x1, y1, w1]) {
      const rho = Math.SQRT2;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const d2 = dx * dx + dy * dy;

      if (d2 < 1e-6) {
        const S = Math.log(w1 / w0) / rho;
        return { length: Math.abs(S), at: (t) => [x0 + t * dx, y0 + t * dy, w0 * Math.exp(rho * t * S)] };
      }

      const d1 = Math.sqrt(d2);
      const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1);
      const b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1);
      const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
      const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      const S = (r1 - r0) / rho;
      return {
        length: S,
        at: (t) => {
          const s = t * S;
          const u = (w0 / (2 * d1)) * (Math.cosh(r0) * Math.tanh(rho * s + r0) - Math.sinh(r0));
          return [x0 + u * dx, y0 + u * dy, (w0 * Math.cosh(r0)) / Math.cosh(rho * s + r0)];
        },
      };
    }

    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

    function flyTo(target, instant = false) {
      cancelAnimationFrame(animation);
      if (instant || !camera) {
        camera = target;
        apply(camera);
        return;
      }

      const from = camera;
      const path = zoomPath([from.x, from.y, from.w], [target.x, target.y, target.w]);
      const duration = Math.min(1500, Math.max(750, path.length * 1000));
      const start = performance.now();
      canvas.style.willChange = "transform";

      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = ease(t);
        const [x, y, w] = path.at(e);
        camera = { x, y, w, r: from.r + (target.r - from.r) * e };
        apply(camera);
        if (t < 1) {
          animation = requestAnimationFrame(step);
        } else {
          camera = target;
          apply(camera);
          canvas.style.willChange = "";
        }
      };
      animation = requestAnimationFrame(step);
    }

    function go(frame, { history: mode = "push", focus = false, instant = false } = {}) {
      const changed = frame !== current;
      current = frame;

      root.classList.toggle("has-active", Boolean(frame));
      for (const f of frames) f.classList.toggle("is-active", f === frame);
      for (const link of navLinks) {
        if (frame && link.hash === `#${frame.id}`) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      }
      overviewButton.hidden = !frame;

      if (changed && mode !== "none") {
        const url = frame ? `#${frame.id}` : location.pathname + location.search;
        if (mode === "push") history.pushState(null, "", url);
        else history.replaceState(null, "", url);
      }

      flyTo(cameraFor(frame), instant);
      if (frame && focus) frame.querySelector("[tabindex='-1']")?.focus({ preventScroll: true });
    }

    function move(direction) {
      const order = [null, ...frames];
      const index = order.indexOf(current);
      const next = order[Math.max(0, Math.min(order.length - 1, index + direction))];
      if (next !== current) go(next, { focus: true });
    }

    function drawLinks() {
      const centres = frames.map(geometry);
      const curve = (a, b, bend) => {
        const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
        const my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
        return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`;
      };
      const paths = [];
      for (let i = 1; i < centres.length; i++) paths.push(curve(centres[i - 1], centres[i], 0.18));
      linkLayer.innerHTML = paths.map((d) => `<path d="${d}"/>`).join("");
    }

    function setEnabled(on) {
      enabled = on;
      root.classList.toggle("zoom", on);
      toggle.hidden = !capable.matches;
      toggle.textContent = on ? "Plain view" : "Zoom view";

      if (on) {
        camera = null;
        current = undefined;
        drawLinks();
        go(frameFromHash(), { history: "none", instant: true });
        requestAnimationFrame(() => root.classList.add("ready"));
      } else {
        cancelAnimationFrame(animation);
        root.classList.remove("ready", "has-active");
        canvas.style.transform = "";
        canvas.style.willChange = "";
        for (const f of frames) f.classList.remove("is-active");
        for (const link of navLinks) link.removeAttribute("aria-current");
        overviewButton.hidden = true;
        frameFromHash()?.scrollIntoView();
      }
    }

    // In-page links (nav, skip link) move the camera instead of scrolling.
    document.addEventListener("click", (event) => {
      if (!enabled || event.defaultPrevented || event.button !== 0) return;

      const link = event.target.closest("a[href^='#']");
      if (link) {
        const frame = frameById(link.hash.slice(1));
        if (frame) {
          event.preventDefault();
          go(frame, { history: frame === current ? "none" : "push", focus: true });
        }
        return;
      }

      if (!viewport.contains(event.target) || event.target.closest("a, button")) return;
      const frame = event.target.closest(".frame");
      if (frame && frame !== current) go(frame, { focus: true });
      else if (!frame && current) go(null);
    });

    overviewButton.addEventListener("click", () => go(null));

    toggle.addEventListener("click", () => {
      write("view", enabled ? "plain" : "zoom");
      setEnabled(!enabled);
    });

    document.addEventListener("keydown", (event) => {
      if (!enabled || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.closest("input, textarea, select, [contenteditable]")) return;

      const onControl = event.target.closest("a, button");
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
          move(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          move(-1);
          break;
        case " ":
          if (onControl) return;
          move(event.shiftKey ? -1 : 1);
          break;
        case "Home":
          go(frames[0], { focus: true });
          break;
        case "End":
          go(frames[frames.length - 1], { focus: true });
          break;
        case "Escape":
          if (!current) return;
          go(null);
          break;
        default:
          return;
      }
      event.preventDefault();
    });

    // Tabbing into a card brings it into view.
    document.addEventListener("focusin", (event) => {
      if (!enabled) return;
      const frame = event.target.closest(".frame");
      if (frame && frame !== current) go(frame, { history: "replace" });
    });

    let swipe = null;
    viewport.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "mouse") swipe = { x: event.clientX, y: event.clientY };
    });
    viewport.addEventListener("pointerup", (event) => {
      if (!enabled || !swipe) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
    });
    viewport.addEventListener("pointercancel", () => {
      swipe = null;
    });

    addEventListener("popstate", () => {
      if (enabled) go(frameFromHash(), { history: "none" });
    });

    const relayout = () => {
      if (!enabled) return;
      drawLinks();
      flyTo(cameraFor(current), true);
    };
    addEventListener("resize", relayout);
    document.fonts?.ready.then(relayout);

    capable.addEventListener("change", () => setEnabled(wantsZoom()));

    setEnabled(wantsZoom());
  }
})();
