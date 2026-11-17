// Renders the card with mock data and saves the README screenshots: stills (PNG) and the header animations (GIF).
// Usage: npm run build && npm run screenshots (the GIFs need ffmpeg)
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { samePixels } from "./png-pixels.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const cardJs = readFileSync(`${root}dist/wero-card.js`, "utf8");

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed",
    "--secondary-background-color": "#ececec",
    "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121",
    "--secondary-text-color": "#727272",
    "--divider-color": "rgba(0,0,0,.12)",
  },
  dark: {
    "--primary-background-color": "#111111",
    "--secondary-background-color": "#282828",
    "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1",
    "--secondary-text-color": "#9b9b9b",
    "--divider-color": "rgba(225,225,225,.12)",
  },
};
const COMMON = {
  "--primary-color": "#03a9f4",
  "--info-color": "#039be5",
  "--success-color": "#43a047",
  "--warning-color": "#ffa600",
  "--error-color": "#db4437",
  "--text-primary-color": "#ffffff",
};

// Minimal stand-ins for Home Assistant's <ha-card> and <ha-icon> (Material Design Icons paths below).
const haElements = (icons) => `
const ICONS = ${JSON.stringify(icons)};
customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--card-background-color);border-radius:12px;" +
      "border:1px solid var(--divider-color);color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes() { return ["icon"]; }
  connectedCallback() { this._draw(); }
  attributeChangedCallback() { this._draw(); }
  _draw() {
    const path = ICONS[(this.getAttribute("icon") || "").replace("mdi:", "")] || "";
    this.style.display = "inline-flex";
    this.innerHTML = '<svg viewBox="0 0 24 24" style="width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px);fill:currentColor"><path d="' + path + '"/></svg>';
  }
});`;

const pageHtml = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { ${Object.entries({ ...THEMES[theme], ...COMMON }).map(([k, v]) => `${k}:${v};`).join("")} }
  body { margin: 0; padding: 16px; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

// Opens a new page with the card of shot s mounted on it ({ file, type, theme, width, config, hass? }).
async function mount(browser, s, icons, hass) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 2000 } });
  page.on("pageerror", (err) => console.error(`${s.file}: ${err.message}`));
  await page.setContent(pageHtml(s.theme, s.width));
  await page.addScriptTag({ content: haElements(icons) });
  await page.addScriptTag({ content: cardJs });
  await page.evaluate(
    ({ type, config, hass, dark }) => {
      const el = document.createElement(type);
      el.setConfig({ type: `custom:${type}`, ...config });
      el.hass = { states: {}, entities: {}, devices: {}, language: "en", locale: { language: "en" },
                  themes: { darkMode: dark }, callService: async () => {}, callWS: async () => ({}), ...hass };
      document.getElementById("root").appendChild(el);
    },
    { type: s.type, config: s.config || {}, hass: { ...hass, ...(s.hass || {}) }, dark: s.theme === "dark" }
  );
  return page;
}

// Renders each shot { file, type, theme, width, config, hass?, after? } into screenshots/<file>.png.
export async function render(shots, { icons = {}, hass = {} } = {}) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of shots) {
    // A fresh page per shot: the scripts declare top-level constants
    const page = await mount(browser, s, icons, hass);
    if (s.after) await s.after(page);
    await page.waitForTimeout(400);
    // The card with the 16 px page padding around it, on the theme background.
    const box = await page.locator("#root").boundingBox();
    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: s.width + 32, height: Math.ceil(box.height) + 32 },
      animations: "disabled",
    });
    // Only rewritten when the decoded pixels differ: a re-encoding alone is not a new screenshot
    const path = `${root}screenshots/${s.file}.png`;
    if (existsSync(path) && samePixels(readFileSync(path), png)) {
      console.log(`screenshots/${s.file}.png (unchanged)`);
    } else {
      writeFileSync(path, png);
      console.log(`screenshots/${s.file}.png`);
    }
    await page.close();
  }
  await browser.close();
}


// ── Animated captures ────────────────────────────────────────────────────────
// The header's CSS animations, paused and stepped frame by frame over PERIOD (every animation of the banner lasts a
// divisor of it), so each GIF loops cleanly at its real speed whatever the machine's speed. Needs ffmpeg.
const PERIOD = 6000;
const FPS = 15;

// Every decoded frame (RGBA) as ffmpeg's per-frame MD5 list: equal lists, same animation.
const decodedFrames = (file) =>
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-pix_fmt", "rgba", "-f", "framemd5", "-"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");

// Pauses every animation of the page (shadow trees included) at `frac` of the period.
const freeze = (page, frac) =>
  page.evaluate(
    ({ f, period }) => {
      const walk = (node, out) => {
        for (const el of node.querySelectorAll("*")) {
          out.push(...el.getAnimations());
          if (el.shadowRoot) walk(el.shadowRoot, out);
        }
        return out;
      };
      for (const a of walk(document, [])) {
        a.pause();
        a.currentTime = 3 * period + f * period;
      }
    },
    { f: frac, period: PERIOD }
  );

