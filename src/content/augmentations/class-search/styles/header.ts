// Root container + page header (title, subtitle).
export function headerStyles(): string {
  return `
    .bc-cs-root {
      position: relative;
      margin: 8px auto 40px;
      max-width: 1180px;
      padding: 0 16px;
      font-family: var(--bc-font-body);
      font-size: var(--bc-font-13);
      line-height: 1.45;
      font-variant-numeric: tabular-nums;
      color: var(--bc-color-text);
      box-sizing: border-box;
      text-align: left;
    }
    .bc-cs-root *, .bc-cs-root *::before, .bc-cs-root *::after { box-sizing: border-box; }
    .bc-cs-root .bc-ui-icon { display: block; flex: 0 0 auto; }

    /* ── Header ─────────────────────────────────────────────────────────── */
    .bc-cs-header {
      display: flex;
      align-items: baseline;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .bc-cs-title {
      font-family: var(--bc-font-display);
      font-size: var(--bc-font-20);
      font-weight: var(--bc-fw-semibold);
      line-height: 1.25;
      letter-spacing: var(--bc-ls-snug);
      color: var(--bc-color-text-strong);
      margin: 0;
    }
    .bc-cs-subtitle {
      flex: 1 1 auto;
      font-size: var(--bc-font-12);
      color: var(--bc-color-text-muted);
      line-height: 1.4;
    }
    .bc-cs-subtitle a { color: inherit; text-decoration: underline; text-decoration-color: var(--bc-color-border-strong); text-underline-offset: 3px; }
    .bc-cs-subtitle a:hover { color: var(--bc-color-text-strong); text-decoration-color: var(--bc-color-text-strong); }
    /* "Return to cart": a quiet text button at the end of the header. */
    .bc-cs-header .bc-btn {
      align-self: center;
      height: 28px;
      padding: 0 9px 0 7px;
      gap: 5px;
      border: 0;
      border-radius: 7px;
      font-size: 12.5px;
      font-weight: var(--bc-fw-regular);
      letter-spacing: 0;
      text-decoration: none;
      color: var(--bc-color-text-soft);
    }
    .bc-cs-header .bc-btn:hover {
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
    }
  `;
}
