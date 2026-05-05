import { describe, expect, it, vi } from "vitest";

import {
  createAddToCartController,
  type AddToCartContext,
  type AddToCartDeps
} from "./add-to-cart";
import type { AuthRecovery } from "../auth-recovery";
import type {
  CaesarCourseGroup,
  CartFlowResult,
  RelatedSectionOption
} from "../caesar-search";
import { CaesarAuthRequiredError } from "../caesar-search";
import type { PaperSection, PaperTermCourse } from "../paper-data";
import type { ResultRow } from "../types";

function fresh(): Document {
  return document.implementation.createHTMLDocument("t");
}

function makeButton(doc: Document): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.textContent = "Add to cart";
  doc.body.appendChild(b);
  return b;
}

function makeRow(): ResultRow {
  const course = {
    subject: "COMP_SCI",
    catalog: "111-0",
    title: "Fundamentals"
  } as unknown as PaperTermCourse;
  return { course, sections: [] };
}

function makeSection(overrides: Partial<PaperSection> = {}): PaperSection {
  return {
    section: "20",
    component: "LEC",
    ...overrides
  } as unknown as PaperSection;
}

function makeAuthRecovery(): AuthRecovery {
  return {
    ensure: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn()
  };
}

function makeOption(overrides: Partial<RelatedSectionOption> = {}): RelatedSectionOption {
  return {
    rowIndex: 0,
    classNumber: "12345",
    section: "21",
    schedule: "TuTh 10:00-11:20",
    room: "Tech LR2",
    instructor: "Demaine",
    status: "Open",
    ...overrides
  };
}

function makeCtx(overrides: Partial<AddToCartContext> = {}): AddToCartContext {
  return {
    termId: "4750",
    institution: "NWUNV",
    row: makeRow(),
    section: makeSection(),
    resolveClassNumber: vi.fn().mockResolvedValue("12345"),
    mergeAndRepaint: vi.fn(),
    openClassicTab: vi.fn(),
    ...overrides
  };
}

function makeDeps(overrides: Partial<AddToCartDeps> = {}): AddToCartDeps {
  const groups: CaesarCourseGroup[] = [
    {
      courseId: "COMP_SCI 111-0",
      catalog: "111-0",
      title: "Fundamentals",
      sections: []
    }
  ];
  return {
    authRecovery: makeAuthRecovery(),
    consumeCredit: vi.fn().mockReturnValue(true),
    formatPsWarning: vi.fn().mockReturnValue(null),
    showToast: vi.fn(),
    recordOptimisticAdd: vi.fn(),
    addSectionToCart: vi.fn().mockResolvedValue({
      ok: true,
      classNumber: "12345",
      sectionLabel: "20-LEC",
      courseTitle: "Fundamentals",
      searchGroups: groups
    } as CartFlowResult),
    continueCartAddWithRelated: vi.fn(),
    openRelatedPicker: vi.fn().mockResolvedValue(null),
    closeRelatedPicker: vi.fn(),
    cartUrl: "/cart",
    navigate: vi.fn(),
    ...overrides
  };
}

describe("createAddToCartController — happy path", () => {
  it("idle → loading → in-cart on success, with optimistic write + success toast", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps();
    const ctx = makeCtx();
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, ctx);

    expect(deps.consumeCredit).toHaveBeenCalledWith("add");
    expect(deps.addSectionToCart).toHaveBeenCalledWith({
      classNumber: "12345",
      termId: "4750",
      institution: "NWUNV",
      bareCatalog: "111"
    });
    expect(button.dataset.state).toBe("in-cart");
    expect(button.textContent).toBe("In cart");
    expect(button.disabled).toBe(true);
    expect(deps.recordOptimisticAdd).toHaveBeenCalledWith("4750", expect.objectContaining({
      classNumber: "12345",
      subject: "COMP_SCI",
      catalog: "111-0",
      sectionLabel: "20-LEC"
    }));
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.stringContaining("Added COMP_SCI 111 20-LEC"),
      expect.objectContaining({ tone: "success" })
    );
  });

  it("merges searchGroups into the live-data cache so the row badge paints", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps();
    const ctx = makeCtx();
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, ctx);
    expect(ctx.mergeAndRepaint).toHaveBeenCalledTimes(1);
  });
});

