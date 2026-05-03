import type { ModalDisplayData } from "../modal-data";
import { preventAndStop, stopPropagation } from "../ui-shared";
import type {
  AnalyticsModalCallbacks,
  AnalyticsModalInput,
  AnalyticsModalState,
  ModalRefreshFlash,
  ModalTab
} from "./types";

// Modal header: close button, identity row (title + meta strip + actions),
// optional refresh-flash banner, optional tab strip. The tab strip only
// appears when data is loaded — otherwise the body shows a status card.
export function renderHeader(
  doc: Document,
  input: AnalyticsModalInput,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const header = doc.createElement("header");
  header.className = "bc-paper-ctec-modal-header";

  const close = doc.createElement("button");
  close.type = "button";
  close.className = "bc-paper-ctec-modal-close";
  close.setAttribute("aria-label", "Close");
  close.textContent = "✕";
  close.addEventListener("click", (event) => {
    preventAndStop(event);
    callbacks.onClose();
  });
  header.append(close);

  const identityRow = doc.createElement("div");
  identityRow.className = "bc-paper-ctec-modal-identity";

  const identityLeft = doc.createElement("div");

  const title = doc.createElement("h1");
  title.className = "bc-paper-ctec-modal-title";
  title.textContent =
    input.identity.title || `${input.identity.subject} ${input.identity.catalog}`;
  identityLeft.append(title);

  const meta = doc.createElement("div");
  meta.className = "bc-paper-ctec-modal-meta";

  const code = doc.createElement("span");
  code.className = "bc-paper-ctec-modal-code";
  code.textContent = `${input.identity.subject} ${input.identity.catalog}`;
  meta.append(code);

  appendMetaItem(doc, meta, input.identity.instructor, input.identity.sectionTerm);
  if (input.data) {
    appendMetaItem(
      doc,
      meta,
      `${input.data.terms.length} ${input.data.terms.length === 1 ? "term" : "terms"}`,
      `${input.data.responses} responses`
    );
  }
  identityLeft.append(meta);
  identityRow.append(identityLeft);

  // Right side: Refresh + Load-more + Open-original-report. These are the
  // controls that used to live in the side panel; they're now part of the
  // modal header so the analytics view is self-contained.
  const actions = doc.createElement("div");
  actions.className = "bc-paper-ctec-modal-actions";

  if (input.canRefresh) {
    const refresh = doc.createElement("button");
    refresh.type = "button";
    refresh.className = "bc-paper-ctec-modal-action-btn bc-paper-ctec-modal-action-refresh";
    refresh.disabled = input.backgroundRefreshing;
    refresh.textContent = input.backgroundRefreshing
      ? "Checking Northwestern…"
      : "↻ Check for new CTECs";
    refresh.title =
      "Asks Northwestern for any newly-published evaluations for this course and adds them to your view. Runs in the background — your existing data and analytics stay visible the entire time. Useful when CTECs from a recent term should be available but haven't appeared yet (they often arrive weeks after the term ends).";
    refresh.addEventListener("click", (event) => {
      preventAndStop(event);
      if (refresh.disabled) return;
      callbacks.onRefresh();
    });
    actions.append(refresh);
  }

  if (input.canLoadMore || input.loading) {
    const loadMore = doc.createElement("button");
    loadMore.type = "button";
    loadMore.className = "bc-paper-ctec-modal-action-btn bc-paper-ctec-modal-action-loadmore";
    loadMore.disabled = input.loading || !input.canLoadMore;
    const batch =
      input.remainingTerms > 0
        ? Math.min(input.loadMoreBatchSize, input.remainingTerms)
        : input.loadMoreBatchSize;
    loadMore.textContent = input.loading
      ? `Loading +${batch}…`
      : `+ ${batch} more term${batch === 1 ? "" : "s"}${
          input.remainingTerms > 0 ? ` (${input.remainingTerms} left)` : ""
        }`;
    loadMore.title = `${input.parsedTermCount} loaded · ${input.remainingTerms} remaining. CTEC term reports load on demand to keep traffic on Northwestern's servers low.`;
    loadMore.addEventListener("click", (event) => {
      preventAndStop(event);
      if (loadMore.disabled) return;
      callbacks.onLoadMore();
    });
    actions.append(loadMore);
  }

  if (input.data?.course.reportUrl) {
    const link = doc.createElement("a");
    link.className = "bc-paper-ctec-modal-report-link";
    link.href = input.data.course.reportUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "↗ Open original CTEC report";
    link.addEventListener("click", stopPropagation);
    actions.append(link);
  }

  if (actions.childElementCount > 0) {
    identityRow.append(actions);
  }
  header.append(identityRow);

  if (input.refreshFlash) {
    header.append(renderRefreshFlash(doc, input.refreshFlash, callbacks));
  }

  if (input.data) {
    header.append(renderTabs(doc, state, callbacks, input.data));
  }
  return header;
}

