// ── wero-card ─────────────────────────────────────────────────────────────────
// Shadow DOM patching: a redraw updates the nodes already on the page (text, attributes, classes) instead of replacing
// them, so that a state update never re-creates the pictures (SVG scenes, logos) nor restarts their animations, and the
// card keeps its height (a re-created card is laid out again, which can move the dashboard under the reader's eyes).
// An open <dialog> keeps its `open` state: it is driven by showModal() / close().
import { QR8bitByte, QRCodeModel, QRErrorCorrectLevel, QRRSBlock, QRUtil } from "./qr-code-engine.js";
import { WERO_LOGO } from "./wero-logo.js";
import { WERO_BANNER_STYLE, WERO_QR_SIZE, WERO_RECEIVED, weroEsc, weroMiniScene, weroPlacePill, weroResolveLang, weroScene } from "./i18n-helpers.js";
import { WeroI18n } from "./i18n/weroi18n.js";

export var weroUid = 0;

export function weroMorphAttrs(cur, next) {
  for (var a of Array.from(cur.attributes)) {
    if (!next.hasAttribute(a.name) && !(a.name === 'open' && cur.localName === 'dialog')) cur.removeAttribute(a.name);
  }
  for (var b of Array.from(next.attributes)) {
    if (cur.getAttribute(b.name) === b.value) continue;
    if (b.namespaceURI) cur.setAttributeNS(b.namespaceURI, b.name, b.value);
    else cur.setAttribute(b.name, b.value);
  }
}

// A Home Assistant element given no content (<ha-icon>…) draws itself: what it adds to its own node is not ours to
// remove. It is kept as long as the attributes the HTML gives it do not change, and replaced when they do.
export function weroMorphOwnDrawn(o, n) {
  if (!n.localName.includes('-') || n.firstChild) return false;
  var key = Array.from(n.attributes, (a) => `${a.name}=${a.value}`).join('\n');
  if (o.__morphKey === undefined && Array.from(n.attributes).every((a) => o.getAttribute(a.name) === a.value)) o.__morphKey = key;
  if (o.__morphKey !== key) {
    n.__morphKey = key;
    o.parentNode.replaceChild(n, o);
  }
  return true;
}

