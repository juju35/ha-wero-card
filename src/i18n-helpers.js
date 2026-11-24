// ── i18n ──────────────────────────────────────────────────────────────────────
import { WERO_LOGO } from "./wero-logo.js";
import { WeroI18n } from "./i18n/weroi18n.js";

// Language actually used: the full code when translated ("sr-Latn"), else its
// base ("fr-FR" -> "fr"), else English
export function weroResolveLang(lang) {
  var full = String(lang || 'en');
  if (WeroI18n[full]) return full;
  var base = full.split('-')[0];
  return WeroI18n[base] ? base : 'en';
}

// Default displayed size of the QR code, in px (quiet zone included)
export var WERO_QR_SIZE = 176;

// States of the optional `entity` that mean the payment has arrived
export var WERO_RECEIVED = ['on', 'true', 'received', 'paid', 'completed', 'done', 'success'];

// Each card instance gets its own SVG ids (several cards on one page)

// The payment terminal's 3 × 3 keypad (around the terminal's own origin)
export function weroKeys() {
  var keys = '';
  for (var r = 0; r < 3; r++) {
    for (var c = 0; c < 3; c++) keys += `<rect x="${-6 + c * 4.4}" y="${-9 + r * 3}" width="3" height="2" rx=".5"/>`;
  }
  return keys;
}

// The header's illustration: a shop counter at the right of a 200 × 80 picture (striped awning, pendant lamp,
// payment terminal, a phone that taps it, the Wero logo on the counter front). The counter starts at x 84: the
// card's text sits on the plain background at its left.
export function weroScene(uid, logo) {
  var scallops = '';
  for (var i = 0; i < 10; i++) {
    scallops += `<path class="wc-aw${i % 2 ? ' alt' : ''}" d="M${i * 20} 2h20v6q-5 5-10 0q-5 5-10 0z"/>`;
  }
  var keys = weroKeys();
  return `<svg class="wc-scene" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
    <defs><radialGradient id="wc-glow-${uid}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".8"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
    <g class="wc-awning">${scallops}<rect class="wc-awbar" x="0" y="0" width="200" height="2.4"/></g>
    <g class="wc-lamp"><circle class="wc-halo" cx="96" cy="24" r="14" fill="url(#wc-glow-${uid})"/><path class="wc-cord" d="M96 8v11"/><path class="wc-shade" d="M90.5 24a5.5 5 0 0 1 11 0Z"/><circle class="wc-bulb" cx="96" cy="24.6" r="1.6"/></g>
    <rect class="wc-cf" x="84" y="56" width="116" height="24"/>
    <rect class="wc-ct" x="80" y="53" width="120" height="3.6" rx="1.2"/>
    ${logo ? `<image class="wc-logo" href="${WERO_LOGO}" x="150" y="61.5" width="39" height="13"/>` : ''}
    <g transform="translate(112 53)"><rect class="wc-term" x="-9" y="-22" width="18" height="22" rx="3"/><rect class="wc-scr" x="-6" y="-19" width="12" height="8" rx="1"/>
      <g class="wc-dots"><circle cx="-3" cy="-15" r=".9"/><circle cx="0" cy="-15" r=".9"/><circle cx="3" cy="-15" r=".9"/></g>
      <g class="wc-keys">${keys}</g></g>
    <g class="wc-tap"><g transform="translate(150 50)"><rect class="wc-phone" x="-7" y="-26" width="14" height="26" rx="2.5"/><rect class="wc-pscr" x="-5.5" y="-23" width="11" height="20" rx="1"/>
      <g class="wc-phone"><rect x="-3" y="-19" width="6" height="6"/><rect class="wc-pscr" x="-1.4" y="-17.4" width="2.8" height="2.8"/></g></g></g>
    <g class="wc-ok"><circle cx="128" cy="21" r="6"/><path d="M125 21l2.2 2.2 4-4.4"/></g>
  </svg>`;
}