// Records each gif { file, type, theme, width, config, hass? } into screenshots/<file>.gif: the banner alone with 8 px
// of the page around it, at 1x, a palette computed from its frames (deterministic). The file in place is only
// replaced when its decoded frames differ.
export async function record(gifs, { icons = {}, hass = {} } = {}) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const g of gifs) {
    const page = await mount(browser, g, icons, hass);
    await page.waitForTimeout(400);
    const box = await page.locator(".banner").first().boundingBox();
    const clip = { x: Math.floor(box.x) - 8, y: Math.floor(box.y) - 8, width: Math.ceil(box.width) + 16, height: Math.ceil(box.height) + 16 };
    const dir = mkdtempSync(join(tmpdir(), "gif-frames-"));
    const frames = Math.round((FPS * PERIOD) / 1000);
    for (let i = 0; i < frames; i++) {
      await freeze(page, i / frames);
      // Frames go to a temporary folder, never to screenshots/
      writeFileSync(join(dir, `f${String(i).padStart(3, "0")}.png`), await page.screenshot({ clip, animations: "allow" }));
    }
    await page.close();
    const gif = join(dir, "out.gif");
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
      "-vf", `scale=${clip.width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
      "-fflags", "+bitexact", "-flags", "+bitexact", "-loop", "0", gif,
    ]);
    const path = `${root}screenshots/${g.file}.gif`;
    const same = existsSync(path) && decodedFrames(path) === decodedFrames(gif);
    if (!same) writeFileSync(path, readFileSync(gif));
    console.log(`screenshots/${g.file}.gif${same ? " (unchanged)" : ""}`);
    rmSync(dir, { recursive: true });
  }
  await browser.close();
}

const icons = {
  "content-copy": "M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z",
  "arrow-expand": "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  "arrow-collapse": "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
  qrcode: "M3,11H5V13H3V11M11,5H13V9H11V5M9,11H13V15H11V13H9V11M15,11H17V13H19V11H21V13H19V15H21V19H19V21H17V19H13V21H11V17H15V15H17V13H15V11M19,19V15H17V19H19M15,3H21V9H15V3M17,5V7H19V5H17M3,3H9V9H3V3M5,5V7H7V5H5M3,15H9V21H3V15M5,17V19H7V17H5Z",
  "qrcode-scan": "M4,4H10V10H4V4M20,4V10H14V4H20M14,15H16V13H14V11H16V13H18V11H20V13H18V15H20V18H18V20H16V18H13V20H11V16H14V15M16,15V18H18V15H16M4,20V14H10V20H4M6,6V8H8V6H6M16,6V8H18V6H16M6,16V18H8V16H6M4,11H6V13H4V11M9,11H13V15H11V13H9V11M11,6H13V10H11V6M2,2V6H0V2A2,2 0 0,1 2,0H6V2H2M22,0A2,2 0 0,1 24,2V6H22V2H18V0H22M2,18V22H6V24H2A2,2 0 0,1 0,22V18H2M22,22V18H24V22A2,2 0 0,1 22,24H18V22H22Z",
};
const config = { url: "https://share.weropay.eu/p/1/c/EXAMPLE0123", name: "Alex" };
const received = { ...config, entity: "input_boolean.wero_paid" };
const paid = { states: { "input_boolean.wero_paid": { state: "on" } } };

await render(
  [
    { file: "card", type: "wero-card", theme: "light", width: 460, config },
    { file: "card-dark", type: "wero-card", theme: "dark", width: 460, config: { ...config, title: "Refund" } },
    // The mini card: one row with a QR thumbnail, then the narrowest one (a phone, a few columns)
    { file: "mini-card", type: "wero-mini-card", theme: "light", width: 380, config },
    { file: "mini-card-dark", type: "wero-mini-card", theme: "dark", width: 380, config: { ...config, title: "Refund" } },
    { file: "mini-card-narrow", type: "wero-mini-card", theme: "light", width: 180, config },
    { file: "mini-card-narrow-dark", type: "wero-mini-card", theme: "dark", width: 180, config },
    // The illustrated header once the payment entity reports it received
    { file: "mini-card-received", type: "wero-mini-card", theme: "light", width: 380, config: received, hass: paid },
    { file: "mini-card-received-dark", type: "wero-mini-card", theme: "dark", width: 380, config: received, hass: paid },
  ],
  { icons }
);

// The header's animations, one GIF per state, light and dark (the dark one gets the night picture)
const waiting = { ...config, entity: "input_boolean.wero_paid" };
const unpaid = { states: { "input_boolean.wero_paid": { state: "off" } } };
await record(
  [
    // Ready (no payment entity): the phone taps the terminal, the green tick comes up
    { file: "header-ready", type: "wero-card", theme: "light", width: 460, config },
    { file: "header-ready-dark", type: "wero-card", theme: "dark", width: 460, config },
    // Waiting for the payment: the phone taps, the terminal's dots blink
    { file: "header-waiting", type: "wero-card", theme: "light", width: 460, config: waiting, hass: unpaid },
    { file: "header-waiting-dark", type: "wero-card", theme: "dark", width: 460, config: waiting, hass: unpaid },
    // The mini card: its QR code on the counter, the tick next to the terminal
    { file: "mini-card-header", type: "wero-mini-card", theme: "light", width: 380, config },
    { file: "mini-card-header-dark", type: "wero-mini-card", theme: "dark", width: 380, config },
  ],
  { icons }
);
