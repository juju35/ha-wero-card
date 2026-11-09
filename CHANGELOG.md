# Changelog

## 1.11.1 - 2026-11-09

### Fixes
- Translations: the cards are defined once the page's language file has arrived (at most 1.5 s; Home Assistant builds a card when its element gets defined), so the first render is already translated instead of English then redrawn; until a language file is in, a missing text reads the English one wherever the card has no fallback of its own.

## 1.11.0 - 2026-11-09

### Performance
- **Translations load on demand**: the bundle keeps English only (58 KB → 44 KB) and each other language is its own `wero-card.i18n.<lang>.js` file next to it, fetched the first time a card needs it. Home Assistant loads every dashboard resource on every dashboard, so each page used to download and parse all 22 languages to use one. Until a language file has arrived (a few milliseconds), texts fall back to English, and the cards redraw once it is there.

### Maintenance
- Build: `scripts/i18n-split.mjs` splits the built bundle and rebuilds every table from the split files to check them (the build fails on any difference); `src/` keeps every language as before.
- Release: every file of `dist/` is attached. Manual installation copies the translation files too.

## 1.10.1 - 2026-11-08

### Fixes
- The full screen QR code no longer shows a focus ring around it (a dark outline drawn by the browser, on phones in particular); Escape still closes it and the focus still returns to the QR code.

## 1.10.0 - 2026-11-08

### What's new
- The QR code image's screen reader label is translated in the 22 languages of the card and follows a language change.
- The main card's name and description in the card picker are shown in the language of Home Assistant, like the mini card's.
- Mini card: the copy button moves under the detail button in the top right corner, so the QR thumbnail sits right next to that column and lines up with the other mini cards (such as the Wi-Fi one).

## 1.9.2 - 2026-11-07

### Fixes
- Accessibility: the QR code inside the clickable "Enlarge QR code" area is hidden from screen readers, so the button is announced once by its own label; the full screen QR stays an image.

## 1.9.1 - 2026-11-07

