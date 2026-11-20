// Round-trip tests for the embedded QR encoder: build the QR with the card's own code, decode it
// with jsQR and compare the payload; plus the qr_size option. Run with: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import jsQR from "jsqr";

// Evaluates src/wero-card.js with just enough browser stubs to reach its functions and classes.
function loadCard(lang = "en") {
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
    document: { documentElement: { lang }, createElement: () => ({}) },
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

// The classic header (illustration: false) unless the test asks for the illustrated one
function render(config) {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj", illustration: false, ...config });
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
  assert.equal(entry.name, "Wero QR Card");
  assert.equal(entry.description, "Wero QR code, no CDN");
});

test("main card picker entry follows the page language", () => {
  const fr = loadCard("fr").ctx.customCards;
  const main = fr.find((c) => c.type === "wero-card");
  assert.equal(main.name, "Carte QR Wero");
  assert.equal(main.description, "QR code Wero, sans CDN");
  assert.equal(fr.find((c) => c.type === "wero-mini-card").name, "Mini-carte QR Wero");
  // An untranslated page language falls back to English
  assert.equal(loadCard("ja").ctx.customCards.find((c) => c.type === "wero-card").name, "Wero QR Card");
});

test("QR image label is translated and follows a language change", () => {
  const i18n = ctx.WeroI18n;
  for (const lang of ["en", ...LANGS]) {
    for (const key of ["qr_code", "card_name", "card_desc"]) {
      assert.ok(i18n[lang][key]?.trim(), `${lang}.${key}`);
      if (lang !== "en") assert.notEqual(i18n[lang][key], i18n.en[key], `${lang}.${key} untranslated`);
    }
  }
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  assert.match(card.shadowRoot.innerHTML, /<svg aria-hidden="true" [^>]*role="img" aria-label="Wero QR code">/);
  card.hass = { language: "de" };
  assert.match(card.shadowRoot.innerHTML, /role="img" aria-label="Wero-QR-Code">/);
  assert.doesNotMatch(card.shadowRoot.innerHTML, /aria-label="QR code"/);
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
  // Inside the role=button wrapper the SVG is hidden from screen readers: the button's label speaks for it
  assert.match(html, /<div class="qr-wrap" id="qr" role="button"[^>]*><svg aria-hidden="true" [^>]*role="img"/);
});

test("the full screen QR dialog draws no focus ring, in the card and the mini card", () => {
  // showModal() focuses the dialog: the browser's focus ring would frame the yellow QR code
  for (const html of [render({}), new (ctx.customElements.get("wero-mini-card"))()].map((x) => {
    if (typeof x === "string") return x;
    x.setAttribute = () => {};
    x.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
    return x.shadowRoot.innerHTML;
  })) {
    assert.match(html, /dialog:focus, dialog:focus-visible \{ outline: none; \}/);
  }
});

