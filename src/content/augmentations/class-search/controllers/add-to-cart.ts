// Add-to-Cart click handler. Drives the full "user clicks Add → in their
// CAESAR shopping cart" UI flow: button state transitions, PS credit
// consumption, optimistic cart-cache writes, success / error / needs-related
// toasts, and recursion through the related-component picker. Network work
// (search → select → next) lives in `caesar-search/flow.ts`.
//
// Extracted from augmentation.ts (Wave 5d). The controller is constructed
// once at mount and called per-click via `onClick(button, ctx)`. The ctx
// carries everything that varies per click (the section row, the live-data
// store mirror) so the controller itself is stateless across clicks.

import type { CartEntry } from "../../../cart-cache";
import type {
  CaesarCourseGroup,
  CartFlowResult,
  RelatedSectionOption
} from "../caesar-search";
import {
  addSectionToCart,
  continueCartAddWithRelated,
  isCaesarAuthRequiredError
} from "../caesar-search";
import { bareCatalogNumber, formatCourseIdForDisplay } from "../catalog-format";
import type { PaperSection } from "../paper-data";
import type { ResultRow } from "../types";
import type { showToast as ShowToastFn } from "../../../../shared/toast";
import type { AuthRecovery } from "../auth-recovery";
import { withAuthRecovery } from "../auth-recovery";

export type AddToCartContext = {
  /** Term id (STRM). */
  termId: string;
  /** CAESAR institution code (e.g. "NWUNV"). */
  institution: string;
  /** Course + sections payload from the search result. */
  row: ResultRow;
  /** The section the user clicked Add on. */
  section: PaperSection;
  /**
   * Resolve the CAESAR class number for `(row, section)` using the
   * augmentation's three-tier cache (memory → disk → fetch). Returns
   * null on any failure (toast already shown by the augmentation).
   */
  resolveClassNumber(): Promise<string | null>;
  /**
   * Fold a class-number search response into the live-data cache and
   * repaint the course card so the row's live-status badge updates
   * without a follow-up Load CAESAR call.
   */
  mergeAndRepaint(searchGroups: CaesarCourseGroup[]): void;
  /** Switch the augmentation to the Classic CAESAR tab. */
  openClassicTab(): void;
};

export interface AddToCartController {
  onClick(button: HTMLButtonElement, ctx: AddToCartContext): Promise<void>;
}

export type AddToCartDeps = {
  authRecovery: AuthRecovery;
  /** Per-action PS credit gate. Returns `true` when a credit was consumed. */
  consumeCredit(owner: string): boolean;
  /**
   * Format the "X of Y left, limit resets in N min" trailing string for the
   * success toast. Returns null when usage is below the warning threshold.
   */
  formatPsWarning(): string | null;
  /** Toast emitter (typically `showToast` from `shared/toast`). */
  showToast: typeof ShowToastFn;
  /** Optimistic cart-cache writer. */
  recordOptimisticAdd(termId: string, entry: CartEntry): void;
  /** Cart-add network call. */
  addSectionToCart: typeof addSectionToCart;
  /** Cart-add continuation after a related-component pick. */
  continueCartAddWithRelated: typeof continueCartAddWithRelated;
  /**
   * Open the related-component picker. Resolves with the chosen option or
   * null when the user cancels. Called when CAESAR returns a `needsRelatedSection`
   * payload. The button is forwarded so the picker can anchor under the
   * matching section <li> (`button.closest('li.bc-cs-section')`).
   */
  openRelatedPicker(
    button: HTMLButtonElement,
    options: RelatedSectionOption[],
    ctx: AddToCartContext
  ): Promise<RelatedSectionOption | null>;
  /**
   * Tear down any open related-picker UI. Called after the post-pick
   * continuation finishes (success OR error path) so the picker `<li>`
   * doesn't linger showing "Adding…" forever. No-op when no picker is open.
   */
  closeRelatedPicker(): void;
  /** "View cart" action target — assigned to `window.location` on click. */
  cartUrl: string;
  /** window.location.assign indirection — defaults to the real one. */
  navigate?: (url: string) => void;
};