// The mini card's picture: the same counter, 130 × 80 at the right of the banner, drawn 1:1. The QR code stands on
// the counter as a shop's payment sign (x 38 to 94, the card puts its own scannable QR there), the terminal and its
// lamp at its left, the buttons' column above the empty counter end at its right (same layout as the WiFi card).
export function weroMiniScene(uid) {
  var keys = weroKeys();
  return `<svg class="wc-scene mini" viewBox="0 0 130 80" aria-hidden="true" focusable="false">
    <defs><radialGradient id="wc-glow-${uid}"><stop offset="0" stop-color="#ffd27a" stop-opacity=".8"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient></defs>
    <g class="wc-lamp"><circle class="wc-halo" cx="20" cy="16" r="12" fill="url(#wc-glow-${uid})"/><path class="wc-cord" d="M20 0v11"/><path class="wc-shade" d="M15 16a5 4.5 0 0 1 10 0Z"/><circle class="wc-bulb" cx="20" cy="16.5" r="1.4"/></g>
    <rect class="wc-cf" x="4" y="71.4" width="126" height="8.6"/>
    <rect class="wc-ct" x="0" y="68" width="130" height="3.6" rx="1.2"/>
    <rect class="wc-stand" x="60" y="66" width="12" height="2.4" rx=".8"/>
    <g transform="translate(20 68)"><rect class="wc-term" x="-9" y="-22" width="18" height="22" rx="3"/><rect class="wc-scr" x="-6" y="-19" width="12" height="8" rx="1"/>
      <g class="wc-dots"><circle cx="-3" cy="-15" r=".9"/><circle cx="0" cy="-15" r=".9"/><circle cx="3" cy="-15" r=".9"/></g>
      <g class="wc-keys">${keys}</g></g>
    <g class="wc-ok"><circle cx="20" cy="33" r="5.5"/><path d="M17.2 33l2 2 3.8-4.2"/></g>
  </svg>`;
}

