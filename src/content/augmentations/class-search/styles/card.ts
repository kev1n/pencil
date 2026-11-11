// Search form: the query field, the term select, and the row under them.
export function cardStyles(): string {
  return `
    /* ── Search form ────────────────────────────────────────────────────── */
    /* Not a card: the field sits straight on the page and a hairline
       closes the block off from the results. */
    .bc-cs-card {
      padding-bottom: 12px;
      border-bottom: 1px solid var(--bc-color-border);
    }
    .bc-cs-form {
      display: grid;
      grid-template-columns: minmax(280px, 1fr) auto;
      gap: 8px;
      align-items: center;
    }
    .bc-cs-field { position: relative; display: flex; flex-direction: column; min-width: 0; }
    /* The placeholder and the term names say what these are; the labels
       stay for screen readers only. */
    .bc-cs-field label {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .bc-cs-input, .bc-cs-select {
      width: 100%;
      height: 40px;
      font: inherit;
      font-size: var(--bc-font-14);
      padding: 0 12px;
      border: 0;
      border-radius: var(--bc-radius-xl);
      background: var(--bc-color-surface-hover);
      color: var(--bc-color-text-strong);
      transition: background-color 100ms, box-shadow 100ms;
    }
    .bc-cs-select {
      --bc-select-bg: var(--bc-color-surface-hover);
      padding-right: 34px;
      appearance: none;
      -webkit-appearance: none;
      /* A drawn chevron in the text colour; the native arrow sat too tight
         against the rounded edge. */
      background-image:
        linear-gradient(45deg, transparent 50%, var(--bc-select-bg) 50%),
        linear-gradient(135deg, var(--bc-select-bg) 50%, transparent 50%),
        linear-gradient(45deg, transparent 50%, currentColor 50%),
        linear-gradient(135deg, currentColor 50%, transparent 50%);
      background-size: 6px 6px, 6px 6px, 6px 6px, 6px 6px;
      background-position:
        right 18px top calc(50% - 1px), right 12px top calc(50% - 1px),
        right 18px top calc(50% + 1px), right 12px top calc(50% + 1px);
      background-repeat: no-repeat;
      min-width: 150px;
      cursor: pointer;
    }
    .bc-cs-input:focus, .bc-cs-select:focus {
      outline: none;
      background-color: var(--bc-color-bg);
      box-shadow: inset 0 0 0 1px var(--bc-color-border-strong), var(--bc-shadow-input-focus-ring);
    }
    .bc-cs-select:focus { --bc-select-bg: var(--bc-color-bg); }
    .bc-cs-input-query {
      font-size: var(--bc-font-15);
      padding: 0 14px;
    }
    .bc-cs-input::placeholder { color: var(--bc-color-text-muted); }
  `;
}
