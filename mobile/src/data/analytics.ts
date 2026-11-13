// The CTEC analytics sheet: the extension's own sheet, controller and data
// loading, hosted inside the app.
import { fetchCtecCourseAnalytics } from "@ext/content/augmentations/ctec-links/reports";
import { ModalController } from "@ext/content/augmentations/paper-ctec/modal-controller";
import type {
  AnalyticsModalSource,
  PaperCtecAnalyticsState,
  PaperCtecWidgetData
} from "@ext/content/augmentations/paper-ctec/types";
import { withSignIn } from "../platform/sign-in";

export type { AnalyticsModalSource };

const state = {
  resolved: new Map<string, PaperCtecWidgetData>(),
  inFlight: new Map<string, Promise<PaperCtecWidgetData | null>>(),
  analyticsResolved: new Map<string, PaperCtecAnalyticsState>(),
  analyticsInFlight: new Map<string, Promise<PaperCtecAnalyticsState>>(),
  loadingMessages: new Map<string, { message: string; updatedAt: number }>()
};

let controller: ModalController | null = null;
function sheet(): ModalController {
  controller ??= new ModalController(state, {
    setProgress: (key, message) => state.loadingMessages.set(key, { message, updatedAt: Date.now() }),
    syncStatusBar: () => undefined,
    syncSideCard: () => undefined,
    renderForKey: () => undefined,
    fetchAnalytics: (...args) => withSignIn(() => fetchCtecCourseAnalytics(...args)),
    // The catalog already carries instructors' full names.
    enrichParams: (params) => Promise.resolve(params)
  });
  return controller;
}

// Draws the sheet inside `host`, which does the scrolling.
export function openAnalytics(source: AnalyticsModalSource, host: HTMLElement): void {
  sheet().setHost(host);
  sheet().openModal(source);
}

export function closeAnalytics(): void {
  controller?.closeModal();
  controller?.setHost(null);
}