function renderRefreshFlash(
  doc: Document,
  flash: ModalRefreshFlash,
  callbacks: AnalyticsModalCallbacks
): HTMLElement {
  const banner = doc.createElement("div");
  banner.className = `bc-paper-ctec-modal-flash bc-paper-ctec-modal-flash-${flash.kind}`;
  banner.setAttribute("role", flash.kind === "success" ? "status" : "alert");

  const icon = doc.createElement("span");
  icon.className = "bc-paper-ctec-modal-flash-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent =
    flash.kind === "success" ? "✓" : flash.kind === "auth" ? "🔒" : "!";
  banner.append(icon);

  const text = doc.createElement("div");
  text.className = "bc-paper-ctec-modal-flash-text";

  const title = doc.createElement("strong");
  title.className = "bc-paper-ctec-modal-flash-title";
  const body = doc.createElement("span");
  body.className = "bc-paper-ctec-modal-flash-body";

  if (flash.kind === "success") {
    if (flash.addedCount > 0) {
      title.textContent =
        flash.addedCount === 1
          ? "1 new evaluation found"
          : `${flash.addedCount} new evaluations found`;
      body.textContent = "Newly-published CTECs were added to your view.";
    } else {
      title.textContent = "You're up to date";
      body.textContent = "Northwestern has no new CTECs for this course right now.";
    }
  } else if (flash.kind === "auth") {
    title.textContent = "Northwestern login required";
    body.textContent = "Sign in to CAESAR and try again.";
  } else {
    title.textContent = "Couldn't check for new CTECs";
    body.textContent = flash.message;
  }

  text.append(title, body);
  banner.append(text);

  if (flash.kind === "auth") {
    const action = doc.createElement("button");
    action.type = "button";
    action.className = "bc-paper-ctec-modal-flash-action";
    action.textContent = "Open login";
    action.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onLogin();
    });
    banner.append(action);
  }

  const dismiss = doc.createElement("button");
  dismiss.type = "button";
  dismiss.className = "bc-paper-ctec-modal-flash-dismiss";
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "✕";
  dismiss.addEventListener("click", (event) => {
    preventAndStop(event);
    callbacks.onDismissRefreshFlash();
  });
  banner.append(dismiss);

  return banner;
}

function appendMetaItem(
  doc: Document,
  meta: HTMLElement,
  primary: string,
  secondary: string
): void {
  const span = doc.createElement("span");
  const strong = doc.createElement("strong");
  strong.textContent = primary;
  span.append(strong, doc.createTextNode(secondary ? ` · ${secondary}` : ""));
  meta.append(span);
}

function renderTabs(
  doc: Document,
  state: AnalyticsModalState,
  callbacks: AnalyticsModalCallbacks,
  data: ModalDisplayData
): HTMLElement {
  const tabs = doc.createElement("div");
  tabs.className = "bc-paper-ctec-modal-tabs";

  const definitions: Array<{ id: ModalTab; label: string; count?: number }> = [
    { id: "overview", label: "Overview" },
    { id: "comments", label: "Comments", count: data.comments.length },
    { id: "terms", label: "Terms", count: data.terms.length }
  ];

  for (const definition of definitions) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `bc-paper-ctec-modal-tab${
      state.tab === definition.id ? " is-active" : ""
    }`;
    button.textContent = definition.label;
    if (definition.count != null) {
      const count = doc.createElement("span");
      count.className = "bc-paper-ctec-modal-tab-count";
      count.textContent = String(definition.count);
      button.append(count);
    }
    button.addEventListener("click", (event) => {
      preventAndStop(event);
      callbacks.onTabChange(definition.id);
    });
    tabs.append(button);
  }

  return tabs;
}
