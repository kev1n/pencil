// Cart-card detail panel controller — mirrors `section-detail-controller`
// but for the empty-state "Your classes" view (`my-classes-view.ts`).
//
// Cart entries already carry the CAESAR class number (read from the cart
// page or written optimistically by Sharper Search's add flow), so this
// controller skips the catalog-search round-trip the section-row flow
// needs and goes straight to `lookupClass`. The rendered detail panel
// reuses `renderSectionDetail`, so the seat stats / capacity bar /
// class-attributes blocks read identically across both surfaces.
//
// Both Enrolled and In your cart entries flow through the same view
// (`my-classes-view.ts → renderCard`) and therefore through this
// controller — wiring it once covers both.
//
// Inserts a sibling `<li class="bc-cs-detail-row">` into the section
// list (the same shape the search-result detail panel uses) so the panel
// styling carried by `styles/detail.ts` applies without per-surface
// overrides.

import { isRetryablePeopleSoftTaskError, lookupClass } from "../../../peoplesoft";
import { showToast } from "../../../../shared/toast";
import {
  formatPsCreditsWarning,
  readCachedEntry as readSeatsNotesCache,
  writeCachedEntry as writeSeatsNotesCache
} from "../../seats-notes/storage";
import {
  toSeatsNotesResult,
  toFailure as seatsNotesFailure
} from "../../seats-notes/parser";
import type { CartEntry } from "../../../cart-cache";
import { bareCatalogNumber } from "../catalog-format";
import {
  renderSectionDetail,
  renderSectionDetailLoading,
  type SectionDetailData
} from "../views/section-detail";
import { paintButtonLoading } from "../views/section-row";

import { isGradCatalog } from "./section-detail-controller";

export interface CartCardDetailsController {
  /**
   * Toggle the inline detail panel under a cart-card section row.
   * On open: cache-warm fast-path if seats-notes has the data; otherwise
   * consume a PS credit, paint a loading shell, fetch, render. On close:
   * remove the sibling detail row.
   */
  toggle(
    entry: CartEntry,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): Promise<void>;
  /**
   * Auto-open the panel when the seats-notes cache is already warm.
   * Used by the renderer to pre-expand cards whose seats are cached on
   * the very first paint. Returns true when the panel was mounted.
   * No-op on cache miss, on missing class number, and when the panel is
   * already open under `li`.
   */
  openIfCached(
    entry: CartEntry,
    li: HTMLLIElement,
    button: HTMLButtonElement
  ): boolean;
}

export type CartCardDetailsDeps = {
  doc: Document;
  /** Consume a PS credit. Returns true on success, false (and toasts)
   *  when the budget is exhausted. */
  consumePsCredit(owner: string): boolean;
  /** Active term (STRM) — threaded into `lookupClass`. */
  getTermId(): string;
};

