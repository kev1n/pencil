import { registerPlugin } from "@capacitor/core";

export type NativeResponse = {
  ok: boolean;
  status?: number;
  text?: string;
  base64?: string;
  contentType?: string;
  finalUrl?: string;
  error?: string;
  connectionFailed?: boolean;
};

// The native half of the app: Northwestern's sign-in pages in a web view,
// and an HTTP session that carries the cookies those pages leave behind.
// Everything stays on the phone.
type Session = {
  signIn(options: {
    url: string;
    title?: string;
    doneUrlPattern?: string;
    // Start CAESAR's page session over from a request that claims a desktop
    // browser, so CAESAR serves the layout the parsers know.
    resetPeopleSoft?: boolean;
  }): Promise<{ completed: boolean; finalUrl: string }>;
  request(options: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    timeoutMs?: number;
    binary?: boolean;
  }): Promise<NativeResponse>;
  status(): Promise<{ hasCaesarSession: boolean }>;
  signOut(): Promise<void>;
  // Drops one site's cookies; the rest of the sign-in stays.
  forgetSite(options: { host: string }): Promise<void>;
  debugRoute(): Promise<{ route: string }>;
  // The plan link the app was opened with, once (see data/share.ts).
  launchLink(): Promise<{ url: string }>;
};

// The Mac app (mobile/mac) has no Capacitor: its window answers the same
// calls through one message handler.
type MacHandler = { postMessage(message: { method: string; options: unknown }): Promise<unknown> };
const mac = (window as unknown as { webkit?: { messageHandlers?: { pencil?: MacHandler } } }).webkit?.messageHandlers?.pencil;

// True for every desktop shell: the Mac app, and the Windows and Linux app
// (mobile/desktop), which answers through a handler of the same shape.
export const isMac = mac !== undefined;
// What the app calls the thing it runs on.
export const device = isMac ? ((window as unknown as { pencilDevice?: string }).pencilDevice ?? "Mac") : "phone";

export const NUSession: Session = mac
  ? (new Proxy({}, {
      get: (_target, method: string) => (options?: unknown) => mac.postMessage({ method, options: options ?? {} })
    }) as Session)
  : registerPlugin<Session>("NUSession");
