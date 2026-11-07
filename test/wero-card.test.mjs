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
  // 6 columns minimum: at 4 (about 160 px) the header left 52 px to the title, too few for any language
  assert.deepEqual({ ...new WeroCard().getGridOptions() }, { columns: 6, min_columns: 6, rows: "auto" });
  const entry = ctx.customCards.find((c) => c.type === "wero-card");
  assert.equal(entry.description, "Wero QR code, no CDN");
});

test("a negative, zero or non-numeric qr_size keeps the default 176 px", () => {
  for (const qr_size of [-50, 0, "abc", "-10"]) {
    const html = render({ qr_size });
    assert.doesNotMatch(html, /--wero-qr-size:/, String(qr_size));
    assert.match(html, /<svg [^>]*width="176"/, String(qr_size));
  }
});

test("detaching the card during the copy feedback puts the copy icon back", () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  const attrs = {};
  card.shadowRoot.getElementById = (id) => (id === "ico" ? { setAttribute: (k, v) => (attrs[k] = v) } : {});
  ctx.navigator = {};
  ctx.document.body = { appendChild() {} };
  ctx.document.createElement = () => ({ style: {}, select() {}, remove() {} });
  ctx.document.execCommand = () => true;
  ctx.setTimeout = () => 1;
  ctx.clearTimeout = () => {};
  try {
    card._copy();
    assert.equal(attrs.icon, "mdi:check");
    card.disconnectedCallback();
    assert.equal(attrs.icon, "mdi:content-copy");
  } finally {
    delete ctx.navigator;
    delete ctx.document.body;
    delete ctx.document.execCommand;
    ctx.document.createElement = () => ({});
    delete ctx.setTimeout;
    delete ctx.clearTimeout;
  }
});

test("QR version 35 is built with the right alignment patterns", () => {
  // 1800 bytes: too long for version 34, fits version 35 (level M)
  const url = `https://share.weropay.eu/p/1/c/${"x".repeat(1800 - 31)}`;
  const svg = WeroCard.prototype._buildQrSvg(url, 176);
  // 17 + 4 * 35 modules plus a quiet zone of 4 on each side
  assert.equal(/viewBox="0 0 (\d+) /.exec(svg)[1], "165");
  assert.equal(decodeSvg(svg, 4), url);
  assert.deepEqual([...ctx.QRUtil.getPatternPosition(35)], [6, 30, 54, 78, 102, 126, 150]);
});

test("QR build errors are raised; a too-long payload is rejected up front", () => {
  const Model = ctx.QRCodeModel;
  ctx.QRCodeModel = function () {
    this.addData = () => {};
    this.make = () => {
      throw new TypeError("boom");
    };
  };
  try {
    assert.throws(() => WeroCard.prototype._buildQrSvg("https://share.weropay.eu/p/1/c/x", 176), /boom/);
  } finally {
    ctx.QRCodeModel = Model;
  }
  assert.throws(() => WeroCard.prototype._buildQrSvg("x".repeat(3000), 176), /too long/);
});

test("the zoom dialog starts empty: a single QR SVG in the markup", () => {
  const html = render({});
  assert.match(html, /<dialog id="zoom"[^>]*><\/dialog>/);
  assert.equal([...html.matchAll(/<svg /g)].length, 1);
});

test("a re-render closes an open zoom dialog cleanly and reopens it", () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  const calls = [];
  const dlg = {
    open: true,
    firstChild: {},
    close: () => {
      dlg.open = false;
      calls.push("close");
    },
    showModal: () => {
      dlg.open = true;
      calls.push("showModal");
    },
  };
  card.shadowRoot.getElementById = (id) => (id === "zoom" ? dlg : {});
  card._render();
  assert.deepEqual(calls, ["close", "showModal"]);
});

const LANGS = [
  "fr", "de", "es", "sr", "sr-Latn", "it", "nl", "pt", "pl",
  "ro", "da", "sv", "bg", "ru", "uk", "hu", "sk", "cs", "sl", "lv", "el",
];