export function createCartCardDetailsController(
  deps: CartCardDetailsDeps
): CartCardDetailsController {
  const { doc } = deps;

  function renderResolved(
    detailRow: HTMLLIElement,
    entry: CartEntry,
    result: SectionDetailData,
    fetchedAt: number
  ): void {
    detailRow.innerHTML = "";
    detailRow.appendChild(
      renderSectionDetail(doc, {
        detail: result,
        fetchedAt,
        onRefresh: () => {
          if (!deps.consumePsCredit("cart-card-refresh")) return;
          void runFetch(detailRow, entry);
        }
      })
    );
  }

  function tryRenderFromCache(
    detailRow: HTMLLIElement,
    entry: CartEntry
  ): boolean {
    if (!entry.classNumber) return false;
    const cached = readSeatsNotesCache(entry.classNumber);
    if (!cached?.result) return false;
    renderResolved(detailRow, entry, cached.result, cached.fetchedAt);
    return true;
  }

  async function runFetch(
    detailRow: HTMLLIElement,
    entry: CartEntry
  ): Promise<void> {
    if (!entry.classNumber) return;
    detailRow.innerHTML = "";
    detailRow.appendChild(renderSectionDetailLoading(doc));
    try {
      const careerHint = isGradCatalog(bareCatalogNumber(entry.catalog))
        ? "TGS"
        : "UGRD";
      const lookupResponse = await lookupClass(
        {
          type: "lookup-class",
          classNumber: entry.classNumber,
          careerHint,
          termId: deps.getTermId()
        },
        {
          priority: "background",
          owner: "class-search-myclass-detail",
          label: `Load cart-card details for class ${entry.classNumber}`
        }
      );
      const result = toSeatsNotesResult(lookupResponse);
      const fetchedAt = Date.now();
      writeSeatsNotesCache(entry.classNumber, { result, fetchedAt });
      if (detailRow.isConnected || detailRow.parentNode) {
        renderResolved(detailRow, entry, result, fetchedAt);
      }
      const warning = formatPsCreditsWarning(fetchedAt);
      if (warning) {
        const verb = result.ok ? "Loaded" : "Tried";
        showToast(`${verb} class detail. ${warning}.`, {
          tone: "warn",
          durationMs: 5000
        });
      }
    } catch (error) {
      if (isRetryablePeopleSoftTaskError(error)) return;
      if (detailRow.parentNode) {
        renderResolved(detailRow, entry, seatsNotesFailure(error), Date.now());
      }
    }
  }

  function findOpenDetailRow(li: HTMLLIElement): HTMLLIElement | null {
    return li.nextElementSibling instanceof HTMLLIElement &&
      li.nextElementSibling.classList.contains("bc-cs-detail-row")
      ? (li.nextElementSibling as HTMLLIElement)
      : null;
  }

  function mountDetailRow(li: HTMLLIElement): HTMLLIElement {
    const detailRow = doc.createElement("li");
    detailRow.className = "bc-cs-detail-row";
    li.parentElement?.insertBefore(detailRow, li.nextSibling);
    return detailRow;
  }

  function setExpanded(button: HTMLButtonElement): void {
    button.dataset.expanded = "true";
    button.dataset.state = "expanded";
    button.disabled = false;
    button.textContent = "Hide";
  }

  function setIdle(
    button: HTMLButtonElement,
    detailRow: HTMLLIElement | null
  ): void {
    if (detailRow?.parentNode) detailRow.parentNode.removeChild(detailRow);
    button.dataset.expanded = "false";
    button.dataset.state = "";
    button.disabled = false;
    button.textContent = "Details";
  }

  return {
    openIfCached(entry, li, button) {
      if (findOpenDetailRow(li)) return false;
      if (!entry.classNumber) return false;
      const detailRow = mountDetailRow(li);
      if (!tryRenderFromCache(detailRow, entry)) {
        detailRow.remove();
        return false;
      }
      setExpanded(button);
      return true;
    },

    async toggle(entry, li, button) {
      // Re-entry guard — must precede the open-row check so a click that
      // lands while the loading shell is still resolving doesn't tear
      // down the in-flight fetch.
      if (button.dataset.state === "loading") return;

      const open = findOpenDetailRow(li);
      if (open) {
        setIdle(button, open);
        return;
      }

      if (!entry.classNumber) {
        showToast("This class is missing a CAESAR class number.", {
          tone: "warn"
        });
        return;
      }

      // Sync-disable the button + paint the loading shell synchronously
      // so the user sees instant feedback (cold-cache CAESAR fetches can
      // take a few seconds).
      button.dataset.state = "loading";
      button.disabled = true;
      paintButtonLoading(doc, button, "Loading…");

      const detailRow = mountDetailRow(li);
      detailRow.appendChild(renderSectionDetailLoading(doc));

      // Cache-warm fast path — render synchronously without consuming a
      // PS credit. Re-paint over the loading shell.
      if (tryRenderFromCache(detailRow, entry)) {
        setExpanded(button);
        return;
      }

      if (!deps.consumePsCredit("cart-card-details")) {
        setIdle(button, detailRow);
        return;
      }

      try {
        await runFetch(detailRow, entry);
        if (!detailRow.parentNode) return;
        setExpanded(button);
      } catch (error) {
        setIdle(button, detailRow);
        if (!isRetryablePeopleSoftTaskError(error)) {
          const msg = error instanceof Error ? error.message : String(error);
          showToast(msg || "Could not load class detail.", {
            tone: "error",
            durationMs: 5000
          });
        }
      }
    }
  };
}
