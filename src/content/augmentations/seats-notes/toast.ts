const TOAST_HOST_ID = "bc-seats-toast-host";
const TOAST_STYLE_ID = "bc-seats-toast-style";

type ToastTone = "info" | "warn";

export function showToast(message: string, options?: { tone?: ToastTone; durationMs?: number }): void {
  const host = ensureHost();
  if (!host) return;

  const tone = options?.tone ?? "info";
  const duration = options?.durationMs ?? 3500;

  const toast = document.createElement("div");
  toast.className = `bc-toast bc-toast-${tone}`;
  toast.textContent = message;
  host.appendChild(toast);

  const remove = (): void => {
    if (!toast.isConnected) return;
    toast.classList.add("bc-toast-leaving");
    window.setTimeout(() => {
      toast.remove();
    }, 200);
  };

  window.setTimeout(remove, duration);
  toast.addEventListener("click", remove);
}

function ensureHost(): HTMLElement | null {
  injectToastStyles();
  const existing = document.getElementById(TOAST_HOST_ID);
  if (existing instanceof HTMLElement) return existing;

  const parent = document.body ?? document.documentElement;
  if (!parent) return null;

  const host = document.createElement("div");
  host.id = TOAST_HOST_ID;
  parent.appendChild(host);
  return host;
}

function injectToastStyles(): void {
  if (document.getElementById(TOAST_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = TOAST_STYLE_ID;
  style.textContent = `
    #${TOAST_HOST_ID} {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column-reverse;
      gap: 8px;
      pointer-events: none;
      max-width: calc(100vw - 32px);
    }
    .bc-toast {
      pointer-events: auto;
      cursor: pointer;
      padding: 8px 12px;
      border-radius: 6px;
      font: 500 12px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      max-width: 320px;
      animation: bc-toast-in 180ms ease-out;
      border: 1px solid transparent;
    }
    .bc-toast-info {
      background: #f6ecf2;
      border-color: #d8b6c8;
      color: #3f0126;
    }
    .bc-toast-warn {
      background: #fff4e5;
      border-color: #f1c27a;
      color: #6b3a00;
    }
    .bc-toast-leaving {
      animation: bc-toast-out 180ms ease-in forwards;
    }
    @keyframes bc-toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes bc-toast-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(8px); }
    }
  `;
  (document.head ?? document.documentElement).appendChild(style);
}
