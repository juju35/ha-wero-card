// ── wero-card-editor (visual editor, built on HA's own ha-form) ──────────────
import { WERO_CARD_VERSION, pickerDefine } from "./card-picker.js";
import { WERO_QR_SIZE, weroResolveLang } from "./i18n-helpers.js";
import { WeroCard } from "./wero-card-2.js";
import { WeroMiniCard } from "./core.js";
import { WeroI18n } from "./i18n/weroi18n.js";

export var WERO_EDITOR_SCHEMA = [
  { name: 'url', required: true, selector: { text: { type: 'url' } } },
  { name: 'title', selector: { text: {} } },
  { name: 'name', selector: { text: {} } },
  { name: 'entity', selector: { entity: { domain: ['binary_sensor', 'input_boolean', 'sensor', 'input_select'] } } },
  { name: 'show_title', selector: { boolean: {} } },
  { name: 'logo', selector: { boolean: {} } },
  { name: 'illustration', selector: { boolean: {} } },
  { name: 'illustration_theme', selector: { select: { mode: 'dropdown', options: ['auto', 'day', 'night'] } } },
  { name: 'qr_size', selector: { number: { min: 100, max: 600, step: 10, mode: 'slider', unit_of_measurement: 'px' } } },
  { name: 'language', selector: { select: { mode: 'dropdown', options: [
    { value: 'fr', label: 'Français' },
    { value: 'en', label: 'English' },
    { value: 'de', label: 'Deutsch' },
    { value: 'es', label: 'Español' },
    { value: 'sr', label: 'Српски' },
    { value: 'sr-Latn', label: 'Srpski (latinica)' },
    { value: 'it', label: 'Italiano' },
    { value: 'nl', label: 'Nederlands' },
    { value: 'pt', label: 'Português (Portugal)' },
    { value: 'pl', label: 'Polski' },
    { value: 'ro', label: 'Română' },
    { value: 'da', label: 'Dansk' },
    { value: 'sv', label: 'Svenska' },
    { value: 'bg', label: 'Български' },
    { value: 'ru', label: 'Русский' },
    { value: 'uk', label: 'Українська' },
    { value: 'hu', label: 'Magyar' },
    { value: 'sk', label: 'Slovenčina' },
    { value: 'cs', label: 'Čeština' },
    { value: 'sl', label: 'Slovenščina' },
    { value: 'lv', label: 'Latviešu' },
    { value: 'el', label: 'Ελληνικά' },
  ] } } },
];

export class WeroCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = Object.assign({}, config);
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._form) {
      this._form.hass = hass;
      this._syncSchema();
    }
  }

  // The schema of this editor: the mini card adds its detail button after the logo toggle, and the language
  // choice starts with "Automatic" (no `language`: the language of Home Assistant), in the editor's language.
  _schema() {
    return WERO_EDITOR_SCHEMA.flatMap((f) => {
      if (f.name === 'logo' && this.constructor.mini) return [f, { name: 'zoom', selector: { boolean: {} } }];
      if (f.name === 'illustration_theme') {
        var themes = f.selector.select.options.map((v) => ({ value: v, label: this._t(`theme_${v}`) }));
        return [{ name: f.name, selector: { select: Object.assign({}, f.selector.select, { options: themes }) } }];
      }
      if (f.name !== 'language') return [f];
      var options = [{ value: '', label: this._t('ed_language_auto') }].concat(f.selector.select.options);
      return [{ name: f.name, selector: { select: Object.assign({}, f.selector.select, { options: options }) } }];
    });
  }

  // Rebuilt only when the editor's language changes
  _syncSchema() {
    var lang = weroResolveLang(this._hass?.language);
    if (this._schemaLang === lang) return;
    this._schemaLang = lang;
    this._form.schema = this._schema();
  }

  _t(key) {
    var strings = WeroI18n[weroResolveLang(this._hass?.language)];
    return strings[key] || WeroI18n.en[key] || key;
  }

  async _createForm() {
    // ha-form is lazy-loaded by HA; loading a built-in card's editor guarantees it is defined.
    if (!customElements.get('ha-form')) {
      var entities = customElements.get('hui-entities-card');
      if (entities?.getConfigElement) await entities.getConfigElement();
    }
    var form = document.createElement('ha-form');
    // The mini card adds its detail button after the logo toggle
    form.computeLabel = (s) => this._t(`ed_${s.name}`);
    form.computeHelper = (s) => (s.name === 'url' ? this._t('ed_url_help') : undefined);
    form.addEventListener('value-changed', (ev) => this._valueChanged(ev));
    this.appendChild(form);
    this._form = form;
  }

  async _render() {
    // setConfig can be called again while ha-form is still loading: every call
    // waits on the same promise, so a single form (and listener) is ever created.
    // _render is not awaited by setConfig: errors are caught here, never left unhandled.
    try {
      if (!this._formReady) this._formReady = this._createForm();
      await this._formReady;
    } catch (err) {
      this._formReady = null; // retried on the next setConfig
      console.error('wero-card editor: could not load ha-form', err);
      return;
    }
    this._form.hass = this._hass;
    this._syncSchema();
    this._form.data = Object.assign({ show_title: true, logo: true, illustration: true, illustration_theme: 'auto', qr_size: WERO_QR_SIZE }, this.constructor.mini ? { zoom: true } : {}, this._config);
  }

  _valueChanged(ev) {
    var config = Object.assign({}, this._config, ev.detail.value);
    // Keep the YAML tidy: drop empty fields and values equal to their default.
    Object.keys(config).forEach((k) => {
      if (config[k] === '' || config[k] === null || config[k] === undefined) delete config[k];
    });
    if (config.show_title === true) delete config.show_title;
    if (config.logo === true) delete config.logo;
    if (config.zoom === true) delete config.zoom;
    if (config.illustration === true) delete config.illustration;
    if (config.illustration_theme === 'auto') delete config.illustration_theme;
    if (Number(config.qr_size) === WERO_QR_SIZE) delete config.qr_size;
    this._config = config;
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: config }, bubbles: true, composed: true }));
  }
}

export class WeroMiniCardEditor extends WeroCardEditor {
  static get mini() { return true; }
}

export var weroDefine = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
weroDefine('wero-card', WeroCard);
weroDefine('wero-card-editor', WeroCardEditor);
weroDefine('wero-mini-card', WeroMiniCard);
weroDefine('wero-mini-card-editor', WeroMiniCardEditor);
console.info(`%c WERO-CARD %c v${WERO_CARD_VERSION} `, 'color:#1d1c1c;background:#fff48d;font-weight:700', 'color:#fff;background:#1d1c1c');
window.customCards = window.customCards || [];
export var weroPicker = (type, name, description) => {
  if (window.customCards.some((c) => c.type === type)) return;
  window.customCards.push({ type: type, name: name, description: description, preview: true, documentationURL: 'https://github.com/juju35/ha-wero-card' });
};
// Both entries in the language of the page (Home Assistant sets it on <html>)
export var weroPickerI18n = WeroI18n[weroResolveLang(document.documentElement.lang)];
weroPicker('wero-card', weroPickerI18n.card_name, weroPickerI18n.card_desc);
weroPicker('wero-mini-card', weroPickerI18n.mini_name, weroPickerI18n.mini_desc);
