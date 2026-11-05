// Shared inline SVG for the pencil mascot. Mirrors src/assets/icons/pencil.svg —
// inlining avoids needing to add the PNG/SVG to manifest
// web_accessible_resources, and keeps the colors theme-friendly without
// chrome.runtime.getURL hops. Sizing is left to the consumer's CSS.
export const PENCIL_SVG_MARKUP = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
  <g transform="rotate(135 32 32)" stroke="#2a2a2e" stroke-width="2" stroke-linejoin="round">
    <rect x="4" y="22" width="10" height="20" rx="3" fill="#ef8da6" />
    <rect x="14" y="22" width="9" height="20" fill="#c2c7cb" />
    <line x1="17" y1="23" x2="17" y2="41" stroke="#7d848a" stroke-width="1" />
    <line x1="20" y1="23" x2="20" y2="41" stroke="#7d848a" stroke-width="1" />
    <rect x="23" y="22" width="26" height="20" fill="#f5c842" />
    <polygon points="49,22 56,22 56,42 49,42" fill="#d4a373" />
    <polygon points="56,22 64,32 56,42" fill="#2a2a2e" stroke="#2a2a2e" stroke-width="2" stroke-linejoin="round" />
  </g>
</svg>
`.trim();