### Changes
- Mini card: a tap on the QR thumbnail opens the QR code full screen directly (like the full card's QR), instead of switching to the full card; the detail button still does.

## 1.9.0 - 2026-11-07

### What's new
- Mini card `wero-mini-card`: the Wero logo, the title and the payee name on one row, with a small QR thumbnail and the copy button, about a quarter of the full card's height. Its detail button (top right, `zoom: false` removes it) or a tap on the thumbnail switches to the full card with the big scannable QR code; the button, or a click anywhere outside the card, brings the compact view back. On a card 200 px wide or less the thumbnail gets smaller and the copy button gives way.
- The mini card has its own visual editor (the same fields plus the detail button toggle) and its own entry in the card picker, translated in the 22 languages of the card.

### Maintenance
- Tests: compact markup, detail button and thumbnail, `zoom: false`, grid options, click outside the card, editor and translations of the mini card (41 tests in all).
- Screenshots and README: mini card (light, dark and narrow), `zoom` option and YAML example; single-file size updated to ~55 KB.

## 1.8.6 - 2026-11-04

### Documentation
- README: images and links use absolute URLs, so the screenshots, icons, badges and links display in HACS (relative paths broke there).
- README: screenshots get a display size, so cards no longer show oversized in HACS and on GitHub.

## 1.8.5 - 2026-11-04

### Changes
- Added Romanian, Danish, Swedish, Bulgarian, Russian, Ukrainian, Hungarian, Slovak, Czech, Slovenian, Latvian and Greek translations: the card and its visual editor are available in `ro`, `da`, `sv`, `bg`, `ru`, `uk`, `hu`, `sk`, `cs`, `sl`, `lv` and `el`, auto-detected from Home Assistant or forced with `language:`; the editor's language selector offers Română, Dansk, Svenska, Български, Русский, Українська, Magyar, Slovenčina, Čeština, Slovenščina, Latviešu and Ελληνικά.

### Maintenance
- Tests: the parity test covers the 12 new languages and a new test checks their resolution (`sv-FI`, `el-GR`, `cs-CZ`…) through the card and the editor (32 tests in all).
- README: languages, `language` option and translations table updated; single-file size updated to ~43 KB.

## 1.8.4 - 2026-11-01

### Fixes
- Sections dashboards: the card now takes at least 6 columns. At 4 columns the header left about 50 px to the title, which was cut in every language ("Wyśl…"); the title keeps at least 4 characters and shows its full text in a tooltip, and the copy button never shrinks.
- Copy button: a round 24 px button with a tinted background on hover; the copy button and the QR code show a clear focus ring when reached with the keyboard.
- Screen readers: "Link copied" or "Could not copy the link" is announced after a tap on the copy button (in the card's language).
- A language change no longer drops the keyboard focus from the copy button or the QR code, and giving the focus back no longer scrolls the dashboard to the card.

### Maintenance
- Biome 2.6.4 (pre-commit hook and schema), like the other cards.
- New tests: header at narrow widths, focus and hover states, screen-reader announcement, focus kept across a re-render without scrolling (31 tests in all).
- Screenshots: the script rewrites a screenshot only when its decoded pixels change, so a re-encoding alone no longer produces a screenshot commit.
- README: minimum width, keyboard use and screen-reader feedback; single-file size updated to ~36 KB.

## 1.8.3 - 2026-11-01

### Changes
- Added Italian, Dutch, European Portuguese and Polish translations: the card and its visual editor are available in Italian (`it`), Dutch (`nl`), European Portuguese (`pt`) and Polish (`pl`), auto-detected from Home Assistant or forced with `language:`; the editor's language selector offers Italiano, Nederlands, Português (Portugal) and Polski. `pt-BR` falls back to European Portuguese.

### Maintenance
- Tests: the parity test covers every language (keys, value types, placeholders, no empty value) and a new test checks the resolution of `it-IT`, `nl-BE`, `pt`, `pt-BR`, `pl-PL`, `sr-Latn` and `ja` (22 tests in all).
- README: languages, `language` option and translations table updated; single-file size updated to ~34 KB.

## 1.8.2 - 2026-11-01

### Changes
- Added Serbian (Cyrillic and Latin) translations: the card and its visual editor are available in Serbian, Cyrillic (`sr`) and Latin (`sr-Latn`) scripts, auto-detected from Home Assistant or forced with `language: sr` / `language: sr-Latn`; the editor's language selector offers Српски and Srpski (latinica).
- Language detection: a full language code is used when it is translated (`sr-Latn`), otherwise its base (`fr-FR` gives French), otherwise English.

### Maintenance
- New tests: Serbian parity with English (keys, placeholders, script) and language resolution (21 tests in all).
- README: Serbian listed, single-file size updated to ~32 KB.

## 1.8.1

### Fixes
- Visual editor: opening it for the first time while Home Assistant re-sends the configuration no longer creates two forms; a failure to load the form is reported in the console and retried.
- Copy button: when the browser refuses to copy (fallback mode), a brief alert icon is shown instead of nothing.
- The card no longer re-renders (nor rebuilds its QR code) when Home Assistant's language changes without changing the language displayed; a language change reuses the QR code already built.

### Maintenance
- CI: the Chromium download of the Screenshots workflow is time-boxed and retried, the apt step fails explicitly after 3 attempts, and a `package-lock.json` change refreshes the screenshots. When it pushes refreshed screenshots to a pull request, it re-runs the Lint, Validate and HACS checks on that commit (Lint can now also be started manually).
- README: the full-options example is in English; single-file size updated to ~30 KB. Redundant Biome globals removed; 4 new tests (19 in all).

## 1.8.0

### Changes
- German and Spanish translations: the card and its visual editor are now available in English, French, German and Spanish (auto-detected from Home Assistant, or forced with `language: de` / `language: es`); the editor's language selector offers Deutsch and Español.

### Maintenance
- New test checking that every language has exactly the keys of English and is offered by the editor (15 tests in all).
- README: languages listed, single-file size updated to ~29 KB.

## 1.7.1

### Fixes
- Changing the Home Assistant language while the zoomed QR code is open no longer leaves a stale dialog: it closes cleanly and reopens on the refreshed card. The zoom dialog's QR code is now built only when first opened.
- README: the dark screenshot caption no longer says "French" (the capture is in English).

### Maintenance
- The QR encoder picks the code size directly from its capacity table instead of trying every size in turn (same result).
- CI: release gated on tests, new Screenshots workflow, `hacs/action` pinned to a release tag, `npm ci` before the build check, unused ruff tooling removed; 2 new tests (14 in all).

## 1.7.0

### Fixes
- README: the feature list announced the single file as "~25 KB" while the built `dist/wero-card.js` is now ~28 KB; the stated size is corrected.

## 1.6.0
### Changes
- Header: the Wero wordmark sits on a 40 × 40 px tile of the Wero yellow (10 px radius), scaled to the tile width, like the 40 px header icons of the other ha-* cards; without the logo, the QR code icon sits in a 40 px round tinted badge (24 px icon).
- Header: 8 px between the header and the QR code.

## 1.5.1

### Fixes
- A negative, zero or non-numeric `qr_size` falls back to the default 176 px instead of hiding the QR code.
- The copy icon no longer stays on the check mark when the card is removed from the page and shown again during the copy confirmation.
- Very long payment links (well over a thousand characters) no longer get a larger QR code than needed: the built-in encoder had a wrong table entry for one size, and an error other than "too long" is no longer silently skipped.

### Maintenance
- New tests for `qr_size`, the copy icon and the QR encoder (12 in all); the screenshot script renders each capture in its own page, and the duplicate-code check ignores test folders.

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
