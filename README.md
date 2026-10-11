# ha-wero-card

[![HACS Badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://github.com/hacs/integration)
[![HACS Validation](https://github.com/juju35/ha-wero-card/actions/workflows/validate.yml/badge.svg)](https://github.com/juju35/ha-wero-card/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Custom Lovelace card for Home Assistant that displays your [Wero](https://wero-wallet.eu) QR code, so guests can pay you back without asking for your phone number or IBAN.

**Zero external dependencies** — the QR code is generated in pure JavaScript with an embedded Reed-Solomon encoder. No CDN, no network requests.

## Features

- QR code generated in pure JS (embedded Reed-Solomon algorithm), with a spec-compliant quiet zone
- Wero logo in the header (can be disabled)
- Copy-link button to share the payment link by message
- Fully compatible with Home Assistant dark mode and sections dashboards
- French / English, auto-detected
- HACS-ready, single file (~20 KB)

## Getting your Wero link

There is no public format to build a Wero QR code from a phone number or an IBAN: the card re-encodes the link that your bank generates.

1. In your banking app (or the Wero app), open Wero and generate your QR code / payment link.
2. Either use the app's share option to copy the link, or scan the QR code with a generic QR reader (not a banking app) and copy the URL.
3. The link looks like `https://share.weropay.eu/p/1/c/XXXXXXXXXX`.

> Check that the link is still valid after a few days before printing it or relying on it: its lifetime depends on how your bank generated it.

## Installation

### Via HACS (recommended)

1. Open HACS → **Frontend** → **⋮** → **Custom repositories**
2. Add `https://github.com/juju35/ha-wero-card` — Category: **Lovelace**
3. Search for **Wero QR Card** and install it
4. Clear your browser cache and refresh

### Manual

1. Download `dist/wero-card.js` from the [latest release](https://github.com/juju35/ha-wero-card/releases/latest)
2. Copy it to `/config/www/wero-card.js`
3. Go to **Settings → Dashboards → Resources** → Add resource:
   - URL: `/local/wero-card.js`
   - Type: **JavaScript Module**
4. Clear your browser cache and refresh

## Configuration

### Minimal

```yaml
type: custom:wero-card
url: https://share.weropay.eu/p/1/c/XXXXXXXXXX
```

### Full options

```yaml
type: custom:wero-card
url: https://share.weropay.eu/p/1/c/XXXXXXXXXX
title: Remboursement
name: Julien
logo: true
qr_size: 200
language: fr
```

### Options reference

| Option | Required | Default | Description |
|---|---|---|---|
| `url` | ✅ | — | The `https://` link encoded in your Wero QR code |
| `title` | ❌ | Auto (i18n) | Card title |
| `name` | ❌ | — | Payee name, shown under the QR code |
| `logo` | ❌ | `true` | Show the Wero logo in the header (`false` shows a generic icon) |
| `qr_size` | ❌ | `200` | QR code size in pixels (quiet zone included) |
| `language` | ❌ | Auto | Force language: `fr` or `en` (auto-detects from HA settings) |

## How it works

The card encodes `url` as-is into a QR code (error correction level M). Scanning it with a Wero-enabled banking app, or with the phone camera, opens the Wero payment flow for the payee behind the link.

The logo is kept out of the QR code on purpose: overlaying a logo on the modules makes scanning unreliable.

## Translations

| Language | Code |
|---|---|
| English | `en` |
| Français | `fr` |

Contributions for additional languages are welcome!

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by EPI Company. Wero and the Wero logo are trademarks of EPI Company, used here only to identify the payment method.

## License

[MIT](LICENSE)