// The illustrated header: 90 px high (full and mini card), edge to edge at the top of the card, its picture at the
// right (at most 200 px wide, 62 % of a narrow card), lifted onto a 10 px Wero-yellow strip. Day and night colours;
// the phone taps the terminal while a payment is expected, the green tick shows it arrived.
export var WERO_BANNER_STYLE = `
        ha-card[data-ill] { padding-top: 0; }
        ha-card.mini[data-ill] { padding: 0; }
        .banner { --sw: min(200px, 62cqw); container-type: inline-size; position: relative; overflow: hidden; flex: none; align-self: stretch; height: 90px; margin: 0 -12px;
                  container-type: inline-size; border-radius: var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
                  background: #fff7d6; color: #1d1c1c; }
        ha-card.mini .banner { margin: 0; border-radius: var(--ha-card-border-radius, 12px); }
        .banner.night { background: #2b2a33; color: #fff; }
        .wc-scene { position: absolute; right: 0; bottom: 10px; width: var(--sw); height: 80px;
                    -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 34%); mask-image: linear-gradient(90deg, transparent 0, #000 34%); }
        .wc-ground { position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background-color: #ffe600; box-shadow: inset 0 2px 0 #fff27a;
                     background-image: repeating-linear-gradient(90deg, #1d1d1b 0 8px, transparent 8px 20px); background-size: 100% 2px;
                     background-repeat: no-repeat; background-position: 0 55%; }
        .night .wc-ground { background-color: #6b6100; box-shadow: inset 0 2px 0 #8a7e10; }
        .htext { position: absolute; left: 12px; top: 0; bottom: 10px; right: calc(var(--sw) * .58 + 4px); display: flex; align-items: center; gap: 10px; min-width: 0; }
        .hicon { position: relative; width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--wc-st);
                 background: rgba(255,255,255,.72); box-shadow: inset 0 0 0 1px rgba(29,28,28,.12); }
        .night .hicon { color: color-mix(in srgb, var(--wc-st) 72%, #fff); background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.16); }
        .hicon ha-icon { color: inherit; --mdc-icon-size: 24px; }
        .hicon[role="button"] { cursor: zoom-in; }
        /* The Wero wordmark as a badge on the header icon, like the WiFi logo on the WiFi card's icon */
        .hbrand { position: absolute; right: -6px; bottom: -3px; width: 26px; height: 11px; border-radius: 3px; background: #fff48d;
                  box-shadow: 0 0 0 1.5px #fff; display: block; }
        .night .hbrand { box-shadow: 0 0 0 1.5px #2b2a33; }
        .hicon:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
        .htitles { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        /* Title row: the title (ellipsis, at least 4 characters) then the status pill, 8 px apart, centred on the title */
        .hrow { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .hname { flex: 0 1 auto; min-width: 0; font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .banner .chip { background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
        .banner.night .chip { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
        /* The pill right after the title only when the whole title and its whole label fit there (measured by the card,
           see weroPlacePill); otherwise on its own line under the subtitle; when even that cuts it or leaves the banner,
           and on a card of 200 px or less, the dot alone (the label in its tooltip and for screen readers) */
        .banner[data-wrap] .hrow { display: contents; }
        .banner[data-wrap] .htitles .hsub { order: 2; }
        .banner[data-wrap] .htitles .chip { order: 3; align-self: flex-start; max-width: 100%; }
        @container (max-width: 200px) { .htitles .chip { padding: 3px; } .htitles .chip .ptxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; } }
        .hsub { font-size: 13px; line-height: 1.25; color: #6b5d1f; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .night .hsub { color: rgba(255,255,255,.8); }
        /* The header's buttons in a column in the top right corner, like the WiFi card: the detail button at the corner,
           the copy button under it */
        .hact { position: absolute; z-index: 2; top: 5px; right: 5px; display: flex; flex-direction: column-reverse; justify-content: flex-end; gap: 4px; }
        .hact #copy, .hact .zoom { all: unset; position: relative; flex: none; cursor: pointer; width: 24px; height: 24px; border-radius: 50%; margin: 0;
                                   display: grid; place-items: center; color: #33506b; background: rgba(255,255,255,.55);
                                   box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); backdrop-filter: blur(4px); }
        .night .hact #copy, .night .hact .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
        .hact #copy:hover, .hact .zoom:hover { background: rgba(255,255,255,.75); }
        .night .hact #copy:hover, .night .hact .zoom:hover { background: rgba(255,255,255,.22); }
        .hact #copy:focus-visible, .hact .zoom:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
        .hact ha-icon, .hact #copy ha-icon { color: inherit; --mdc-icon-size: 16px; }
        .wc-aw { fill: #ffe600; } .wc-aw.alt { fill: #fff; } .wc-awbar { fill: #f5b400; }
        .night .wc-aw { fill: #6b6100; } .night .wc-aw.alt { fill: #4a4860; } .night .wc-awbar { fill: #8a7e10; }
        .wc-cord { stroke: #6b6650; stroke-width: .8; } .wc-shade { fill: #1d1c1c; } .wc-bulb { fill: #fff3c4; } .wc-halo { display: none; }
        .night .wc-shade { fill: #4a4860; } .night .wc-bulb { fill: #ffd27a; } .night .wc-halo { display: inline; }
        .wc-cf { fill: #f1e3b5; } .wc-ct { fill: #d9c27a; }
        .night .wc-cf { fill: #3c3a4c; } .night .wc-ct { fill: #4a4860; }
        .wc-term, .wc-phone { fill: #22262b; } .wc-keys { fill: #5f6b7a; } .wc-scr, .wc-pscr { fill: #ffe57a; }
        .night .wc-term, .night .wc-phone { fill: #5a5f6b; } .night .wc-keys { fill: #2b2f36; }
        .wc-dots { fill: #1d1c1c; display: none; }
        .wc-ok circle { fill: #43a047; } .wc-ok path { stroke: #fff; stroke-width: 1.6; fill: none; }
        .wc-ok { opacity: 0; transform-box: fill-box; transform-origin: center; }
        .st-ready .wc-tap, .st-waiting .wc-tap { animation: wc-tap 3s ease-in-out infinite; }
        .st-ready .wc-ok { opacity: 1; animation: wc-ok 3s infinite; }
        .st-waiting .wc-dots { display: inline; animation: wc-blink 1.2s ease-in-out infinite; }
        .st-received .wc-ok { opacity: 1; animation: wc-pop .6s ease-out both; }
        .st-received .wc-scr { fill: #7ed38a; }
        .st-off .wc-scr, .st-off .wc-pscr { fill: #5f6670; }
        .st-off .wc-tap { opacity: .6; }
        /* Narrow card: a smaller counter, so that the title keeps its room */
        @container (max-width: 300px) { .wc-scene, .htext { --sw: 50cqw; } .wc-awning, .wc-lamp { display: none; } }
        /* Narrower still: the yellow strip alone, so that the title stays whole and the status pill keeps its label (the
           text stops short of the buttons' corner) */
        @container (max-width: 270px) { .wc-scene:not(.mini) { display: none; } .banner .htext:not(.mini) { right: 60px; } }
        /* Mini card: its QR code on the counter at the right, big enough to be scanned from the card (a white frame
           around its own Wero-yellow quiet zone), the detail / copy column at its right, the text up to the terminal */
        .wc-scene.mini { width: 130px; -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 8%); mask-image: linear-gradient(90deg, transparent 0, #000 8%); }
        .wc-stand { fill: #8a7a3a; } .night .wc-stand { fill: #23222b; }
        .banner .htext.mini { right: 120px; }
        /* The QR standing on the counter, at the left of the buttons' column (same place and size as the WiFi card's) */
        .banner .qr-wrap.thumb { position: absolute; z-index: 1; right: 36px; top: 12px; border-radius: 6px;
                                 box-shadow: 0 0 0 2px #fff, 0 1px 4px 2px rgba(0,0,0,.18); }
        .banner.night .qr-wrap.thumb { box-shadow: 0 0 0 2px #e6e6e6, 0 1px 4px 2px rgba(0,0,0,.45); }
        .banner .qr-wrap.thumb svg { width: 56px; }
        .banner .qr-wrap.thumb:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 4px; }
        /* Narrow mini card: the buttons back on one line, the QR under them at the right edge */
        @container (max-width: 300px) { .wc-scene.mini .wc-lamp, .wc-scene.mini .wc-ok, .wc-scene.mini g[transform] { display: none; } .banner .htext.mini { right: 62px; gap: 8px; }
          ha-card.mini .hact { flex-direction: row; } .banner .qr-wrap.thumb { right: 8px; top: 32px; } .banner .qr-wrap.thumb svg { width: 46px; } }
        /* Very narrow mini card (copy button hidden): the QR under the detail button, at the right edge */
        @container (max-width: 200px) {
          .wc-scene.mini { display: none; }
          .banner .htext.mini { left: 8px; right: 60px; gap: 6px; }
          .banner .htext.mini .hname { font-size: 14px; }
        }
        @keyframes wc-tap { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-26px); } }
        @keyframes wc-ok { 0%, 45% { opacity: 0; } 55%, 100% { opacity: 1; } }
        @keyframes wc-blink { 50% { opacity: .25; } }
        @keyframes wc-pop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .wc-tap, .wc-ok, .wc-dots { animation: none !important; }
        }`;