describe("createAddToCartController — credit + auth gating", () => {
  it("credit-exhausted: no network call, button untouched", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps({ consumeCredit: vi.fn().mockReturnValue(false) });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(deps.addSectionToCart).not.toHaveBeenCalled();
    expect(button.dataset.state).toBeUndefined();
  });

  it("auth-required: triggers authRecovery and retries the flow", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const groups: CaesarCourseGroup[] = [];
    const successResult: CartFlowResult = {
      ok: true,
      classNumber: "12345",
      sectionLabel: "20-LEC",
      courseTitle: "Fundamentals",
      searchGroups: groups
    };
    // First call rejects with auth-required; second call (after recovery) succeeds.
    const addSpy = vi
      .fn()
      .mockRejectedValueOnce(new CaesarAuthRequiredError("https://example.org/login"))
      .mockResolvedValueOnce(successResult);
    const recovery = makeAuthRecovery();
    const deps = makeDeps({ addSectionToCart: addSpy, authRecovery: recovery });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());

    expect(recovery.ensure).toHaveBeenCalledWith("https://example.org/login");
    expect(addSpy).toHaveBeenCalledTimes(2);
    expect(button.dataset.state).toBe("in-cart");
  });

  it("does not double-fire when the button already shows in-cart", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    button.dataset.state = "in-cart";
    const deps = makeDeps();
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(deps.consumeCredit).not.toHaveBeenCalled();
    expect(deps.addSectionToCart).not.toHaveBeenCalled();
  });
});

describe("createAddToCartController — class-number resolution failure", () => {
  it("idle → error + toast when resolveClassNumber returns null", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps();
    const ctx = makeCtx({ resolveClassNumber: vi.fn().mockResolvedValue(null) });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, ctx);
    expect(deps.addSectionToCart).not.toHaveBeenCalled();
    expect(button.dataset.state).toBe("error");
    expect(button.disabled).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.stringContaining("Couldn't resolve"),
      expect.objectContaining({ tone: "error" })
    );
  });
});

describe("createAddToCartController — error / alreadyInCart", () => {
  it("error result: button shows Try again and a generic error toast fires", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        error: "CAESAR refused to add the class.",
        classNumber: "12345"
      } as CartFlowResult)
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(button.dataset.state).toBe("error");
    expect(button.textContent).toBe("Try again");
    expect(button.disabled).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith(
      "CAESAR refused to add the class.",
      expect.objectContaining({ tone: "error" })
    );
  });

  it("error mentioning related component surfaces an Open Classic action", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        error: "Section needs extra confirmation in CAESAR."
      } as CartFlowResult)
    });
    const ctx = makeCtx();
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, ctx);
    const call = (deps.showToast as ReturnType<typeof vi.fn>).mock.calls.at(-1);
    const opts = call?.[1];
    expect(opts.action.label).toBe("Open Classic");
    opts.action.run();
    expect(ctx.openClassicTab).toHaveBeenCalled();
  });

  it("alreadyInCart: paints in-cart and writes optimistic add when classNumber is present", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        error: "This class is already in your shopping cart.",
        alreadyInCart: true,
        classNumber: "12345"
      } as CartFlowResult)
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(button.dataset.state).toBe("in-cart");
    expect(button.textContent).toBe("In cart");
    expect(deps.recordOptimisticAdd).toHaveBeenCalled();
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.stringContaining("already in your shopping cart"),
      expect.objectContaining({ tone: "info" })
    );
  });
});