test("a re-render keeps an open zoom dialog open, and reopens a replaced one", () => {
  const card = new WeroCard();
  card.setConfig({ url: "https://share.weropay.eu/p/1/c/AbCdEfGhIj" });
  const calls = [];
  const dialog = (name) => {
    const d = {
      open: true,
      firstChild: {},
      close: () => {
        d.open = false;
        calls.push(`close ${name}`);
      },
      showModal: () => {
        d.open = true;
        calls.push(`showModal ${name}`);
      },
    };
    return d;
  };
  // Patched in place: the same dialog stays open, nothing closes or reopens it
  const same = dialog("same");
  card.shadowRoot.getElementById = (id) => (id === "zoom" ? same : {});
  card._render();
  assert.deepEqual(calls, []);
  assert.equal(same.open, true);
  // Replaced: the old one is closed, the new one opened
  const before = dialog("old");
  const after = Object.assign(dialog("new"), { open: false });
  let rendered = false;
  card.shadowRoot.getElementById = (id) => (id === "zoom" ? (rendered ? after : before) : {});
  Object.defineProperty(card.shadowRoot, "innerHTML", { configurable: true, set() { rendered = true; }, get() { return ""; } });
  card._render();
  assert.deepEqual(calls, ["close old", "showModal new"]);
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
    // A replaced node loses the focus (a node patched in place keeps it, and is not focused again)
    Object.defineProperty(card.shadowRoot, "innerHTML", { configurable: true, set() { card.shadowRoot.activeElement = null; }, get() { return ""; } });
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
  card.setConfig({ url: URL_, name: "Alex", illustration: false, ...config });
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
  assert.match(html, /<div class="txt"><div class="trow"><span class="name" title="Send money">Send money<\/span><span class="chip" style="--c:var\(--primary-color, #03a9f4\)" title="Ready" aria-label="Ready"><span class="dot"><\/span><span class="ptxt">Ready<\/span><\/span><\/div><span class="sub" title="Alex">Alex<\/span><\/div>/);
  // The thumbnail opens the full screen QR, like the big one: its label says so
  assert.match(html, /<div class="qr-wrap thumb" id="qr" role="button" tabindex="0" title="Enlarge QR code" aria-label="Enlarge QR code"><svg aria-hidden="true" /);
  // The thumbnail, then the copy button at the left of the detail button, both on its top line
  assert.match(html, /<\/svg><\/div>\s*<button id="copy" title="Copy link" aria-label="Copy link"><ha-icon icon="mdi:content-copy" id="ico"><\/ha-icon><\/button><button class="zoom" title="Show the full card" aria-label="Show the full card"><ha-icon icon="mdi:arrow-expand"><\/ha-icon><\/button>/);
  assert.match(html, /<span class="sr" id="live" aria-live="polite"><\/span>/);
  assert.match(cssRule(html, "ha-card.mini .header > #copy"), /align-self: flex-start/);
  assert.doesNotMatch(html, /class="side"/);
  // Without the detail button, the copy button ends the row
  assert.match(mini({ zoom: false }).shadowRoot.innerHTML, /<\/svg><\/div>\s*<button id="copy"[\s\S]*?<\/button>\s*<\/div>/);
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
  // The full view keeps the copy button in the header row, before the detail button
  assert.doesNotMatch(html, /class="side"/);
  assert.match(html, /<button id="copy"[^>]*><ha-icon icon="mdi:content-copy" id="ico"><\/ha-icon><\/button><button class="zoom" title="Back to the compact view" aria-label="Back to the compact view"><ha-icon icon="mdi:arrow-collapse">/);
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
    const removed = [];
    els.qr = { id: "qr", firstElementChild: { cloneNode: () => ({ svg: true, removeAttribute: (a) => removed.push(a) }) } };
    card._render();
    let prevented = false;
    if (act === "click") els.qr.onclick();
    else els.qr.onkeydown({ key: act, preventDefault: () => (prevented = true) });
    assert.equal(shown, 1, act);
    assert.equal(els.zoom.firstChild.svg, true, act);
    // The full screen copy is an image again, not hidden like the button's QR
    assert.deepEqual(removed, ["aria-hidden"], act);
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
    assert.deepEqual(m.names, ["url", "title", "name", "entity", "show_title", "logo", "zoom", "illustration", "illustration_theme", "qr_size", "language"]);
    assert.equal(m.editor._form.data.zoom, true);
    // The illustration options, with their defaults shown and dropped from the YAML
    assert.equal(m.editor._form.data.illustration, true);
    assert.equal(m.editor._form.data.illustration_theme, "auto");
    const theme = m.editor._form.schema.find((f) => f.name === "illustration_theme");
    assert.deepEqual(Array.from(theme.selector.select.options, (o) => o.label), ["Automatic (follows the theme)", "Day", "Night"]);
    m.editor._valueChanged({ detail: { value: { url: URL_, illustration: true, illustration_theme: "auto" } } });
    assert.equal(m.editor._config.illustration, undefined);
    assert.equal(m.editor._config.illustration_theme, undefined);
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

test("editor: the language choice starts with Automatic (no language in the YAML), in the editor's language", async () => {
  if (!ctx.customElements.get("ha-form")) ctx.customElements.define("ha-form", {});
  const prevCreate = ctx.document.createElement;
  ctx.document.createElement = () => ({ addEventListener() {} });
  try {
    for (const tag of ["wero-card-editor", "wero-mini-card-editor"]) {
      const editor = new (ctx.customElements.get(tag))();
      editor.appendChild = () => {};
      editor.dispatchEvent = () => {};
      editor.setConfig({ url: URL_ });
      await new Promise((r) => setImmediate(r));
      const options = (ed) => Array.from(ed._form.schema.find((f) => f.name === "language").selector.select.options);
      assert.deepEqual({ ...options(editor)[0] }, { value: "", label: "Automatic" });
      assert.equal(options(editor).length, Object.keys(ctx.WeroI18n).length + 1);
      editor.hass = { language: "fr" };
      assert.deepEqual({ ...options(editor)[0] }, { value: "", label: "Automatique" });
      editor._valueChanged({ detail: { value: { url: URL_, language: "de" } } });
      assert.equal(editor._config.language, "de");
      editor._valueChanged({ detail: { value: { url: URL_, language: "" } } });
      assert.equal(editor._config.language, undefined);
    }
    // The shared schema itself is left untouched
    assert.ok(!ctx.WERO_EDITOR_SCHEMA.find((f) => f.name === "language").selector.select.options.some((o) => o.value === ""));
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

// ── illustrated header ───────────────────────────────────────────────────────
const ill = (config = {}, hass) => {
  const card = new WeroCard();
  card.setConfig({ url: URL_, ...config });
  if (hass) card.hass = { language: "en", ...hass };
  return card;
};
const banner = (html) => /<div class="banner ([^"]*)" style="--wc-st:([^"]*)"/.exec(html);

test("illustrated header: by default, 90 px, the QR icon, the scene, the Wero-yellow strip and the logo on the counter", () => {
  const html = ill().shadowRoot.innerHTML;
  assert.match(html, /<ha-card data-ill>/);
  assert.match(cssRule(html, ".banner"), /height: 90px/);
  assert.match(cssRule(html, ".wc-ground"), /height: 10px/);
  assert.match(html, /<div class="hicon"><ha-icon icon="mdi:qrcode"><\/ha-icon><img class="hbrand" src="data:image\/svg\+xml;base64,[^"]*" alt=""><\/div>/);
  assert.match(ill({ logo: false }).shadowRoot.innerHTML, /<div class="hicon"><ha-icon icon="mdi:qrcode"><\/ha-icon><\/div>/);
  assert.match(html, /<svg class="wc-scene" viewBox="0 0 200 80"/);
  assert.match(html, /<image class="wc-logo" href="data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(ill({ logo: false }).shadowRoot.innerHTML, /class="wc-logo"/);
  assert.match(html, /prefers-reduced-motion: reduce/);
  // No entity: ready, the primary colour, the payee (or Wero) under the title
  assert.deepEqual(banner(html).slice(1), ["st-ready", "var(--primary-color, #03a9f4)"]);
  assert.match(ill({ name: "Alex" }).shadowRoot.innerHTML, /<span class="hsub" title="Alex">Alex<\/span>/);
  assert.match(html, /<span class="hsub" title="Wero">Wero<\/span>/);
  // illustration: false keeps the classic header
  assert.doesNotMatch(render({}), /class="banner/);
});

test("illustrated header: the payment status drives the picture, the icon colour and the status pill", () => {
  const e = "input_boolean.paid";
  const st = (state) => ill({ entity: e, name: "Alex" }, { states: state === undefined ? {} : { [e]: { state } } }).shadowRoot.innerHTML;
  const pill = (html) => /<span class="chip" style="--c:([^"]+)" title="([^"]+)" aria-label="[^"]+"><span class="dot"><\/span><span class="ptxt">([^<]+)<\/span><\/span>/.exec(html).slice(1);
  assert.deepEqual(banner(st("off")).slice(1), ["st-waiting", "var(--primary-color, #03a9f4)"]);
  assert.deepEqual(pill(st("off")), ["var(--primary-color, #03a9f4)", "Waiting", "Waiting"]);
  // The pill on the title row, the payee under it (the status is not repeated in the subtitle)
  assert.match(st("off"), /<div class="hrow"><span class="hname" title="Send money">Send money<\/span><span class="chip"[\s\S]*?<\/div><span class="hsub" title="Alex">Alex<\/span>/);
  for (const v of ["on", "received", "paid"]) {
    assert.deepEqual(banner(st(v)).slice(1), ["st-received", "var(--success-color, #43a047)"], v);
    assert.deepEqual(pill(st(v)), ["var(--success-color, #43a047)", "Received", "Received"], v);
  }
  assert.deepEqual(pill(st("unavailable")), ["var(--disabled-text-color, #9e9e9e)", "Unavailable", "Unavailable"]);
  assert.deepEqual(pill(ill({}).shadowRoot.innerHTML), ["var(--primary-color, #03a9f4)", "Ready", "Ready"]);
  // The pill's place is measured (weroPlacePill): data-wrap puts it on its own line under the subtitle, data-dot and a
  // card of 200 px or less keep its dot alone; no width tier moves it. Banner pill colours as on the sky
  const html = st("on");
  assert.doesNotMatch(html, /@container \(max-width: 260px\)/);
  assert.match(cssRule(html, ".banner[data-wrap] .hrow"), /display: contents/);
  assert.match(cssRule(html, ".banner[data-wrap] .htitles .chip"), /order: 3;/);
  assert.match(cssRule(html, "[data-dot] .chip .ptxt"), /position: absolute;/);
  assert.match(html, /@container \(max-width: 200px\) \{[^\n]*\.htitles \.chip \.ptxt \{ position: absolute;/);
  assert.match(cssRule(html, ".banner .chip"), /^ background: color-mix\(in srgb, var\(--c\) 18%, rgba\(255,255,255,\.78\)\)/);
  assert.match(cssRule(html, ".banner.night .chip"), /color-mix\(in srgb, var\(--c\) 35%, #ffffff\)/);
  assert.match(cssRule(html, ".hname"), /min-width: 0/);
  for (const v of ["unavailable", "unknown", undefined]) assert.equal(banner(st(v))[1], "st-off", String(v));
  assert.equal(banner(st("unavailable"))[2], "var(--disabled-text-color, #9e9e9e)");
  // The classic header's icon follows the status too
  const classic = ill({ entity: e, illustration: false, logo: false }, { states: { [e]: { state: "on" } } }).shadowRoot.innerHTML;
  assert.match(classic, /<div class="badge" style="--c:var\(--success-color, #43a047\)">/);
});

test("illustrated header: night from illustration_theme, else the dark theme alone", () => {
  const night = (config, hass) => banner(ill(config, hass).shadowRoot.innerHTML)[1].includes("night");
  const up = (dark) => ({ states: { "sun.sun": { state: "above_horizon" } }, themes: { darkMode: dark } });
  assert.equal(night({}, { states: { "sun.sun": { state: "below_horizon" } } }), false, "light theme after sunset: day");
  assert.equal(night({}, { states: { "sun.sun": { state: "below_horizon" } }, themes: { darkMode: true } }), true, "dark theme after sunset: night");
  assert.equal(night({}, up(true)), true, "dark theme while the sun is up: night");
  assert.equal(night({}, up(false)), false, "light theme while the sun is up: day");
  assert.equal(night({ illustration_theme: "day" }, up(true)), false, "forced day wins over the dark theme");
  assert.equal(night({ illustration_theme: "night" }, up(false)), true, "forced night wins over the light theme");
  assert.equal(night({}, { states: {}, themes: { darkMode: true } }), true);
  assert.equal(night({ illustration_theme: "day" }, { states: { "sun.sun": { state: "below_horizon" } } }), false);
  assert.equal(night({ illustration_theme: "night" }, { states: {} }), true);
});

test("illustrated header: hass re-renders only when the status or day / night changes; ids are unique per card", () => {
  const e = "input_boolean.paid";
  const card = ill({ entity: e }, { states: { [e]: { state: "off" } } });
  let renders = 0;
  const r = card._render.bind(card);
  card._render = () => (renders++, r());
  card.hass = { language: "en", states: { [e]: { state: "off" }, "sensor.x": { state: "1" } } };
  assert.equal(renders, 0);
  card.hass = { language: "en", states: { [e]: { state: "on" } } };
  assert.equal(renders, 1);
  card.hass = { language: "en", states: { [e]: { state: "on" } }, themes: { darkMode: true } };
  assert.equal(renders, 2);
  const a = /id="(wc-glow-\d+)"/.exec(ill().shadowRoot.innerHTML)[1];
  const b = /id="(wc-glow-\d+)"/.exec(ill().shadowRoot.innerHTML)[1];
  assert.notEqual(a, b);
});

test("illustrated mini card: the 90 px banner shows the scannable QR code itself, which opens the full screen QR", () => {
  const card = new WeroMiniCard();
  card.setAttribute = () => {};
  card.setConfig({ url: URL_, name: "Alex" });
  const html = card.shadowRoot.innerHTML;
  assert.match(html, /<ha-card class="mini" data-ill>/);
  // The mini picture (counter and terminal), the plain status icon, then the QR on the counter next to the buttons
  assert.match(html, /<svg class="wc-scene mini" viewBox="0 0 130 80"/);
  assert.match(html, /<div class="htext mini"><div class="hicon"><ha-icon icon="mdi:qrcode">/);
  assert.match(html, /<div class="qr-wrap thumb" id="qr" role="button" tabindex="0" title="Enlarge QR code" aria-label="Enlarge QR code"><svg aria-hidden="true" [^>]*><rect [^>]*fill="#fff48d"\/>/);
  // The buttons in a column in the top right corner (the detail button at the corner), the QR at their left
  assert.match(html, /<\/div><div class="hact"><button id="copy"[\s\S]*?<\/button><button class="zoom"/);
  const hact = cssRule(html, ".hact");
  assert.match(hact, /top: 5px; right: 5px; display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: 4px/);
  assert.match(cssRule(html, ".hact #copy, .hact .zoom"), /width: 24px; height: 24px; border-radius: 50%/);
  assert.match(cssRule(html, ".banner .qr-wrap.thumb"), /right: 36px; top: 12px/);
  // Framed in white (light grey at night) around its own quiet zone, 56 px like the WiFi card's
  assert.match(cssRule(html, ".banner .qr-wrap.thumb svg"), /width: 56px/);
  assert.match(cssRule(html, ".banner .qr-wrap.thumb"), /box-shadow: 0 0 0 2px #fff/);
  assert.match(cssRule(html, ".banner.night .qr-wrap.thumb"), /box-shadow: 0 0 0 2px #e6e6e6/);
  const els = keepElements(card);
  let shown = 0;
  const big = { removed: [], removeAttribute(a) { this.removed.push(a); } };
  els.zoom = { id: "zoom", open: false, firstChild: null, appendChild(n) { this.firstChild = n; }, showModal() { shown++; this.open = true; }, close() {} };
  els.qr = { id: "qr", firstElementChild: { cloneNode: () => big } };
  card._render();
  els.qr.onclick();
  assert.equal(shown, 1);
  assert.equal(els.zoom.firstChild, big);
  assert.deepEqual(big.removed, ["aria-hidden"]);
});

// A stub of the header for weroPlacePill: widths in px (the title's whole text, the pill, the row), the text block's
// bottom and the ground strip's top, the label cut or not once on its own line.
function placed({ title, pill, row, cut = false, bottom = 60, ground = 80, card = 400 }) {
  const attrs = new Set();
  const rect = (o) => ({ getBoundingClientRect: () => ({ top: 0, bottom: 0, width: 0, ...o }) });
  const text = { ...rect({ width: pill - 20 }), get scrollWidth() { return cut && attrs.has("data-wrap") ? 100 : 50; }, clientWidth: 50 };
  const chip = { ...rect({ width: pill }), querySelector: () => text };
  const name = { ...rect({ width: Math.min(title, row - pill) }), textContent: "Title", scrollWidth: title, clientWidth: Math.min(title, row - pill) };
  const head = {
    ...rect({ top: 0 }),
    setAttribute: (a) => attrs.add(a),
    removeAttribute: (a) => attrs.delete(a),
    closest: () => rect({ width: card }),
    querySelector: () => ({ getBoundingClientRect: () => ({ top: 10, bottom: attrs.has("data-wrap") ? bottom : 40 }) }),
  };
  const rowEl = { ...rect({ width: row }), querySelector: (s) => (s.includes("chip") ? chip : name) };
  ctx.getComputedStyle = () => ({ columnGap: "8px" });
  ctx.weroPlacePill(head, rowEl, ground == null ? null : rect({ top: ground }));
  return [...attrs].sort().join(" ");
}

test("status pill place: beside the whole title, else under the subtitle, else its dot alone", () => {
  // Whole title (100) + gap (8) + whole pill (60) fit a 200 px row: on the title row
  assert.equal(placed({ title: 100, pill: 60, row: 200 }), "");
  // One pixel short: on its own line, whatever the language's label length
  assert.equal(placed({ title: 133, pill: 60, row: 200 }), "data-wrap");
  // On its own line its label is still cut: the dot alone, back on the title row
  assert.equal(placed({ title: 300, pill: 60, row: 200, cut: true }), "data-dot");
  // On its own line the text block runs over the ground strip: the dot alone
  assert.equal(placed({ title: 300, pill: 60, row: 200, bottom: 85, ground: 80 }), "data-dot");
  // The classic header (no ground strip) keeps it on its own line
  assert.equal(placed({ title: 300, pill: 60, row: 200, bottom: 85, ground: null }), "data-wrap");
  // A card of 200 px or less: the dot alone
  assert.equal(placed({ title: 50, pill: 60, row: 180, card: 190 }), "data-dot");
});

// ── DOM patching (layout shift): a redraw keeps the nodes on the page ───────────────────────────────────────────
// A tiny DOM, enough for the patch helper: elements with attributes and children, and text nodes.
class FakeNode {
  constructor(type, name, value = null) {
    this.nodeType = type;
    this.nodeName = name.toUpperCase();
    this.localName = name.toLowerCase();
    this.nodeValue = value;
    this.childNodes = [];
    this.parentNode = null;
    this.attrs = new Map();
  }
  get attributes() {
    return [...this.attrs].map(([name, value]) => ({ name, value, namespaceURI: null }));
  }
  hasAttribute(n) {
    return this.attrs.has(n);
  }
  getAttribute(n) {
    return this.attrs.has(n) ? this.attrs.get(n) : null;
  }
  setAttribute(n, v) {
    this.attrs.set(n, String(v));
  }
  removeAttribute(n) {
    this.attrs.delete(n);
  }
  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }
  insertBefore(n, ref) {
    if (n.parentNode) n.parentNode.removeChild(n);
    const i = ref ? this.childNodes.indexOf(ref) : this.childNodes.length;
    this.childNodes.splice(i, 0, n);
    n.parentNode = this;
    return n;
  }
  removeChild(n) {
    this.childNodes.splice(this.childNodes.indexOf(n), 1);
    n.parentNode = null;
    return n;
  }
  replaceChild(n, o) {
    this.insertBefore(n, o);
    return this.removeChild(o);
  }
  get firstChild() {
    return this.childNodes[0] || null;
  }
}
const fakeEl = (name, attrs = {}, ...kids) => {
  const e = new FakeNode(1, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const k of kids) e.insertBefore(typeof k === "string" ? new FakeNode(3, "#text", k) : k, null);
  return e;
};

test("a redraw patches the card in place: pictures, images and texts keep their nodes", () => {
  const patch = vm.runInContext("weroMorphChildren", ctx);
  const img = fakeEl("img", { src: "logo.svg", alt: "" });
  const svg = fakeEl("svg", { class: "scene" }, fakeEl("path", { d: "M0 0" }));
  const label = fakeEl("span", { class: "t" }, "3 min");
  const root = fakeEl("div", {}, fakeEl("div", { class: "banner st-ok", "data-wrap": "" }, svg, img), label, fakeEl("p", {}, "gone"));
  const next = fakeEl("div", {}, fakeEl("div", { class: "banner st-late" }, fakeEl("svg", { class: "scene" }, fakeEl("path", { d: "M0 0" })), fakeEl("img", { src: "logo.svg", alt: "" })), fakeEl("span", { class: "t" }, "2 min"));
  const banner = root.childNodes[0];
  const text = label.childNodes[0];
  patch(root, next);
  // The same nodes, updated: no picture or image is re-created (they would be laid out again)
  assert.equal(root.childNodes[0], banner);
  assert.equal(banner.childNodes[0], svg);
  assert.equal(banner.childNodes[1], img);
  assert.equal(root.childNodes[1], label);
  assert.equal(label.childNodes[0], text);
  assert.equal(text.nodeValue, "2 min");
  assert.equal(banner.getAttribute("class"), "banner st-late");
  assert.equal(banner.hasAttribute("data-wrap"), false);
  // What the new HTML no longer has is removed
  assert.equal(root.childNodes.length, 2);
});

test("a redraw replaces only the nodes whose element changed, and keeps an open dialog open", () => {
  const patch = vm.runInContext("weroMorphChildren", ctx);
  const dlg = fakeEl("dialog", { id: "zoom", open: "" });
  const keep = fakeEl("div", { class: "a" });
  const root = fakeEl("div", {}, keep, fakeEl("span", {}, "x"), dlg);
  const fresh = fakeEl("button", { class: "b" });
  patch(root, fakeEl("div", {}, fakeEl("div", { class: "a" }), fresh, fakeEl("dialog", { id: "zoom" })));
  assert.deepEqual(root.childNodes.map((n) => n.localName), ["div", "button", "dialog"]);
  assert.equal(root.childNodes[0], keep);
  assert.equal(root.childNodes[1], fresh);
  assert.equal(root.childNodes[2], dlg);
  // `open` belongs to showModal() / close(), not to the HTML
  assert.equal(dlg.hasAttribute("open"), true);
});

test("a redraw keeps what a Home Assistant element drew in itself, and replaces it when its attributes change", () => {
  const patch = vm.runInContext("weroMorphChildren", ctx);
  // <ha-icon> draws its own content (and may style its own node): the redraw leaves it alone
  const icon = fakeEl("ha-icon", { icon: "mdi:refresh", style: "display: inline-flex" }, fakeEl("svg"));
  const root = fakeEl("div", {}, icon);
  patch(root, fakeEl("div", {}, fakeEl("ha-icon", { icon: "mdi:refresh" })));
  assert.equal(root.childNodes[0], icon);
  assert.equal(icon.childNodes.length, 1);
  assert.equal(icon.getAttribute("style"), "display: inline-flex");
  // Another icon: a new element, which draws the new icon
  patch(root, fakeEl("div", {}, fakeEl("ha-icon", { icon: "mdi:check" })));
  assert.notEqual(root.childNodes[0], icon);
  assert.equal(root.childNodes[0].getAttribute("icon"), "mdi:check");
  // An element we fill ourselves (<ha-card>) is patched like any other
  const card = fakeEl("ha-card", { class: "mini" }, fakeEl("div", {}, "a"));
  const host = fakeEl("div", {}, card);
  patch(host, fakeEl("div", {}, fakeEl("ha-card", {}, fakeEl("div", {}, "b"))));
  assert.equal(host.childNodes[0], card);
  assert.equal(card.hasAttribute("class"), false);
  assert.equal(card.childNodes[0].childNodes[0].nodeValue, "b");
});
