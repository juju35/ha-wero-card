# Changelog

## 1.3.0

### Changes
- Header aligned with the other ha-* cards: title 18px next to the Wero logo.
- Rounded corners, spacing and label sizes aligned with the other cards.

### Development
- The card source moves to `src/wero-card.js`; `npm run build` stamps the version from `package.json` into `dist/wero-card.js`, and CI checks that `dist/` is up to date.
- `npm run screenshots` renders the README screenshots (light and dark).
- Releases are now published from `CHANGELOG.md`, added in this version, when `version` in `package.json` has no tag yet, like the other ha-* repositories (Release Drafter removed).

## 1.2.3

### Changes
- When the card is stretched to match a taller neighbour, its content now sits at the top instead of being centered vertically.

## 1.2.2

### Fixes
- The card now fills the full height of its slot, so it lines up with its neighbours in a horizontal stack or grid; content stays centered vertically.

## 1.2.1

### What's new
- The QR code background now uses the yellow of the Wero logo (#fff48d), with dark modules (#1d1c1c) so it still scans reliably. This applies to the card and to the fullscreen view.

### Other
- README screenshot updated.

## 1.2.0

### What's new
- Visual editor: add the card from **Add card → Wero QR Card** and set every option from a form (link, title, payee name, logo, QR size, language), no YAML needed.
- The card picker now shows a live preview of the card.

### Other
- Editor labels in French and English, following Home Assistant's language.
- The YAML saved by the editor leaves out empty fields and default values.

## 1.1.0

### What's new
- Tap the QR code to show it fullscreen on a dark background.
- Tap it again, tap the background, or press Escape to close it.

### Other
- The card version is now logged to the browser console on load.

## 1.0.0

### What's new
- First release: Wero payment QR code generated in pure JavaScript (embedded Reed-Solomon encoder), no CDN and no network requests.
- Wero logo in the header (`logo: false` to hide it), copy-link button, optional payee name.
- French / English, dark mode and sections dashboards supported.