describe("createAddToCartController — needs-related → picker recursion", () => {
  it("opens picker, runs continuation on pick, finalizes success ('Added ✓')", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const groups: CaesarCourseGroup[] = [];
    const picked = makeOption({ rowIndex: 7, section: "30" });
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        needsRelatedSection: true,
        classNumber: "12345",
        sectionLabel: "20-LEC",
        courseTitle: "Algorithms",
        relatedOptions: [picked],
        continuationFormState: "ICSID=abc",
        searchGroups: groups
      } as CartFlowResult),
      continueCartAddWithRelated: vi.fn().mockResolvedValue({
        ok: true,
        classNumber: "12345",
        sectionLabel: "20-LEC",
        courseTitle: "Algorithms",
        searchGroups: groups
      } as CartFlowResult),
      openRelatedPicker: vi.fn().mockResolvedValue(picked)
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());

    expect(deps.openRelatedPicker).toHaveBeenCalled();
    expect(deps.continueCartAddWithRelated).toHaveBeenCalledWith({
      continuationFormState: "ICSID=abc",
      selectedRowIndex: 7,
      classNumber: "12345",
      sectionLabel: "20-LEC",
      courseTitle: "Algorithms",
      searchGroups: groups
    });
    expect(button.dataset.state).toBe("success");
    expect(button.textContent).toBe("Added ✓");
    expect(deps.showToast).toHaveBeenCalledWith(
      expect.stringContaining("with section 30"),
      expect.objectContaining({ tone: "success" })
    );
    // The picker `<li>` must be torn down after the continuation succeeds —
    // pre-Wave-5d this happened inline in `handleRelatedPick` after every
    // network return; the controller now delegates the teardown back to
    // the picker so a successful pick doesn't leave the picker stuck on
    // "Adding…" forever.
    expect(deps.closeRelatedPicker).toHaveBeenCalled();
    // Locks in the post-Wave-5d behavior: `recordOptimisticAdd` fires on
    // BOTH the direct-add path AND the post-pick success path. The cart
    // cache should reflect every successful add, not just direct ones.
    expect(deps.recordOptimisticAdd).toHaveBeenCalledWith(
      "4750",
      expect.objectContaining({
        classNumber: "12345",
        subject: "COMP_SCI",
        catalog: "111-0",
        sectionLabel: "20-LEC"
      })
    );
  });

  it("user cancels the picker → button restored to idle, no continuation call", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const groups: CaesarCourseGroup[] = [];
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        needsRelatedSection: true,
        classNumber: "12345",
        sectionLabel: "20-LEC",
        courseTitle: "Algorithms",
        relatedOptions: [makeOption()],
        continuationFormState: "ICSID=abc",
        searchGroups: groups
      } as CartFlowResult),
      openRelatedPicker: vi.fn().mockResolvedValue(null)
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(deps.continueCartAddWithRelated).not.toHaveBeenCalled();
    expect(button.dataset.state).toBe("");
    expect(button.textContent).toBe("Add to cart");
    expect(button.disabled).toBe(false);
  });

  it("chained picker (continuation returns needsRelatedSection again) recurses", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const groups: CaesarCourseGroup[] = [];
    const picked = makeOption({ rowIndex: 7 });
    const picked2 = makeOption({ rowIndex: 8, section: "31" });
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        needsRelatedSection: true,
        classNumber: "12345",
        sectionLabel: "20-LEC",
        courseTitle: "Algorithms",
        relatedOptions: [picked],
        continuationFormState: "ICSID=abc",
        searchGroups: groups
      } as CartFlowResult),
      continueCartAddWithRelated: vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          needsRelatedSection: true,
          classNumber: "12345",
          sectionLabel: "20-LEC",
          courseTitle: "Algorithms",
          relatedOptions: [picked2],
          continuationFormState: "ICSID=def",
          searchGroups: groups
        } as CartFlowResult)
        .mockResolvedValueOnce({
          ok: true,
          classNumber: "12345",
          sectionLabel: "20-LEC",
          courseTitle: "Algorithms",
          searchGroups: groups
        } as CartFlowResult),
      openRelatedPicker: vi.fn().mockResolvedValueOnce(picked).mockResolvedValueOnce(picked2)
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(deps.openRelatedPicker).toHaveBeenCalledTimes(2);
    expect(deps.continueCartAddWithRelated).toHaveBeenCalledTimes(2);
    expect(button.dataset.state).toBe("success");
  });

  it("does not double-fire when the button is mid-flight (loading)", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    button.dataset.state = "loading";
    const deps = makeDeps();
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(deps.consumeCredit).not.toHaveBeenCalled();
    expect(deps.addSectionToCart).not.toHaveBeenCalled();
  });

  it("does not double-fire when the button is mid-flight (needs-related)", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    button.dataset.state = "needs-related";
    const deps = makeDeps();
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(deps.consumeCredit).not.toHaveBeenCalled();
    expect(deps.addSectionToCart).not.toHaveBeenCalled();
  });

  it("synchronous double-click only triggers one cart-add", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    type Resolver = (v: CartFlowResult) => void;
    const resolverRef: { current: Resolver | null } = { current: null };
    const groups: CaesarCourseGroup[] = [];
    const successResult: CartFlowResult = {
      ok: true,
      classNumber: "12345",
      sectionLabel: "20-LEC",
      courseTitle: "Fundamentals",
      searchGroups: groups
    };
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockImplementation(
        () =>
          new Promise<CartFlowResult>((res) => {
            resolverRef.current = res;
          })
      )
    });
    const ctrl = createAddToCartController(deps);

    // Fire two clicks back-to-back without yielding between them. The second
    // call must be filtered by the dataset.state re-entry guard set by the
    // first call's synchronous prefix.
    const first = ctrl.onClick(button, makeCtx());
    const second = ctrl.onClick(button, makeCtx());

    // After the synchronous prefix, the button is locked and the state guard
    // is armed.
    expect(button.disabled).toBe(true);
    expect(button.dataset.state).toBe("loading");

    // Drain microtasks so the in-flight click reaches addSectionToCart and
    // installs the resolver. Then unblock and let everything settle.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(resolverRef.current).not.toBeNull();
    resolverRef.current?.(successResult);
    await Promise.all([first, second]);

    expect(deps.consumeCredit).toHaveBeenCalledTimes(1);
    expect(deps.addSectionToCart).toHaveBeenCalledTimes(1);
  });

  it("button stays disabled throughout the loading state", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    type Resolver = (v: CartFlowResult) => void;
    const resolverRef: { current: Resolver | null } = { current: null };
    const successResult: CartFlowResult = {
      ok: true,
      classNumber: "12345",
      sectionLabel: "20-LEC",
      courseTitle: "Fundamentals",
      searchGroups: []
    };
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockImplementation(
        () =>
          new Promise<CartFlowResult>((res) => {
            resolverRef.current = res;
          })
      )
    });
    const ctrl = createAddToCartController(deps);

    const settled = ctrl.onClick(button, makeCtx());
    // Drain microtasks so the click reaches addSectionToCart and parks.
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    expect(button.disabled).toBe(true);
    expect(button.dataset.state).toBe("loading");

    resolverRef.current?.(successResult);
    await settled;
    expect(button.disabled).toBe(true);
    expect(button.dataset.state).toBe("in-cart");
  });

  it("button is restored to enabled when an error returns to idle", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        error: "CAESAR refused."
      } as CartFlowResult)
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(button.dataset.state).toBe("error");
    expect(button.disabled).toBe(false);
  });

  it("continuation error: button shows Try again + error toast", async () => {
    const doc = fresh();
    const button = makeButton(doc);
    const groups: CaesarCourseGroup[] = [];
    const deps = makeDeps({
      addSectionToCart: vi.fn().mockResolvedValue({
        ok: false,
        needsRelatedSection: true,
        classNumber: "12345",
        sectionLabel: "20-LEC",
        courseTitle: "Algorithms",
        relatedOptions: [makeOption({ rowIndex: 7 })],
        continuationFormState: "ICSID=abc",
        searchGroups: groups
      } as CartFlowResult),
      continueCartAddWithRelated: vi.fn().mockResolvedValue({
        ok: false,
        error: "CAESAR rejected the related-component pick."
      } as CartFlowResult),
      openRelatedPicker: vi.fn().mockResolvedValue(makeOption({ rowIndex: 7 }))
    });
    const ctrl = createAddToCartController(deps);

    await ctrl.onClick(button, makeCtx());
    expect(button.dataset.state).toBe("error");
    expect(button.textContent).toBe("Try again");
    expect(button.disabled).toBe(false);
    expect(deps.showToast).toHaveBeenCalledWith(
      "CAESAR rejected the related-component pick.",
      expect.objectContaining({ tone: "error" })
    );
    // Even on continuation failure the picker must be torn down so the
    // user isn't stuck staring at "Adding…" while the section row shows
    // the error.
    expect(deps.closeRelatedPicker).toHaveBeenCalled();
  });
});
