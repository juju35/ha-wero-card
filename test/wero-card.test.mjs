// Round-trip tests for the embedded QR encoder: build the QR with the card's own code, decode it
// with jsQR and compare the payload; plus the qr_size option. Run with: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import jsQR from "jsqr";

// Evaluates src/wero-card.js with just enough browser stubs to reach its functions and classes.
function loadCard() {
  const defined = {};
  const ctx = {
    HTMLElement: class {
      attachShadow() {
        this.shadowRoot = { innerHTML: "", getElementById: () => ({}) };
        return this.shadowRoot;
      }
    },
    CustomEvent: class {},
    customElements: {
      get: (n) => defined[n],
      define: (n, c) => {
        defined[n] = c;
      },
    },
    document: { documentElement: { lang: "en" }, createElement: () => ({}) },
    console: { info() {} },
    escape,
    unescape,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL("../src/wero-card.js", import.meta.url), "utf8"), ctx);
  return { ctx, WeroCard: defined["wero-card"] };
}

const { ctx, WeroCard } = loadCard();

// Renders the card's SVG to an RGBA bitmap (dark modules black, the rest white) and decodes it.
function decodeSvg(svg, scale = 8) {
  const dim = Number(/viewBox="0 0 (\d+) /.exec(svg)[1]);
  const size = dim * scale;
  const px = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const [, x, y] of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const i = ((Number(y) * scale + dy) * size + Number(x) * scale + dx) * 4;
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
      }
    }
  }
  const res = jsQR(px, size, size, { inversionAttempts: "dontInvert" });
  assert.ok(res, "QR code could not be decoded");
  return new TextDecoder().decode(Uint8Array.from(res.binaryData));
}

const roundTrip = (text) => decodeSvg(WeroCard.prototype._buildQrSvg(text, 176));

test("getLength counts UTF-8 bytes, surrogate pairs included", () => {
  for (const s of ["abc", "Café", "💶", "Café💶", "é💶", "日本"]) {
    assert.equal(new ctx.QR8bitByte(s).getLength(), Buffer.byteLength(s, "utf8"), s);
  }
});

test("QR round trip keeps a typical Wero link", () => {
  const url = "https://share.weropay.eu/p/1/c/AbCdEfGhIj";
  assert.equal(roundTrip(url), url);
});

test("QR round trip keeps long links (QR versions 8 and above)", () => {
  for (const n of [110, 200, 400, 1000]) {
    const prefix = "https://share.weropay.eu/p/1/c/";
    const url = prefix + "x".repeat(n - prefix.length);
    assert.equal(url.length, n);
    assert.equal(roundTrip(url), url);
  }
});

test("QR round trip keeps multi-byte text", () => {
  const url = `https://share.weropay.eu/p/1/c/${"é💶".repeat(40)}`;
  assert.equal(roundTrip(url), url);
});

function render(config) {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj", ...config });
  return card.shadowRoot.innerHTML;
}

test("without qr_size the QR keeps the default 176 px", () => {
  const html = render({});
  assert.match(html, /\.qr-wrap svg \{[^}]*width: var\(--wero-qr-size, 176px\)/);
  assert.doesNotMatch(html, /--wero-qr-size:/);
  assert.match(html, /<svg [^>]*width="176"/);
});

test("qr_size sets the displayed size", () => {
  const html = render({ qr_size: 300 });
  assert.match(html, /id="qr"[^>]*style="--wero-qr-size:300px"/);
  assert.match(html, /<svg [^>]*width="300"/);
});

test("the copy feedback reaches the icon of the current render, and the timer stops on disconnect", async () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  // Each render gets its own icon node; getElementById returns the latest one
  const icons = [];
  const newIcon = () => {
    const attrs = {};
    icons.push({ attrs, setAttribute: (k, v) => (attrs[k] = v) });
  };
  newIcon();
  card.shadowRoot.getElementById = (id) => (id === "ico" ? icons.at(-1) : {});
  let resolve;
  ctx.navigator = { clipboard: { writeText: () => new Promise((r) => (resolve = r)) } };
  ctx.isSecureContext = true;
  const timers = [];
  ctx.setTimeout = (fn) => timers.push(fn) && timers.length;
  ctx.clearTimeout = (id) => (timers[id - 1] = null);
  try {
    card._copy();
    newIcon(); // re-render while the clipboard call is pending
    resolve();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(icons[0].attrs.icon, undefined);
    assert.equal(icons[1].attrs.icon, "mdi:check");
    card.disconnectedCallback();
    assert.equal(timers[0], null);
  } finally {
    delete ctx.navigator;
    delete ctx.isSecureContext;
    delete ctx.setTimeout;
    delete ctx.clearTimeout;
  }
});

test("grid options and picker entry", () => {
  assert.deepEqual({ ...new WeroCard().getGridOptions() }, { columns: 6, min_columns: 4, rows: "auto" });
  const entry = ctx.customCards.find((c) => c.type === "wero-card");
  assert.equal(entry.description, "Wero QR code, no CDN");
});
