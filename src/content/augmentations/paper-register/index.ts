import { logQuiet } from "../../../shared/log";
import { enrollFromCart, loadCartRows, type CartRow, type EnrollResult } from "../../enroll/flow";
import { createActionButton, el, ensureStyle, type Augmentation } from "../../framework";
import { CaesarConnectionError } from "../../peoplesoft/connection";
import { MANAGE_CLASSES_TABS, manageClassesTabUrl } from "../../peoplesoft/shared";
import { createAuthRecovery, withAuthRecovery } from "../class-search/auth-recovery";
import { isCaesarAuthRequiredError } from "../class-search/caesar-search/types";
import { getActivePaperTermId, readActiveTermNameFromDom } from "../paper-ctec/paper-active-term";

const FEATURE_ID = "paper-register";
const POPOVER_ID = "bc-paper-register";
const STYLE_ID = "bc-paper-register-style";

const STYLES = `
  #${POPOVER_ID} {
    position: fixed;
    inset: 55px 12px auto auto;
    box-sizing: border-box;
    width: min(380px, calc(100vw - 24px));
    max-height: calc(100dvh - 67px);
    margin: 0;
    padding: 12px 14px;
    overflow: auto;
    background: var(--bc-color-bg);
    border: 1px solid var(--bc-color-border);
    border-radius: var(--bc-radius-md);
    box-shadow: var(--bc-shadow-elev-1);
    color: var(--bc-color-text);
    font: 400 13px/1.45 var(--bc-font-body);
  }
  #${POPOVER_ID} h2 { margin: 0 0 8px; font: 650 14px/1.25 var(--bc-font-body); }
  #${POPOVER_ID} .bc-reg-note { margin: 0 0 8px; color: var(--bc-color-text-muted); }
  #${POPOVER_ID} .bc-reg-row {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 7px 0; border-top: 1px solid var(--bc-color-border);
  }
  #${POPOVER_ID} label.bc-reg-row { cursor: pointer; }
  #${POPOVER_ID} .bc-reg-row input { margin: 3px 0 0; accent-color: var(--bc-color-accent); }
  #${POPOVER_ID} .bc-reg-row.is-with { padding-left: 22px; color: var(--bc-color-text-muted); }
  #${POPOVER_ID} .bc-reg-row strong { display: block; font-weight: 600; }
  #${POPOVER_ID} .bc-reg-row small { display: block; font-size: 12px; color: var(--bc-color-text-muted); }
  #${POPOVER_ID} .bc-reg-ok { color: var(--bc-color-sentiment-pos-fg); }
  #${POPOVER_ID} .bc-reg-no { color: var(--bc-color-sentiment-neg-fg); }
  #${POPOVER_ID} .bc-reg-actions { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid var(--bc-color-border); }
  #${POPOVER_ID} > a {
    display: inline-block; margin-top: 10px;
    color: var(--bc-color-text-muted); font-size: 12px; text-underline-offset: 3px;
  }
  button[popovertarget="${POPOVER_ID}"] {
    align-self: center; font: inherit; font-size: 0.875rem; font-weight: 500;
    padding-inline: 8px; white-space: nowrap;
  }
`;

// Paper.nu: a Register button in the banner. It lists the CAESAR shopping
// cart for the quarter being planned, lets the student tick classes, and
// enrolls them through CAESAR's own steps without leaving the page.
export class PaperRegisterAugmentation implements Augmentation {
  readonly id = FEATURE_ID;
  private trigger?: HTMLButtonElement;
  private popover?: HTMLElement;
  private readonly authRecovery = createAuthRecovery({
    chromeRuntime: chrome.runtime,
    windowLocation: { assign: (url: string | URL) => window.location.assign(url) }
  });

  run(doc: Document = document): void {
    const { hostname } = doc.location;
    if (hostname !== "paper.nu" && hostname !== "www.paper.nu") return;

    const about = Array.from(doc.querySelectorAll("div.sticky.top-0.z-30.flex.w-full button"))
      .find((button) => button.textContent?.trim() === "About");
    if (about && this.trigger && about.previousElementSibling === this.trigger) return;

    if (this.trigger) this.cleanup(doc);
    if (!about) return;

    ensureStyle(doc, STYLE_ID, STYLES);
    const trigger = el(doc, "button", {
      class: about.className,
      text: "Register",
      attrs: { type: "button", popovertarget: POPOVER_ID }
    });
    const popover = this.buildPopover(doc, trigger);
    about.before(trigger);
    doc.body.append(popover);
    this.trigger = trigger;
    this.popover = popover;
  }

  cleanup(doc: Document = document): void {
    this.trigger?.remove();
    this.popover?.remove();
    this.trigger = undefined;
    this.popover = undefined;
    doc.getElementById(STYLE_ID)?.remove();
  }

  // Runs a CAESAR call, signing in again when the session has lapsed.
  private async withSession<T>(action: () => Promise<T>): Promise<T> {
    const result = await withAuthRecovery(this.authRecovery, isCaesarAuthRequiredError, action);
    if (result === null) throw new Error("CAESAR sign-in was canceled.");
    return result;
  }