export function weroMorphChildren(cur, next) {
  var old = Array.from(cur.childNodes);
  var fresh = Array.from(next.childNodes);
  fresh.forEach((n, i) => {
    var o = old[i];
    var ref = cur.childNodes[i] || null;
    if (!o || o.nodeType !== n.nodeType || o.nodeName !== n.nodeName) {
      cur.insertBefore(n, ref);
      return;
    }
    if (o !== ref) cur.insertBefore(o, ref);
    if (n.nodeType !== 1) {
      if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
    } else if (!weroMorphOwnDrawn(o, n)) {
      weroMorphAttrs(o, n);
      weroMorphChildren(o, n);
    }
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
}

// Gives `root` (a shadow root or an element) the content of `html`, patching what is already there (a plain
// innerHTML where there is no DOM to patch, as in the unit tests' stubs).
export function weroMorph(root, html) {
  var tpl = root.childNodes && typeof document !== 'undefined' && document.createElement?.('template');
  if (!tpl?.content) {
    root.innerHTML = html;
    return;
  }
  tpl.innerHTML = html;
  weroMorphChildren(root, tpl.content);
}

export class WeroCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('wero-card-editor');
  }

  static getStubConfig() {
    return { url: 'https://share.weropay.eu/p/1/c/XXXXXXXXXX' };
  }

  setConfig(config) {
    var url = config && typeof config.url === 'string' ? config.url.trim() : '';
    if (!/^https:\/\/\S+$/.test(url)) {
      throw new Error('url is required: the https link encoded in your Wero QR code');
    }
    this._configRaw = Object.assign({}, config, { url: url });
    if (!this._uid) this._uid = ++weroUid;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._applyConfig();
  }

  set hass(hass) {
    // Re-render only when the language actually used changes (not on every raw
    // hass.language change: a forced `language`, or "fr" -> "fr-FR", shows nothing new),
    // or when the header's picture changes (payment status, day / night)
    var prevLang = this._configRaw ? this._getLang() : null;
    this._hassLang = hass?.language ? hass.language : null;
    this._hass = hass;
    if (!this._configRaw) return;
    if (prevLang !== this._getLang()) this._applyConfig();
    else if (this._sig !== this._picSig()) this._render();
  }

  // Payment status shown by the header: `ready` without an entity, else `waiting`, `received` or `off`
  // (unavailable, unknown or missing entity)
  _status() {
    var id = this._configRaw.entity;
    if (!id) return 'ready';
    if (!this._hass?.states) return 'waiting';
    var s = this._hass.states[id];
    var v = s ? String(s.state).toLowerCase() : 'unavailable';
    if (v === 'unavailable' || v === 'unknown') return 'off';
    return WERO_RECEIVED.includes(v) ? 'received' : 'waiting';
  }

  // Night picture: forced by illustration_theme, else Home Assistant's dark theme alone (a light theme keeps the day
  // picture after sunset)
  _isNight() {
    var theme = this._configRaw.illustration_theme;
    if (theme === 'night') return true;
    if (theme === 'day') return false;
    return !!this._hass?.themes?.darkMode;
  }

  _picSig() {
    return `${this._status()}|${this._isNight()}`;
  }

  _getLang() {
    return weroResolveLang((this._configRaw?.language) || this._hassLang || document.documentElement.lang || 'en');
  }

  _t(key) {
    var strings = WeroI18n[this._getLang()];
    return strings[key] || WeroI18n.en[key] || key;
  }

  _applyConfig() {
    var config = this._configRaw;
    this._config = {
      url: config.url,
      name: config.name || '',
      title: config.title || this._t('default_title'),
      logo: config.logo !== false,
      show_title: config.show_title !== false,
      // Displayed size in px; unset or not a positive number keeps the default
      // 176 px from the stylesheet
      qr_size: Number(config.qr_size) > 0 ? Number(config.qr_size) : null,
      // The illustrated header (a shop counter with its payment terminal); false keeps the classic header
      illustration: config.illustration !== false,
    };
    this._render();
  }

  _buildQrSvg(text, size) {
    // Smallest version whose data capacity (RS block table) fits the byte-mode
    // payload: 4 mode bits + the length field + the payload itself
    var bytes = new QR8bitByte(text).getLength();
    var type = 0;
    for (var t = 1; t <= 40 && !type; t++) {
      var blocks = QRRSBlock.getRSBlocks(t, QRErrorCorrectLevel.M);
      var capacity = 0;
      for (var b = 0; b < blocks.length; b++) capacity += blocks[b].dataCount;
      if (4 + QRUtil.getLengthInBits(4, t) + bytes * 8 <= capacity * 8) type = t;
    }
    if (!type) throw new Error('url is too long for a QR code');
    var qr = new QRCodeModel(type, QRErrorCorrectLevel.M);
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount();
    var quiet = 4; // quiet zone required by the QR spec, in modules
    var dim = n + quiet * 2;
    var d = '';
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff48d"/><path fill="#1d1c1c" d="' + d + '"/></svg>';
  }

  _copy() {
    var url = this._config.url;
    // Looked up when used: the card may re-render (language change) while the clipboard call runs
    var setIcon = (icon) => this.shadowRoot.getElementById('ico')?.setAttribute('icon', icon);
    // The icon only changes visually: the result is also announced through the live region
    var announce = (text) => {
      var live = this.shadowRoot.getElementById('live');
      if (live) live.textContent = text;
    };
    var flash = (icon, key) => {
      setIcon(icon);
      announce(this._t(key));
      clearTimeout(this._copyTimer);
      this._copyTimer = setTimeout(() => {
        setIcon('mdi:content-copy');
        announce('');
      }, 1500);
    };
    var done = () => flash('mdi:check', 'copied');
    var failed = () => flash('mdi:alert', 'copy_failed');
    var legacy = () => {
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (_e) { /* clipboard unavailable */ }
      ta.remove();
      if (ok) done();
      else failed();
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, legacy);
    else legacy();
  }

  _render() {
    var c = this._config;
    // The QR (8 mask trials) is only rebuilt when its payload or size changes,
    // not on a re-render for a language change
    var size = c.qr_size || WERO_QR_SIZE;
    var key = `${size}|${c.url}`;
    if (this._svgKey !== key) {
      this._svg = this._buildQrSvg(c.url, size);
      this._svgKey = key;
    }
    // The label follows the language, the cached QR does not depend on it
    var svg = this._svg.replace(' role="img"', ` role="img" aria-label="${weroEsc(this._t('qr_code'))}"`);
    // Mini card in its compact view: one row, the QR as a thumbnail that opens the full screen QR, like the big one
    var compact = this._compact();
    // A configured size overrides the 176 px of the stylesheet (it still shrinks to fit the card)
    var qrStyle = c.qr_size && !compact ? ` style="--wero-qr-size:${c.qr_size}px"` : '';
    var copy = weroEsc(this._t('copy'));
    var zoom = weroEsc(this._t('zoom'));
    // show_title: false keeps the (empty) name, which pushes the buttons to the right
    var status = this._status();
    var night = this._isNight();
    this._sig = `${status}|${night}`;
    // The badge's colour follows the payment status (classic header without the logo, illustrated header)
    var stColor = { ready: 'var(--primary-color, #03a9f4)', waiting: 'var(--primary-color, #03a9f4)', received: 'var(--success-color, #43a047)', off: 'var(--disabled-text-color, #9e9e9e)' }[status];
    // The status pill (same colour as the icon): a dot and a short label; the label stays in its tooltip and for
    // screen readers when a very narrow card shows the dot alone
    var stLabel = weroEsc(this._t(`st_${status}`));
    var chip = `<span class="chip" style="--c:${stColor}" title="${stLabel}" aria-label="${stLabel}"><span class="dot"></span><span class="ptxt">${stLabel}</span></span>`;
    // show_title: false keeps the (empty) name, which pushes the buttons to the right
    var title = c.show_title ? `<span class="name" title="${weroEsc(c.title)}">${weroEsc(c.title)}</span>` : '<span class="name"></span>';
    title = `<div class="trow">${title}${chip}</div>`;
    // The SVG is aria-hidden inside the role=button wrapper: its role=img would otherwise be read as part of the button
    var qrEl = `<div class="qr-wrap${compact ? ' thumb' : ''}" id="qr" role="button" tabindex="0" title="${zoom}" aria-label="${zoom}"${qrStyle}>${svg.replace('<svg ', '<svg aria-hidden="true" ')}</div>`;
    var body = compact
      ? `<dialog id="zoom" aria-label="${zoom}"></dialog>`
      : `${qrEl}
        <dialog id="zoom" aria-label="${zoom}"></dialog>
        ${c.name ? `<div class="info-row"><div class="lbl">${weroEsc(this._t('payee'))}</div><div class="val">${weroEsc(c.name)}</div></div>` : ''}
        <div class="hint">${weroEsc(this._t('hint'))}</div>`;
    var copyBtn = `<button id="copy" title="${copy}" aria-label="${copy}"><ha-icon icon="mdi:content-copy" id="ico"></ha-icon></button>`;
    // Compact view: the copy button goes under the detail button, so the thumbnail sits right next to that column
    // The other buttons line up at the left of the detail button, on its top line
    var actions = copyBtn + this._zoomButton();
    var header;
    if (c.illustration) {
      // Illustrated header: the round QR icon (in the status colour) and the title / status on the background at
      // the left, the shop counter at the right, a 10 px Wero-yellow strip edge to edge at the bottom. The compact
      // mini card shows its QR code itself on the counter (it opens the full screen QR, like the big one).
      // The status is in the pill: the subtitle names the payee
      var subText = c.name || 'Wero';
      var hsub = `<span class="hsub" title="${weroEsc(subText)}">${weroEsc(subText)}</span>`;
      var htitle = c.show_title ? `<span class="hname" title="${weroEsc(c.title)}">${weroEsc(c.title)}</span>` : '';
      var icon = `<ha-icon icon="mdi:qrcode"></ha-icon>${c.logo ? `<img class="hbrand" src="${WERO_LOGO}" alt="">` : ''}`;
      header = `<div class="banner st-${status}${night ? ' night' : ''}" style="--wc-st:${stColor}">
          ${compact ? weroMiniScene(this._uid) : weroScene(this._uid, c.logo)}<div class="wc-ground"></div>
          <div class="htext${compact ? ' mini' : ''}"><div class="hicon">${icon}</div><div class="htitles"><div class="hrow">${htitle}${chip}</div>${hsub}</div></div>
          ${compact ? qrEl : ''}<div class="hact">${actions}</div>
        </div>`;
    } else {
      if (compact) {
        var sub = c.name ? `<span class="sub" title="${weroEsc(c.name)}">${weroEsc(c.name)}</span>` : '';
        title = `<div class="txt">${title}${sub}</div>${qrEl}`;
      } else {
        title = `<div class="txt">${title}</div>`;
      }
      header = `<div class="header">
          ${c.logo ? `<img class="logo" src="${WERO_LOGO}" alt="Wero">` : `<div class="badge" style="--c:${stColor}"><ha-icon icon="mdi:qrcode-scan"></ha-icon></div>`}
          ${title}
          ${actions}
        </div>`;
    }
    // The redraw patches the nodes in place (weroMorph): an open full screen QR stays open, its QR copy is put back
    // below; the keyboard focus is given back to the same control if it was lost, without scrolling the page
    var prevDlg = this.shadowRoot.getElementById('zoom');
    var wasOpen = !!(prevDlg && prevDlg.open);
    var focusId = this.shadowRoot.activeElement?.id;
    if (focusId !== 'copy' && focusId !== 'qr') focusId = null;

    weroMorph(this.shadowRoot, `
      <style>
        :host { display: block; height: 100%; }
        ha-card { height: 100%; box-sizing: border-box; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 10px; }
        .header { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: -2px; }
        /* The Wero wordmark on a 40 px tile of its own yellow, 2 px from the tile edges */
        .logo { width: 40px; height: 40px; box-sizing: border-box; padding: 0 2px; border-radius: 10px; background: #fff48d;
                display: block; flex: none; object-fit: contain; }
        .badge { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex: none;
                 --c: var(--primary-color, #03a9f4); background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
        .badge ha-icon { color: inherit; --mdc-icon-size: 24px; }
        /* The title gives way first (ellipsis, full text in its tooltip) but keeps about 4 characters; the logo and the button never shrink */
        .name { flex: 1 1 auto; min-width: 4ch; font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        ha-icon { color: var(--secondary-text-color); --mdc-icon-size: 22px; }
        button { background: none; border: none; cursor: pointer; padding: 0; display: flex; align-items: center; }
        #copy { flex: none; width: 24px; height: 24px; border-radius: 50%; justify-content: center; }
        #copy ha-icon { --mdc-icon-size: 18px; }
        #copy:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); }
        #copy:focus-visible, .qr-wrap:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
        .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
        .qr-wrap { background: #fff48d; border-radius: 10px; overflow: hidden; line-height: 0; max-width: 100%; cursor: zoom-in; }
        .qr-wrap svg { max-width: 100%; height: auto; width: var(--wero-qr-size, 176px); }
        dialog { border: none; padding: 0; margin: auto; background: #fff48d; border-radius: 12px; line-height: 0; overflow: hidden; cursor: zoom-out; }
        /* showModal() focuses the dialog itself: no focus ring around the full screen QR (Escape still closes it) */
        dialog:focus, dialog:focus-visible { outline: none; }
        dialog::backdrop { background: rgba(0,0,0,0.85); }
        dialog svg { width: min(90vw, 90vh); height: auto; display: block; }
        .info-row { width: 100%; box-sizing: border-box; background: var(--secondary-background-color, rgba(127,127,127,.08)); border-radius: 10px; padding: 6px 10px; }
        .lbl { font-size: 11px; color: var(--secondary-text-color); margin-bottom: 0; }
        .val { font-size: 13px; font-weight: 500; word-break: break-word; color: var(--primary-text-color); }
        .hint { font-size: 11px; color: var(--secondary-text-color); text-align: center; }
        /* Mini card. Only its ha-card is a size container (the layout follows its own width). A size container takes
           no width from its content: in a parent sized by its content it would shrink to its padding. An empty,
           zero-height grid before it gives the host up to 240px there, and no minimum. */
        :host([mini]) { display: block; min-width: 0; }
        :host([mini])::before { content: ""; display: grid; grid-template-columns: minmax(0, 240px); height: 0; }
        ha-card.mini { container-type: inline-size; }
        ha-card.mini .header { margin-bottom: 0; }
        .txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .txt .name { flex: none; min-width: 0; }
        /* The title and the status pill on one row when the whole title and the whole label fit there (measured by the
           card, see weroPlacePill); otherwise the pill on its own line under the title (and the payee), its dot alone when
           even that cuts its label */
        .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .trow .name { flex: 0 1 auto; min-width: 0; }
        .header[data-wrap] .txt { gap: 2px; }
        .header[data-wrap] .txt > .trow { display: contents; }
        .header[data-wrap] .txt>.sub { order: 2; }
        .header[data-wrap] .chip { order: 3; align-self: flex-start; }
        .header[data-wrap] .name { max-width: 100%; }
        [data-dot] .chip { padding: 3px; }
        [data-dot] .chip .ptxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .chip { --c: var(--primary-color, #03a9f4); display: inline-flex; align-items: center; gap: 4px; flex: none; max-width: 100%; box-sizing: border-box;
                padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; line-height: 16px; white-space: nowrap; overflow: hidden;
                background: color-mix(in srgb, var(--c) 15%, transparent); color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color, #212121)); }
        .chip .ptxt { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
        .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--c); }
        .sub { font-size: 13px; line-height: 1.25; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .qr-wrap.thumb { flex: none; border-radius: 8px; }
        .qr-wrap.thumb svg { width: 64px; display: block; }
        .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px -4px 0; border-radius: 50%; align-self: flex-start;
                display: grid; place-items: center; color: var(--secondary-text-color); --mdc-icon-size: 16px; }
        .zoom ha-icon { color: inherit; --mdc-icon-size: 16px; }
        .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
        .zoom:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
        ha-card.mini #copy ha-icon { --mdc-icon-size: 16px; }
        ha-card.mini .header > #copy { align-self: flex-start; margin: -4px 0; }
        /* A very narrow mini card: a smaller thumbnail, the copy button gives way (the full card keeps it) */
        @container (max-width: 200px) {
          ha-card.mini { padding: 10px; }
          ha-card.mini .header { gap: 6px; }
          ha-card.mini .name { font-size: 14px; }
          .sub { font-size: 12px; }
          .qr-wrap.thumb svg { width: 48px; }
          ha-card.mini #copy { display: none; }
        }
${c.illustration ? WERO_BANNER_STYLE : ''}
      </style>
      <ha-card${compact ? ' class="mini"' : ''}${c.illustration ? ' data-ill' : ''}>
        ${header}
        ${body}
        <span class="sr" id="live" aria-live="polite"></span>
      </ha-card>`);

    this.shadowRoot.getElementById('copy').onclick = () => this._copy();
    var qr = this.shadowRoot.getElementById('qr');
    var dlg = this.shadowRoot.getElementById('zoom');
    // A dialog that was replaced (the mini card switching views) is closed: it would come back open elsewhere
    if (wasOpen && prevDlg !== dlg) prevDlg.close();
    var open = () => {
      // The dialog gets its copy of the QR (a clone, the SVG path can be big) on first open only
      // The button's label covers its QR (hidden from screen readers there); the full screen one is an image again
      if (!dlg.firstChild) {
        var big = qr.firstElementChild.cloneNode(true);
        big.removeAttribute('aria-hidden');
        dlg.appendChild(big);
      }
      if (!dlg.open) dlg.showModal();
    };
    // The big QR and the compact view's thumbnail both open the full screen QR
    qr.onclick = open;
    qr.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
    // Escape is handled natively by <dialog>; a click anywhere (QR or backdrop) closes it
    if (dlg) dlg.onclick = () => dlg.close();
    if (wasOpen) open();
    else if (focusId && this.shadowRoot.activeElement?.id !== focusId) this.shadowRoot.getElementById(focusId)?.focus?.({ preventScroll: true });
    this._fitPill();
  }

  // The status pill's place, on the banner and on the classic header (see weroPlacePill)
  _fitPill() {
    // Home Assistant's <ha-card> (a Lit element) shows its content only from its first update, a microtask after it
    // is connected: measured before, everything is 0 px wide and the pill lands on the wrong line. Fitted then.
    var haCard = this.shadowRoot?.querySelector?.('ha-card');
    if (haCard && haCard.hasUpdated === false) {
      this._pillWait ??= (haCard.updateComplete?.then ? haCard.updateComplete : new Promise((r) => requestAnimationFrame(r))).then(() => {
        this._pillWait = null;
        this._fitPill();
      });
      return;
    }
    var row = this.shadowRoot?.querySelector?.('.hrow, .header .trow');
    if (!row) return;
    var banner = row.closest('.banner');
    weroPlacePill(banner || row.closest('.header'), row, banner?.querySelector('.wc-ground'));
  }

  // A new width (or the web font loaded): the status pill is fitted again, in the next frame
  connectedCallback() {
    if (typeof ResizeObserver === 'function') {
      this._resize ??= new ResizeObserver((entries) => {
        var w = Math.round(entries[entries.length - 1].contentRect.width);
        if (w === this._fitWidth) return;
        this._fitWidth = w;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this._fitPill());
      });
      this._resize.observe(this);
    }
    document.fonts?.ready?.then(() => this._fitPill());
  }

  // Overridden by the mini card: the full card never shows the compact view nor a detail button
  _compact() { return false; }

  _zoomButton() { return ''; }

  disconnectedCallback() {
    this._resize?.disconnect();
    this._fitWidth = null;
    // The timer that restores the copy icon is cancelled: restore it now
    clearTimeout(this._copyTimer);
    this.shadowRoot?.getElementById('ico')?.setAttribute('icon', 'mdi:content-copy');
    var live = this.shadowRoot?.getElementById('live');
    if (live) live.textContent = '';
  }

  getCardSize() { return 5; }

  // 6 columns minimum: at 4 (about 160 px) the header leaves the title some 50 px, too few in any language
  getGridOptions() { return { columns: 6, min_columns: 6, rows: 'auto' }; }
}
