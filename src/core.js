/**
 * Compact card: the logo, the title and the payee on one row, with a QR thumbnail.
 * Its detail button (top right, `zoom: false` removes it) and the thumbnail switch it to the full card (big
 * scannable QR) and back; a click outside the card brings the compact view back.
 */
import { weroEsc } from "./i18n-helpers.js";
import { WeroCard } from "./wero-card-2.js";
import { weroInDialog } from "./wero-mini-card.js";

export class WeroMiniCard extends WeroCard {
  constructor() {
    super();
    this._zoomed = false;
    this._onOutside = (ev) => {
      if (this._zoomed && !ev.composedPath().includes(this) && !weroInDialog(ev)) this._setZoom(false);
    };
  }

  static getConfigElement() {
    return document.createElement('wero-mini-card-editor');
  }

  setConfig(config) {
    // The host attribute behind the mini card's styles; never set in the constructor
    this.setAttribute?.('mini', '');
    super.setConfig(config);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onOutside, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onOutside, true);
  }

  getCardSize() { return this._zoomed ? super.getCardSize() : 2; }

  getGridOptions() { return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 }; }

  _compact() { return !this._zoomed; }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    this._render();
  }

  _zoomButton() {
    if (this._configRaw.zoom === false) return '';
    var label = weroEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    return `<button class="zoom" title="${label}" aria-label="${label}"><ha-icon icon="mdi:${this._zoomed ? 'arrow-collapse' : 'arrow-expand'}"></ha-icon></button>`;
  }

  _zoomClick(ev) {
    ev.stopPropagation();
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button, without scrolling the page
    if (ev.detail === 0) this.shadowRoot.querySelector?.('.zoom')?.focus?.({ preventScroll: true });
  }

  _render() {
    super._render();
    var btn = this.shadowRoot.querySelector?.('.zoom');
    if (btn) btn.onclick = (ev) => this._zoomClick(ev);
  }
}
