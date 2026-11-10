export const enrollmentDatesStyles = `
  .bc-enrollment-dates {
    position: fixed;
    inset: 55px 12px auto auto;
    box-sizing: border-box;
    width: min(344px, calc(100vw - 24px));
    max-height: calc(100dvh - 67px);
    margin: 0;
    padding: 12px 14px;
    overflow: auto;
    background: var(--bc-color-bg);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-md);
    box-shadow: var(--bc-shadow-elev-1);
    color: var(--bc-color-text);
    font: 400 13px/1.45 var(--bc-font-body);
  }

  .bc-enrollment-dates h2 {
    margin: 0 0 10px;
    font: 650 14px/1.25 var(--bc-font-body);
  }

  .bc-dates-windows {
    border-top: 1px solid var(--bc-color-border);
    padding-top: 8px;
  }

  .bc-dates-windows summary {
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
  }

  .bc-dates-windows ul {
    margin: 8px 0 0;
    list-style: disc;
    padding-inline-start: 16px;
  }

  .bc-dates-windows li + li { margin-top: 5px; }

  .bc-dates-note {
    margin: 0 0 8px;
    color: var(--bc-color-text-muted);
  }

  .bc-enrollment-dates > a {
    display: inline-block;
    margin-top: 10px;
    color: var(--bc-color-text-muted);
    font-size: 12px;
    text-underline-offset: 3px;
  }

  .bc-enrollment-dates > a:hover { color: var(--bc-color-accent); }
`;