test("I18N parity: every language has exactly the keys of en, and the editor offers each one", () => {
  const i18n = ctx.WeroI18n;
  // Arrays from the vm context have another prototype: copy them before deepEqual
  const keys = (o) => Array.from(Object.keys(o)).sort();
  const shape = (v) => (Array.isArray(v) ? `array:${v.length}` : typeof v);
  const placeholders = (v) => Array.from(String(v).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
  const ref = keys(i18n.en);
  for (const lang of LANGS) {
    assert.ok(i18n[lang], `missing language ${lang}`);
    assert.deepEqual(keys(i18n[lang]), ref, lang);
    for (const [k, v] of Object.entries(i18n[lang])) {
      assert.ok(typeof v === "string" && v.trim(), `${lang}.${k} empty`);
      assert.equal(shape(v), shape(i18n.en[k]), `${lang}.${k}`);
      assert.deepEqual(placeholders(v), placeholders(i18n.en[k]), `${lang}.${k}`);
    }
  }
  const options = ctx.WERO_EDITOR_SCHEMA.find((f) => f.name === "language").selector.select.options;
  assert.deepEqual(Array.from(options, (o) => o.value).sort(), keys(i18n));
  // pt is European Portuguese: the label says so (pt-BR falls back to it)
  assert.equal(options.find((o) => o.value === "pt").label, "Português (Portugal)");
});

test("Serbian: sr and sr-Latn mirror en (keys, placeholders) and keep to their own script", () => {
  const i18n = ctx.WeroI18n;
  const keys = (o) => Array.from(Object.keys(o)).sort();
  const shape = (v) => (Array.isArray(v) ? `array:${v.length}` : typeof v);
  const placeholders = (v) => Array.from(String(v).matchAll(/\{(\w+)\}/g), (m) => m[1]).sort();
  // Brands, abbreviations and units written in Latin letters in both scripts
  const allowed = /\b(Wero|QR|https|px)\b/g;
  for (const lang of ["sr", "sr-Latn"]) {
    assert.deepEqual(keys(i18n[lang]), keys(i18n.en), lang);
    for (const k of Object.keys(i18n.en)) {
      assert.equal(shape(i18n[lang][k]), shape(i18n.en[k]), `${lang}.${k}`);
      assert.deepEqual(placeholders(i18n[lang][k]), placeholders(i18n.en[k]), `${lang}.${k}`);
      const text = String(i18n[lang][k]).replace(allowed, "");
      if (lang === "sr") assert.doesNotMatch(text, /[A-Za-z]/, `Latin letter in sr.${k}`);
      else assert.doesNotMatch(text, /[\u0400-\u04FF]/, `Cyrillic letter in sr-Latn.${k}`);
    }
  }
});

test("language resolution: full code if translated, else its base, else en", () => {
  const cases = { "fr-FR": "fr", "sr-Latn": "sr-Latn", sr: "sr", "sr-Cyrl": "sr", de: "de", ja: "en", "": "en" };
  for (const [lang, expected] of Object.entries(cases)) {
    assert.equal(ctx.weroResolveLang(lang), expected, lang);
  }
  // Through the card: hass in sr-Latn shows Latin, a forced language keeps priority over hass
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  card.hass = { language: "sr-Latn" };
  assert.match(card.shadowRoot.innerHTML, /Pošalji novac/);
  card.hass = { language: "sr" };
  assert.match(card.shadowRoot.innerHTML, /Пошаљи новац/);
  const forced = new WeroCard();
  forced.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj", language: "sr-Latn" });
  forced.hass = { language: "fr-FR" };
  assert.match(forced.shadowRoot.innerHTML, /Pošalji novac/);
  // The editor follows hass the same way
  const editor = new (ctx.customElements.get("wero-card-editor"))();
  editor._hass = { language: "sr-Latn" };
  assert.equal(editor._t("ed_language"), "Jezik");
  editor._hass = { language: "ja" };
  assert.equal(editor._t("ed_language"), "Language");
});

test("language resolution: Italian, Dutch, European Portuguese and Polish", () => {
  // pt-BR falls back to European Portuguese on purpose
  const cases = { "it-IT": "it", "nl-BE": "nl", pt: "pt", "pt-BR": "pt", "pl-PL": "pl", "sr-Latn": "sr-Latn", ja: "en" };
  for (const [lang, expected] of Object.entries(cases)) {
    assert.equal(ctx.weroResolveLang(lang), expected, lang);
  }
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  card.hass = { language: "pt-BR" };
  assert.match(card.shadowRoot.innerHTML, /Enviar dinheiro/);
  card.hass = { language: "pl-PL" };
  assert.match(card.shadowRoot.innerHTML, /Wyślij pieniądze/);
  const editor = new (ctx.customElements.get("wero-card-editor"))();
  editor._hass = { language: "nl-BE" };
  assert.equal(editor._t("ed_language"), "Taal");
  editor._hass = { language: "it-IT" };
  assert.equal(editor._t("ed_language"), "Lingua");
});

test("language resolution: Romanian to Greek (12 languages)", () => {
  const cases = {
    "ro-RO": "ro", "da-DK": "da", "sv-SE": "sv", "sv-FI": "sv", "bg-BG": "bg", "ru-RU": "ru", "uk-UA": "uk",
    "hu-HU": "hu", "sk-SK": "sk", "cs-CZ": "cs", "sl-SI": "sl", "lv-LV": "lv",
    "el-GR": "el", el: "el", ja: "en",
  };
  for (const [lang, expected] of Object.entries(cases)) {
    assert.equal(ctx.weroResolveLang(lang), expected, lang);
  }
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  card.hass = { language: "cs-CZ" };
  assert.match(card.shadowRoot.innerHTML, /Poslat peníze/);
  card.hass = { language: "uk" };
  assert.match(card.shadowRoot.innerHTML, /Надіслати гроші/);
  const editor = new (ctx.customElements.get("wero-card-editor"))();
  editor._hass = { language: "el-GR" };
  assert.equal(editor._t("ed_language"), "Γλώσσα");
  editor._hass = { language: "hu" };
  assert.equal(editor._t("ed_language"), "Nyelv");
});

test("the editor creates a single ha-form when setConfig is called again while ha-form loads", async () => {
  const Editor = ctx.customElements.get("wero-card-editor");
  let release;
  ctx.customElements.define("hui-entities-card", {
    getConfigElement: () => new Promise((r) => (release = r)),
  });
  const created = [];
  const prevCreate = ctx.document.createElement;
  ctx.document.createElement = () => {
    const el = { listeners: 0, addEventListener() { this.listeners++; } };
    created.push(el);
    return el;
  };
  try {
    const editor = new Editor();
    const appended = [];
    editor.appendChild = (el) => appended.push(el);
    editor.setConfig({ url: "https://a.example/1" });
    editor.setConfig({ url: "https://a.example/2" });
    release();
    await new Promise((r) => setImmediate(r));
    assert.equal(created.length, 1);
    assert.equal(appended.length, 1);
    assert.equal(created[0].listeners, 1);
    assert.equal(created[0].data.url, "https://a.example/2");
  } finally {
    ctx.document.createElement = prevCreate;
  }
});

test("a failed ha-form load is caught and retried on the next setConfig", async () => {
  const Editor = ctx.customElements.get("wero-card-editor");
  let fail = true;
  ctx.customElements.define("hui-entities-card", {
    getConfigElement: () => (fail ? Promise.reject(new Error("offline")) : Promise.resolve()),
  });
  const errors = [];
  ctx.console.error = (...a) => errors.push(a);
  const prevCreate = ctx.document.createElement;
  ctx.document.createElement = () => ({ addEventListener() {} });
  try {
    const editor = new Editor();
    editor.appendChild = () => {};
    await editor._render(); // resolves: no unhandled rejection
    assert.equal(errors.length, 1);
    assert.equal(editor._form, undefined);
    fail = false;
    editor.setConfig({ url: "https://a.example/3" });
    await new Promise((r) => setImmediate(r));
    assert.equal(editor._form.data.url, "https://a.example/3");
  } finally {
    ctx.document.createElement = prevCreate;
    delete ctx.console.error;
  }
});

test("hass only re-renders when the resolved language changes, and the QR is not rebuilt for it", () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  let renders = 0;
  let builds = 0;
  const render = card._render.bind(card);
  const build = card._buildQrSvg.bind(card);
  card._render = () => (renders++, render());
  card._buildQrSvg = (...a) => (builds++, build(...a));
  card.hass = { language: "en" }; // same as the document language: nothing to do
  card.hass = { language: "en-GB" };
  assert.equal(renders, 0);
  card.hass = { language: "fr" };
  assert.equal(renders, 1);
  assert.match(card.shadowRoot.innerHTML, /Envoyer de l&#39;argent/);
  assert.equal(builds, 0, "the cached QR is reused");

  const forced = new WeroCard();
  forced.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj", language: "de" });
  let forcedRenders = 0;
  const fr = forced._render.bind(forced);
  forced._render = () => (forcedRenders++, fr());
  forced.hass = { language: "fr" };
  assert.equal(forcedRenders, 0);
});

test("a failed legacy copy shows a brief alert icon", () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  const attrs = {};
  card.shadowRoot.getElementById = (id) => (id === "ico" ? { setAttribute: (k, v) => (attrs[k] = v) } : {});
  const timers = [];
  ctx.navigator = {};
  ctx.document.body = { appendChild() {} };
  const prevCreate = ctx.document.createElement;
  ctx.document.createElement = () => ({ style: {}, select() {}, remove() {} });
  ctx.setTimeout = (fn) => timers.push(fn);
  ctx.clearTimeout = () => {};
  try {
    for (const exec of [() => false, () => { throw new Error("denied"); }]) {
      ctx.document.execCommand = exec;
      card._copy();
      assert.equal(attrs.icon, "mdi:alert");
      timers.at(-1)();
      assert.equal(attrs.icon, "mdi:content-copy");
    }
  } finally {
    delete ctx.navigator;
    delete ctx.document.body;
    delete ctx.document.execCommand;
    ctx.document.createElement = prevCreate;
    delete ctx.setTimeout;
    delete ctx.clearTimeout;
  }
});

