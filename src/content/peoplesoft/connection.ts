import { GLOBALPROTECT_HELP_URL } from "../../shared/nu-hosts";

export const CAESAR_CONNECTION_LABEL = "Can’t reach CAESAR";
export const CAESAR_CONNECTION_MESSAGE =
  `${CAESAR_CONNECTION_LABEL}. If you’re off campus, connect to Northwestern’s GlobalProtect VPN and try again.`;

export class CaesarConnectionError extends Error {
  constructor() {
    super(CAESAR_CONNECTION_MESSAGE);
    this.name = "CaesarConnectionError";
  }
}

// CAESAR answered an action with its home page: the request named a window
// or page state it does not recognise. Never read that as "no results".
export class CaesarWrongPageError extends Error {
  constructor() {
    super("CAESAR sent its home page instead of an answer. Try again.");
    this.name = "CaesarWrongPageError";
  }
}

export function caesarConnectionToastOptions() {
  return {
    tone: "warn" as const,
    durationMs: 15_000,
    action: {
      label: "VPN setup",
      run: () => { window.open(GLOBALPROTECT_HELP_URL, "_blank", "noopener,noreferrer"); }
    }
  };
}