export function createAddToCartController(deps: AddToCartDeps): AddToCartController {
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));

  // The handleResult flow can recurse through itself when CAESAR serves a
  // chained related-section picker after the user picked the first one.
  // Hoisted so onClick + the chained branch both call the same closure.
  async function handleResult(
    button: HTMLButtonElement,
    ctx: AddToCartContext,
    result: CartFlowResult
  ): Promise<void> {
    if (result.ok) {
      finalizeSuccess(button, ctx, result.classNumber, undefined);
      return;
    }

    if ("needsRelatedSection" in result) {
      // CAESAR is asking the user to pick a discussion/lab/recitation
      // before the cart-add can finalize. Hand off to the picker; on a
      // non-null pick, run the continuation and recurse so a chained
      // picker (rare but possible) keeps the wizard moving.
      button.dataset.state = "needs-related";
      button.textContent = "Pick section…";
      button.disabled = true;

      const picked = await deps.openRelatedPicker(button, result.relatedOptions, ctx);
      if (!picked) {
        // User cancelled — restore idle.
        button.dataset.state = "";
        button.textContent = "Add to cart";
        button.disabled = false;
        return;
      }

      if (!deps.consumeCredit("related-pick")) return;
      button.textContent = "Adding…";

      const continued = await deps.continueCartAddWithRelated({
        continuationFormState: result.continuationFormState,
        selectedRowIndex: picked.rowIndex,
        classNumber: result.classNumber,
        sectionLabel: result.sectionLabel,
        courseTitle: result.courseTitle,
        searchGroups: result.searchGroups
      });

      if (continued.ok) {
        finalizeSuccess(button, ctx, continued.classNumber, picked);
      } else if ("needsRelatedSection" in continued) {
        // Tear down the current picker before recursing — the recursive
        // `handleResult` will open a fresh one for the chained options.
        deps.closeRelatedPicker();
        await handleResult(button, ctx, continued);
      } else {
        // Continuation failed: drop the picker UI so the user isn't stuck
        // staring at "Adding…" while the section row shows the error.
        deps.closeRelatedPicker();
        button.dataset.state = "error";
        button.textContent = "Try again";
        button.disabled = false;
        deps.showToast(continued.error ?? "Couldn't add to cart.", {
          tone: "error",
          durationMs: 6000
        });
      }
      return;
    }

    if (result.alreadyInCart) {
      // Friendlier UX: show the button as already-handled and surface a
      // pointer to the cart instead of a generic error.
      button.dataset.state = "in-cart";
      button.textContent = "In cart";
      button.disabled = true;
      if (result.classNumber) {
        deps.recordOptimisticAdd(ctx.termId, {
          classNumber: result.classNumber,
          subject: ctx.row.course.subject,
          catalog: ctx.row.course.catalog,
          sectionLabel: `${ctx.section.section}-${ctx.section.component}`,
          capturedAt: Date.now()
        });
      }
      const warning = deps.formatPsWarning();
      const suffix = warning ? ` ${warning}.` : "";
      deps.showToast(
        `${formatCourseIdForDisplay(ctx.row.course.subject, ctx.row.course.catalog)} ${ctx.section.section}-${ctx.section.component} is already in your shopping cart.${suffix}`,
        {
          tone: "info",
          durationMs: 5000,
          action: {
            label: "View cart",
            run: () => navigate(deps.cartUrl)
          }
        }
      );
      return;
    }

    button.dataset.state = "error";
    button.textContent = "Try again";
    button.disabled = false;
    const needsClassicFallback = /extra confirmation|preferences|related component/i.test(
      result.error ?? ""
    );
    deps.showToast(result.error ?? "Couldn't add to cart.", {
      tone: "error",
      durationMs: 6000,
      action: needsClassicFallback
        ? {
            label: "Open Classic",
            run: () => ctx.openClassicTab()
          }
        : undefined
    });
  }

  function finalizeSuccess(
    button: HTMLButtonElement,
    ctx: AddToCartContext,
    classNumber: string,
    pickedRelated: RelatedSectionOption | undefined
  ): void {
    // Direct-add path historically used "in-cart" + "In cart"; the
    // post-related-pick path used "success" + "Added ✓". Keep both so
    // visual / accessibility regressions can't sneak in.
    if (pickedRelated) {
      button.dataset.state = "success";
      button.textContent = "Added ✓";
      // Tear down the picker UI now that the continuation has resolved —
      // before Wave 5d this happened inside `handleRelatedPick` after the
      // continuation; we restore that lifecycle here so the picker doesn't
      // linger showing "Adding…".
      deps.closeRelatedPicker();
    } else {
      button.dataset.state = "in-cart";
      button.textContent = "In cart";
    }
    button.disabled = true;

    // Record the optimistic add on BOTH the direct-add and post-pick
    // success paths. The pre-Wave-5d code only recorded direct adds — that
    // was a latent bug: the cart-cache should reflect every successful add,
    // not just direct ones. Locked in by `add-to-cart.spec.ts`.
    deps.recordOptimisticAdd(ctx.termId, {
      classNumber,
      subject: ctx.row.course.subject,
      catalog: ctx.row.course.catalog,
      sectionLabel: `${ctx.section.section}-${ctx.section.component}`,
      capturedAt: Date.now()
    });

    const warning = deps.formatPsWarning();
    const suffix = warning ? ` ${warning}.` : "";
    const courseId = formatCourseIdForDisplay(ctx.row.course.subject, ctx.row.course.catalog);
    const sectionLabel = `${ctx.section.section}-${ctx.section.component}`;
    const message = pickedRelated
      ? `Added ${courseId} ${sectionLabel} with section ${pickedRelated.section} to your shopping cart.${suffix}`
      : `Added ${courseId} ${sectionLabel} to your shopping cart.${suffix}`;
    deps.showToast(message, {
      tone: "success",
      durationMs: 6000,
      action: {
        label: "View cart",
        run: () => navigate(deps.cartUrl)
      }
    });
  }

  return {
    async onClick(button, ctx): Promise<void> {
      // The button state machine doubles as a re-entry guard. Bounce any
      // click that lands while a previous chain is mid-flight (loading,
      // mid-pick) or already terminal (success/in-cart/enrolled). This
      // matters even though `button.disabled = true` is set synchronously
      // on the first click: rapid double-clicks before the browser hop
      // can hit the same listener twice in the same task tick, and
      // cart-cache repaints could in principle drop disabled mid-flight.
      const guarded = new Set([
        "loading",
        "needs-related",
        "success",
        "in-cart",
        "enrolled"
      ]);
      if (guarded.has(button.dataset.state ?? "")) return;

      // One credit covers the whole click — including any internal live-data
      // load needed before the cart-add chain can resolve the class number.
      if (!deps.consumeCredit("add")) return;

      // Lock the UI synchronously, before the first await, so a rapid
      // re-click on the same task tick is filtered both by the
      // `guarded.has(...)` early-return above AND by the browser's
      // disabled-button click filter.
      button.disabled = true;
      button.dataset.state = "loading";
      button.textContent = "Loading…";

      const classNumber = await ctx.resolveClassNumber();
      if (!classNumber) {
        button.dataset.state = "error";
        button.textContent = "Add to cart";
        button.disabled = false;
        deps.showToast("Couldn't resolve the CAESAR class number for this section.", {
          tone: "error"
        });
        return;
      }

      button.textContent = "Adding…";

      const result = await withAuthRecovery(deps.authRecovery, isCaesarAuthRequiredError, () =>
        deps.addSectionToCart({
          classNumber,
          termId: ctx.termId,
          institution: ctx.institution,
          bareCatalog: bareCatalogNumber(ctx.row.course.catalog)
        })
      );

      if (!result) {
        // Auth recovery toast already explained why; just reset the button so
        // the user can re-trigger once they've completed sign-in.
        button.dataset.state = "idle";
        button.textContent = "Add to cart";
        button.disabled = false;
        return;
      }

      // Side effect: fold the class-number search response into the live
      // cache so the row's status badge paints without a Load CAESAR call.
      const searchGroups = "searchGroups" in result ? result.searchGroups : undefined;
      if (searchGroups && searchGroups.length > 0) {
        ctx.mergeAndRepaint(searchGroups);
      }

      await handleResult(button, ctx, result);
    }
  };
}