// CSS rule of `selector` in the card's stylesheet (first exact match)
function cssRule(html, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[}\\s])${esc}\\s*\\{([^}]*)\\}`).exec(html);
  assert.ok(m, `no CSS rule for ${selector}`);
  return m[1];
}

test("narrow header: the title shrinks with an ellipsis but keeps 4 characters, the copy button never shrinks", () => {
  const html = render({});
  const name = cssRule(html, ".name");
  assert.match(name, /flex: 1 1 auto/);
  assert.match(name, /min-width: 4ch/);
  assert.match(name, /text-overflow: ellipsis/);
  assert.match(name, /white-space: nowrap/);
  assert.match(cssRule(html, "#copy"), /flex: none/);
  assert.match(cssRule(html, ".logo"), /flex: none/);
  assert.match(cssRule(html, ".badge"), /flex: none/);
  // The full title stays available when it is cut
  assert.match(html, /<span class="name" title="Send money">Send money<\/span>/);
});

test("the copy button and the QR have hover and keyboard focus states", () => {
  const html = render({});
  const copy = cssRule(html, "#copy");
  assert.match(copy, /width: 24px/);
  assert.match(copy, /height: 24px/);
  assert.match(copy, /border-radius: 50%/);
  assert.match(cssRule(html, "#copy:hover"), /background: color-mix\(in srgb, var\(--secondary-text-color\) 16%, transparent\)/);
  assert.match(
    html,
    /#copy:focus-visible, \.qr-wrap:focus-visible \{[^}]*outline: 2px solid var\(--primary-color\);[^}]*outline-offset: 2px/,
  );
});

// Shadow root stub whose elements keep their attributes and text, one set per render
function trackElements(card) {
  const els = {};
  card.shadowRoot.getElementById = (id) => {
    els[id] ??= {
      attrs: {},
      textContent: "",
      setAttribute(k, v) {
        this.attrs[k] = v;
      },
    };
    return els[id];
  };
  return els;
}

test("the copy result is announced to screen readers, then cleared", async () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj", language: "fr" });
  assert.match(card.shadowRoot.innerHTML, /<span class="sr" id="live" aria-live="polite"><\/span>/);
  const els = trackElements(card);
  const timers = [];
  ctx.navigator = { clipboard: { writeText: () => Promise.resolve() } };
  ctx.isSecureContext = true;
  ctx.setTimeout = (fn) => timers.push(fn);
  ctx.clearTimeout = () => {};
  ctx.document.body = { appendChild() {} };
  const prevCreate = ctx.document.createElement;
  ctx.document.createElement = () => ({ style: {}, select() {}, remove() {} });
  try {
    card._copy();
    await Promise.resolve();
    assert.equal(els.ico.attrs.icon, "mdi:check");
    assert.equal(els.live.textContent, "Lien copié");
    timers.at(-1)();
    assert.equal(els.ico.attrs.icon, "mdi:content-copy");
    assert.equal(els.live.textContent, "");
    // Refused by the browser: the failure is announced
    ctx.navigator = {};
    ctx.document.execCommand = () => false;
    card._copy();
    assert.equal(els.live.textContent, "Impossible de copier le lien");
    card.disconnectedCallback();
    assert.equal(els.live.textContent, "");
  } finally {
    delete ctx.navigator;
    delete ctx.isSecureContext;
    delete ctx.setTimeout;
    delete ctx.clearTimeout;
    delete ctx.document.body;
    delete ctx.document.execCommand;
    ctx.document.createElement = prevCreate;
  }
});

test("the screen-reader messages exist in every language", () => {
  for (const lang of ["en", ...LANGS]) {
    for (const key of ["copied", "copy_failed"]) {
      assert.ok(ctx.WeroI18n[lang][key], `${lang}.${key}`);
      assert.notEqual(ctx.WeroI18n[lang][key], ctx.WeroI18n[lang].copy, `${lang}.${key}`);
    }
  }
  assert.match(render({}), /\.sr \{[^}]*position: absolute;[^}]*clip: rect\(0 0 0 0\)/);
});

test("a re-render keeps the keyboard focus on the copy button or the QR, without scrolling", () => {
  for (const id of ["copy", "qr"]) {
    const card = new WeroCard();
    card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
    const focused = [];
    card.shadowRoot.activeElement = { id };
    card.shadowRoot.getElementById = (i) => ({ id: i, focus: (opts) => focused.push(JSON.stringify([i, opts])) });
    card._render();
    // preventScroll: giving the focus back must not scroll the dashboard to the card
    assert.deepEqual(focused, [JSON.stringify([id, { preventScroll: true }])], id);
  }
  // Nothing focused in the card: the re-render does not steal the focus
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  const focused = [];
  card.shadowRoot.activeElement = null;
  card.shadowRoot.getElementById = (i) => ({ id: i, focus: () => focused.push(i) });
  card._render();
  assert.deepEqual(focused, []);
});

// ── wero-mini-card ───────────────────────────────────────────────────────────
const WeroMiniCard = ctx.customElements.get("wero-mini-card");
const URL_ = "https://share.weropay.eu/p/1/c/AbCdEfGhIj";

function mini(config = {}) {
  const card = new WeroMiniCard();
  const attrs = {};
  card.setAttribute = (k, v) => (attrs[k] = v);
  card.setConfig({ url: URL_, name: "Alex", ...config });
  card.attrs = attrs;
  return card;
}

// Persistent elements by id, so that the handlers set by a render can be called
function keepElements(card) {
  const els = {};
  card.shadowRoot.getElementById = (id) => (els[id] ??= { id, focus() {} });
  return els;
}

test("mini card: one compact row with the logo, title, payee, a QR thumbnail and the detail button", () => {
  const card = mini();
  const html = card.shadowRoot.innerHTML;
  assert.equal(card.attrs.mini, "");
  assert.match(html, /<ha-card class="mini">/);
  assert.match(html, /<img class="logo"/);
  assert.match(html, /<div class="txt"><span class="name" title="Send money">Send money<\/span><span class="sub" title="Alex">Alex<\/span><\/div>/);
  // The thumbnail opens the full screen QR, like the big one: its label says so
  assert.match(html, /<div class="qr-wrap thumb" id="qr" role="button" tabindex="0" title="Enlarge QR code" aria-label="Enlarge QR code">/);
  assert.match(html, /<button id="copy"/);
  assert.match(html, /<button class="zoom" title="Show the full card" aria-label="Show the full card"><ha-icon icon="mdi:arrow-expand">/);
  // No big QR, no payee row and no hint in the compact view; the full screen QR's dialog is there
  assert.match(html, /<dialog id="zoom" aria-label="Enlarge QR code"><\/dialog>/);
  assert.doesNotMatch(html, /class="info-row"|class="hint"/);
  // Without a payee: the title alone
  assert.doesNotMatch(mini({ name: "" }).shadowRoot.innerHTML, /class="sub"/);
  // A configured qr_size does not enlarge the thumbnail
  assert.doesNotMatch(mini({ qr_size: 300 }).shadowRoot.innerHTML, /--wero-qr-size:/);
});

test("mini card: the detail button switches to the full card and back, keyboard use keeps its focus", () => {
  const card = mini();
  const focused = [];
  card.shadowRoot.querySelector = (sel) => (sel === ".zoom" ? { focus: (o) => focused.push(o) } : null);
  let stopped = 0;
  card._zoomClick({ detail: 1, stopPropagation: () => stopped++ });
  let html = card.shadowRoot.innerHTML;
  assert.equal(stopped, 1);
  assert.match(html, /<ha-card>/);
  assert.match(html, /<div class="qr-wrap" id="qr"[^>]*title="Enlarge QR code"/);
  assert.match(html, /<dialog id="zoom"/);
  assert.match(html, /<div class="val">Alex<\/div>/);
  assert.match(html, /<\/button><button class="zoom" title="Back to the compact view" aria-label="Back to the compact view"><ha-icon icon="mdi:arrow-collapse">/);
  assert.deepEqual(focused, [], "a mouse click does not move the focus");
  card._zoomClick({ detail: 0, stopPropagation() {} });
  html = card.shadowRoot.innerHTML;
  assert.match(html, /<ha-card class="mini">/);
  assert.deepEqual(focused.map((o) => ({ ...o })), [{ preventScroll: true }]);
});

test("mini card: the QR thumbnail (click, Enter or Space) opens the full screen QR directly, the card stays compact", () => {
  for (const act of ["click", "Enter", " "]) {
    const card = mini();
    const els = keepElements(card);
    let shown = 0;
    els.zoom = { id: "zoom", open: false, firstChild: null, appendChild(n) { this.firstChild = n; }, showModal() { shown++; this.open = true; }, close() {} };
    els.qr = { id: "qr", firstElementChild: { cloneNode: () => ({ svg: true }) } };
    card._render();
    let prevented = false;
    if (act === "click") els.qr.onclick();
    else els.qr.onkeydown({ key: act, preventDefault: () => (prevented = true) });
    assert.equal(shown, 1, act);
    assert.deepEqual({ ...els.zoom.firstChild }, { svg: true }, act);
    assert.equal(card._zoomed, false, act);
    assert.equal(prevented, act !== "click", act);
  }
});

test("mini card: zoom: false removes the detail button", () => {
  const card = mini({ zoom: false });
  assert.doesNotMatch(card.shadowRoot.innerHTML, /class="zoom"/);
  card._setZoom(true);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /class="zoom"/);
  // The full card never has one
  assert.doesNotMatch(render({ zoom: true }), /class="zoom"/);
});

test("mini card: grid options and card size, compact then zoomed", () => {
  const card = mini();
  assert.deepEqual({ ...card.getGridOptions() }, { columns: 6, min_columns: 6 });
  assert.equal(card.getCardSize(), 2);
  card._setZoom(true);
  assert.deepEqual({ ...card.getGridOptions() }, { ...new WeroCard().getGridOptions() });
  assert.equal(card.getCardSize(), new WeroCard().getCardSize());
});

test("mini card: a click outside the card brings the compact view back, not one inside it or in a dialog", () => {
  const listeners = [];
  ctx.document.addEventListener = (type, fn, capture) => listeners.push({ type, fn, capture });
  ctx.document.removeEventListener = (type, fn, capture) => {
    const i = listeners.findIndex((l) => l.type === type && l.fn === fn && l.capture === capture);
    if (i >= 0) listeners.splice(i, 1);
  };
  ctx.clearTimeout = () => {};
  try {
    const card = mini();
    card.connectedCallback();
    assert.equal(listeners.length, 1);
    assert.equal(listeners[0].type, "click");
    assert.equal(listeners[0].capture, true);
    const click = (path) => listeners[0].fn({ composedPath: () => path });
    card._setZoom(true);
    click([{ localName: "button" }, card, { localName: "body" }]);
    assert.equal(card._zoomed, true, "a click inside the card");
    click([{ localName: "div" }, { localName: "ha-more-info-dialog" }, { localName: "body" }]);
    assert.equal(card._zoomed, true, "a click in a more-info dialog");
    click([{ localName: "div" }, { localName: "body" }]);
    assert.equal(card._zoomed, false, "a click elsewhere");
    assert.match(card.shadowRoot.innerHTML, /<ha-card class="mini">/);
    trackElements(card);
    card.disconnectedCallback();
    assert.equal(listeners.length, 0);
  } finally {
    delete ctx.document.addEventListener;
    delete ctx.document.removeEventListener;
    delete ctx.clearTimeout;
  }
});

test("mini card styles: only its ha-card is a size container; the narrow layout shrinks the QR and hides copy", () => {
  const html = mini().shadowRoot.innerHTML;
  assert.match(cssRule(html, "ha-card.mini"), /container-type: inline-size/);
  assert.equal([...html.matchAll(/container-type/g)].length, 1);
  assert.match(cssRule(html, ":host([mini])"), /display: block; min-width: 0/);
  assert.match(cssRule(html, ":host([mini])::before"), /grid-template-columns: minmax\(0, 240px\); height: 0/);
  const zoom = cssRule(html, ".zoom");
  assert.match(zoom, /all: unset/);
  assert.match(zoom, /width: 24px; height: 24px/);
  assert.match(zoom, /border-radius: 50%/);
  assert.match(zoom, /color: var\(--secondary-text-color\)/);
  assert.match(cssRule(html, ".qr-wrap.thumb svg"), /width: 64px/);
  const narrow = /@container \(max-width: 200px\) \{([\s\S]*?)\n {8}\}/.exec(html)[1];
  assert.match(narrow, /\.qr-wrap\.thumb svg \{ width: 48px; \}/);
  assert.match(narrow, /ha-card\.mini #copy \{ display: none; \}/);
  assert.match(cssRule(html, ".sub"), /text-overflow: ellipsis/);
  // The header's logo tile keeps the full card's 40 px: no mini rule resizes it
  assert.doesNotMatch(html, /ha-card\.mini \.(logo|badge)/);
  assert.match(cssRule(html, ".logo"), /width: 40px; height: 40px/);
  // The full card is never a size container
  assert.match(render({}), /<ha-card>/);
});

test("editor: the detail button toggle only in the mini card's editor, true dropped from the YAML", async () => {
  ctx.customElements.define("ha-form", {});
  const prevCreate = ctx.document.createElement;
  ctx.document.createElement = () => ({ addEventListener() {} });
  try {
    const names = async (tag) => {
      const editor = new (ctx.customElements.get(tag))();
      editor.appendChild = () => {};
      editor.dispatchEvent = () => {};
      editor.setConfig({ url: URL_ });
      await new Promise((r) => setImmediate(r));
      return { editor, names: Array.from(editor._form.schema, (f) => f.name) };
    };
    const full = await names("wero-card-editor");
    assert.ok(!full.names.includes("zoom"));
    assert.equal(full.editor._form.data.zoom, undefined);
    const m = await names("wero-mini-card-editor");
    assert.deepEqual(m.names, ["url", "title", "name", "logo", "zoom", "qr_size", "language"]);
    assert.equal(m.editor._form.data.zoom, true);
    assert.equal(m.editor._form.computeLabel({ name: "zoom" }), "Detail button");
    m.editor._valueChanged({ detail: { value: { url: URL_, zoom: true } } });
    assert.equal(m.editor._config.zoom, undefined);
    m.editor._valueChanged({ detail: { value: { url: URL_, zoom: false } } });
    assert.equal(m.editor._config.zoom, false);
    assert.equal(ctx.customElements.get("wero-mini-card").getConfigElement, WeroMiniCard.getConfigElement);
  } finally {
    ctx.document.createElement = prevCreate;
  }
});

test("mini card i18n: new strings in every language, and a translated picker entry", () => {
  const i18n = ctx.WeroI18n;
  for (const lang of ["en", ...LANGS]) {
    for (const key of ["zoom_in", "zoom_out", "ed_zoom", "mini_name", "mini_desc"]) {
      assert.ok(i18n[lang][key]?.trim(), `${lang}.${key}`);
      if (lang !== "en") assert.notEqual(i18n[lang][key], i18n.en[key], `${lang}.${key} untranslated`);
    }
    assert.notEqual(i18n[lang].zoom_in, i18n[lang].zoom_out, lang);
  }
  assert.equal(i18n.en.zoom_in, "Show the full card");
  assert.equal(i18n.en.zoom_out, "Back to the compact view");
  assert.equal(i18n.en.ed_zoom, "Detail button");
  const entry = ctx.customCards.find((c) => c.type === "wero-mini-card");
  assert.equal(entry.name, i18n.en.mini_name);
  assert.equal(entry.description, i18n.en.mini_desc);
  assert.equal(entry.preview, true);
  // The mini card follows the language like the full card
  const card = mini();
  card.hass = { language: "fr" };
  assert.match(card.shadowRoot.innerHTML, /title="Afficher la carte complète"/);
});
