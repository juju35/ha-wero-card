// ── wero-mini-card ────────────────────────────────────────────────────────────
// A click in a dialog opened from the page (a more-info, the QR fullscreen) does not fold the card back
export var weroInDialog = (ev) => ev.composedPath().some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName));
