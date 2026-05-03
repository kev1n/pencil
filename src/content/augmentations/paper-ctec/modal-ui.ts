// Compatibility re-export shim. The modal implementation lives in modal/,
// split by section: types + common helpers + header + overview + charts +
// comments + terms + a small index that orchestrates renderAnalyticsModal
// and the no-data status body.
export {
  hideAnalyticsModal,
  readModalCommentsQuery,
  renderAnalyticsModal
} from "./modal";
export type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState,
  ModalCommentSentimentFilter,
  ModalCommentSort,
  ModalRefreshFlash,
  ModalTab
} from "./modal/types";
