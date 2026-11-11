// Analytics sheet subsystem barrel.
//
//  - ModalView (createModalView): the docked side sheet.
//  - ModalDataController (createModalDataController): owns CTEC fetch loops
//    and the refresh-flash auto-dismiss timer.

export { createModalView } from "./view";
export type { ModalView, ModalViewDeps } from "./view";

export { createModalDataController } from "./data-controller";
export type {
  ModalDataController,
  ModalDataControllerDeps
} from "./data-controller";

export { COMMENTS_PAGE_SIZE } from "./types";
export type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState,
  ModalCommentSentimentFilter,
  ModalRefreshFlash
} from "./types";
