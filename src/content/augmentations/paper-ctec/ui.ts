// Compatibility re-export shim. injectStyles now lives in styles/, and the
// schedule-card / side-card / auth-modal renderers each ship from their own
// module. Existing call sites that imported from "./ui" continue to work
// without churn.
export { injectStyles } from "./styles";
export { hideAuthModal, renderAuthModal } from "./auth-modal";
export {
  hideStatusBar,
  renderIdle,
  renderLoading,
  renderStatusBar,
  renderWidget
} from "./schedule-ui";
export { renderSideCardAnalytics } from "./analytics-ui";