  private buildPopover(doc: Document, trigger: HTMLElement): HTMLElement {
    const content = el(doc, "div", { attrs: { "aria-live": "polite" } });
    const popover = el(doc, "section", {
      attrs: { id: POPOVER_ID, popover: "auto", "aria-label": "Register for classes" }
    }, [
      el(doc, "h2", { text: "Register for classes" }),
      content,
      el(doc, "a", {
        text: "Open the shopping cart in CAESAR ↗",
        attrs: { href: manageClassesTabUrl(MANAGE_CLASSES_TABS.cart), target: "_blank", rel: "noopener noreferrer" }
      })
    ]);
    const note = (text: string) => el(doc, "p", { class: "bc-reg-note", text });
    const describe = (error: unknown): string =>
      error instanceof CaesarConnectionError
        ? "Couldn’t reach CAESAR. It only answers on campus Wi-Fi or the VPN."
        : error instanceof Error ? error.message : String(error);

    const showResults = (results: EnrollResult[], reload: () => Promise<void>): void => {
      const again = createActionButton({ doc, label: "Back to cart", className: "bc-btn bc-btn--secondary bc-btn--sm", onClick: reload });
      content.replaceChildren(
        ...results.map((result) => el(doc, "div", { class: "bc-reg-row" }, [
          el(doc, "span", {}, [
            el(doc, "strong", { text: result.label.replace(/_/g, " ") }),
            el(doc, "span", { class: result.ok ? "bc-reg-ok" : "bc-reg-no", text: result.ok ? "Enrolled" : "Not enrolled" }),
            el(doc, "small", { text: result.message })
          ])
        ])),
        el(doc, "div", { class: "bc-reg-actions" }, [again.element])
      );
    };

    const showCart = (termId: string, termName: string, rows: CartRow[], message: string | null, reload: () => Promise<void>): void => {
      if (rows.length === 0) {
        content.replaceChildren(note(message ?? `Nothing in your CAESAR cart for ${termName}. Add classes from a schedule card first.`));
        return;
      }
      const boxes = new Map<string, HTMLInputElement>();
      const picked = (): string[] => [...boxes].filter(([, box]) => box.checked).map(([classNumber]) => classNumber);
      const register = createActionButton({
        doc,
        label: "Register for ticked classes",
        loadingLabel: "Enrolling…",
        className: "bc-btn bc-btn--primary bc-btn--sm",
        onClick: async () => {
          const classNumbers = picked();
          if (classNumbers.length === 0) {
            hint.textContent = "Tick at least one class first.";
            return;
          }
          hint.textContent = "";
          try {
            const outcome = await this.withSession(() => enrollFromCart(termId, classNumbers, FEATURE_ID));
            if (outcome.kind === "done") showResults(outcome.results, reload);
            else content.prepend(el(doc, "p", { class: "bc-reg-note bc-reg-no", text: outcome.message }));
          } catch (error: unknown) {
            logQuiet(FEATURE_ID, error);
            // The request may have gone through: say so instead of guessing.
            content.prepend(el(doc, "p", {
              class: "bc-reg-note bc-reg-no",
              text: `${describe(error)} Check your schedule in CAESAR before trying again.`
            }));
          }
        }
      });
      const hint = el(doc, "small", { class: "bc-reg-no" });
      content.replaceChildren(
        ...(message ? [el(doc, "p", { class: "bc-reg-note bc-reg-no", text: message })] : []),
        note(`Your CAESAR cart for ${termName}. Registering enrolls you for real.`),
        ...rows.map((row) => {
          const text = el(doc, "span", {}, [
            el(doc, "strong", { text: row.label }),
            el(doc, "small", { text: row.pickable ? row.when : `${row.when} · comes with the class above` })
          ]);
          if (!row.pickable) return el(doc, "div", { class: "bc-reg-row is-with" }, [text]);
          const box = el(doc, "input", { attrs: { type: "checkbox" } });
          boxes.set(row.classNumber, box);
          return el(doc, "label", { class: "bc-reg-row" }, [box, text]);
        }),
        el(doc, "div", { class: "bc-reg-actions" }, [register.element, hint])
      );
    };

    let loading = false;
    const load = async (): Promise<void> => {
      if (loading) return;
      loading = true;
      content.replaceChildren(note("Loading your CAESAR cart…"));
      try {
        const { termId } = await getActivePaperTermId(doc);
        const termName = readActiveTermNameFromDom(doc) ?? "this quarter";
        const { rows, message } = await this.withSession(() => loadCartRows(termId));
        showCart(termId, termName, rows, message, load);
      } catch (error: unknown) {
        logQuiet(FEATURE_ID, error);
        const retry = createActionButton({ doc, label: "Try again", className: "bc-btn bc-btn--secondary bc-btn--sm", onClick: load });
        content.replaceChildren(note(describe(error)), retry.element);
      } finally {
        loading = false;
      }
    };

    popover.addEventListener("toggle", () => {
      if (!popover.matches(":popover-open")) return;
      const bounds = trigger.getBoundingClientRect();
      const width = doc.documentElement.clientWidth;
      const top = Math.ceil(bounds.bottom) + 6;
      popover.style.top = `${top}px`;
      popover.style.maxHeight = `calc(100dvh - ${top + 12}px)`;
      popover.style.right = `${Math.max(12, Math.min(width - bounds.right, width - popover.offsetWidth - 12))}px`;
      void load();
    });
    return popover;
  }
}

export const paperRegisterAugmentation = new PaperRegisterAugmentation();
