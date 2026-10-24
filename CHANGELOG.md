# Changelog

## 1.5.0

### Changes
- `qr_size` now takes effect: the QR code used to stay at 176 px whatever the setting. Without `qr_size` nothing changes (176 px, now also the default shown in the editor and the README, instead of 200).
- Card size in the sections view explicitly follows its content (`rows: auto`, unchanged in practice), and the card picker description reads "Wero QR code, no CDN".

### Fixes
- Long payment links (about 110 characters or more) produced a QR code that could not be scanned; every length now works.
- A payment link containing an emoji no longer produces an unreadable QR code.
- The copy confirmation shows on the right icon even if the card is redrawn meanwhile.

### Maintenance
- CI: actions pinned by commit SHA, read-only token permissions, Dependabot for GitHub Actions, duplicate-code annotations, and QR round-trip tests run on every push.

## 1.4.3

### Maintenance
- Neutral name in the README example and the screenshot mock data; screenshots regenerated.

## 1.4.2

### Changes
- Wero logo shown 36 px high, the same height as the WiFi logo of ha-wifi-card (was 24 px).

## 1.4.1

### Maintenance
- Tooling only, no functional change: Biome linting, pre-commit and a Lint CI (duplication checks). Card source modernized (optional chaining, template literals), identical behavior.

## 1.4.0

### Changes
- More compact layout with the same information, like the other ha-* cards: 12 px card padding, 36 px header icon, 16 px name and 12 px subtitle, 11 px pills, tighter tiles and sections.
- QR code shown at 176 px, tighter payee block and hint.

## 1.3.3

### Changes
- HACS now asks for Home Assistant 2024.8 or later, the version that brought the sections view the card supports; the README says so under **Prerequisites**.
- README: **Add to HACS** button in the installation steps, as in the other ha-* repositories.

### Maintenance
- CHANGELOG headings use the same plain English set as the other ha-* repositories.

## 1.3.2

### Maintenance
- Merged branches are deleted automatically (new `cleanup-branches` workflow). Nothing changes for users.

## 1.3.1

### Development
- The built card is no longer committed in `dist/`: CI builds it on every push, and the release workflow builds it and attaches it to the release, which is where HACS downloads it from. Nothing changes for users.

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

### Changes
- README screenshot updated.

## 1.2.0

### What's new
- Visual editor: add the card from **Add card → Wero QR Card** and set every option from a form (link, title, payee name, logo, QR size, language), no YAML needed.
- The card picker now shows a live preview of the card.

### Changes
- Editor labels in French and English, following Home Assistant's language.
- The YAML saved by the editor leaves out empty fields and default values.

## 1.1.0

### What's new
- Tap the QR code to show it fullscreen on a dark background.
- Tap it again, tap the background, or press Escape to close it.

### Changes
- The card version is now logged to the browser console on load.

## 1.0.0

### What's new
- First release: Wero payment QR code generated in pure JavaScript (embedded Reed-Solomon encoder), no CDN and no network requests.
- Wero logo in the header (`logo: false` to hide it), copy-link button, optional payee name.
- French / English, dark mode and sections dashboards supported.
