// ctec-links augmentation — composes `createPsCellGridRuntime` (Wave 4) for
// the page-id check, header/cell injection, and in-flight tracking. The
// fetch / cache / toast / progress-callback choreography stays here.

import type { Augmentation } from "../../framework";
import {
  createPsCellGridRuntime,
  isRetryablePeopleSoftTaskError
} from "../../peoplesoft";
import { showToast } from "../../../shared/toast";
import {
  CLASS_LINK_SELECTOR,
  CLASS_ROW_SELECTOR,
  CTEC_CELL_CLASS,
  CTEC_HEADER_CLASS,
  PAGE_ID,
  STYLE_ID
} from "./constants";
import { isCtecAccessDenied } from "../../ctec-index/access";
import { fetchCtecLinks, getCtecLinksFromCache } from "./fetcher";
import {
  extractInstructorFromRow,
  extractSubjectAndCatalog,
  isDisabledClassRow
} from "./helpers";
import {
  buildCtecCreditToastMessage,
  CTEC_ERROR_TOAST_MESSAGE,
  formatCtecCreditsWarning,
  tryConsumeCtecCredit
} from "./rate-limit";
import type { CtecLinkData, CtecLinkParams } from "./types";
import {
  CTEC_LINKS_STYLES,
  renderCtecLinksWidget,
  renderDisabled,
  renderFetchButton,
  renderLoading,
  renderNoAccess
} from "./ui";

export class CtecLinksAugmentation implements Augmentation {
  readonly id = "ctec-links";

  // Holds the per-row params resolved by `keyForRow`. Threaded into the
  // fetch closure so we don't re-extract them mid-flight if the row
  // scaffold gets re-rendered by PeopleSoft.
  private readonly paramsByKey = new Map<string, CtecLinkParams>();

  private readonly runtime = createPsCellGridRuntime<CtecLinkData, string>({
    id: "ctec-links",
    pageId: PAGE_ID,
    gridRowSelector: CLASS_ROW_SELECTOR,
    columns: [
      { cellClass: CTEC_CELL_CLASS, headerClass: CTEC_HEADER_CLASS, label: "CTEC" }
    ],
    styleId: STYLE_ID,
    styles: CTEC_LINKS_STYLES,

    keyForRow: (row) => {
      const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
      if (!link) return null;
      const parsed = extractSubjectAndCatalog(link.textContent ?? "");
      if (!parsed) return null;
      const instructor = extractInstructorFromRow(row as HTMLTableRowElement);
      const params: CtecLinkParams = {
        subject: parsed.subject,
        catalogNumber: parsed.catalogNumber,
        instructor
      };
      const key = `${params.subject}:${params.catalogNumber}:${params.instructor.toLowerCase().trim()}`;
      this.paramsByKey.set(key, params);
      return key;
    },

    render: {
      idle: (ctx, controls) => {
        const cell = ctx.cells[0]!;
        if (isCtecAccessDenied()) {
          renderNoAccess(cell);
          return;
        }
        if (isDisabledClassRow(ctx.row)) {
          renderDisabled(cell);
          return;
        }
        const params = this.paramsByKey.get(ctx.key);
        const cached = params ? getCtecLinksFromCache(params) : null;
        if (cached) {
          // Cache short-circuit — render the widget directly without
          // visiting the fetch path or toast path.
          controls.renderSuccess(cached);
          return;
        }
        renderFetchButton(cell, () => controls.fetch());
      },
      loading: (ctx) => {
        renderLoading(ctx.cells[0]!);
      },
      success: (ctx, data, controls) => {
        renderCtecLinksWidget(ctx.cells[0]!, data, () => controls.fetch());
      },
      error: (ctx, err, controls) => {
        const message = err instanceof Error ? err.message : "Unknown error";
        renderCtecLinksWidget(
          ctx.cells[0]!,
          { state: "error", message },
          () => controls.fetch()
        );
      }
    },

    fetch: async ({ key, doc, row }) => {
      const params = this.paramsByKey.get(key);
      if (!params) throw new Error("ctec-links: lost params for key " + key);

      const credit = tryConsumeCtecCredit(Date.now(), "ctec-links-cart");
      if (!credit.ok) {
        showToast(buildCtecCreditToastMessage(credit.waitMs), {
          tone: "warn",
          durationMs: 6000
        });
        // Retryable rejection: drop back to idle without showing error UI.
        throw new RateLimitedError();
      }

      const cell = (row.querySelector<HTMLElement>(`.${CTEC_CELL_CLASS}`) ??
        row) as HTMLElement;

      let data: CtecLinkData;
      try {
        data = await fetchCtecLinks(params, (msg) => {
          renderLoading(cell, msg);
        });
      } catch (err) {
        if (isRetryablePeopleSoftTaskError(err)) {
          // Retryable PS errors propagate — the runtime will swap back to
          // idle and re-paint the fetch button.
          throw err;
        }
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        throw err;
      }

      if (data.state === "error") {
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      } else {
        const warning = formatCtecCreditsWarning();
        if (warning) {
          showToast(`Loaded CTEC. ${warning}.`, { tone: "warn", durationMs: 5000 });
        }
      }

      // Make sure cell visibility is preserved for the runtime — return the
      // data; runtime will paint via render.success.
      void doc;
      return data;
    },

    retryable: (err) =>
      isRetryablePeopleSoftTaskError(err) || err instanceof RateLimitedError
  });

  cleanup(doc?: Document): void {
    this.paramsByKey.clear();
    this.runtime.cleanup(doc);
  }

  run(doc?: Document): void {
    this.runtime.run(doc);
  }
}

class RateLimitedError extends Error {
  constructor() {
    super("Rate limited");
    this.name = "RateLimitedError";
  }
}