// The status pill's place, decided by measurement after each render and each new width (the same rule on every
// card): on the title row, right after the title, only when the whole title and the pill's whole label fit there;
// otherwise on its own line under the subtitle (one line), the title whole on its row (cut only when it does not fit
// alone). When the label is still cut there, or the text block leaves the banner or runs over its ground strip, the
// pill keeps its dot alone, on the title row (its label stays in title and aria-label). A card of 200 px or less
// shows the dot alone anyway (CSS), beside the title.
export function weroPlacePill(head, row, ground) {
  if (!head) return;
  head.removeAttribute('data-wrap');
  head.removeAttribute('data-dot');
  var pill = row.querySelector(':scope > .chip');
  var text = pill?.querySelector('.ptxt');
  if (!text?.getBoundingClientRect || text.getBoundingClientRect().width <= 1) return;
  // The full card is no size container: at 200 px or less it keeps the dot alone too
  if (head.closest('ha-card').getBoundingClientRect().width <= 200) return head.setAttribute('data-dot', '');
  var name = row.querySelector(':scope > .hname, :scope > .name');
  var gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  var title = name && name.textContent ? (name.scrollWidth > name.clientWidth ? name.scrollWidth : name.getBoundingClientRect().width) + gap : 0;
  if (title + pill.getBoundingClientRect().width <= row.getBoundingClientRect().width + 0.5) return;
  head.setAttribute('data-wrap', '');
  var box = (head.querySelector('.htitles, .txt') || row).getBoundingClientRect();
  var frame = head.getBoundingClientRect();
  var out = ground && (box.bottom > ground.getBoundingClientRect().top + 0.5 || box.top < frame.top - 0.5);
  if (text.scrollWidth > text.clientWidth + 0.5 || out) {
    head.removeAttribute('data-wrap');
    head.setAttribute('data-dot', '');
  }
}

export function weroEsc(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
