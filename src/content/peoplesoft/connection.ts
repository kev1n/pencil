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
