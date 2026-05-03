import type { Augmentation } from "../../framework";
import { isRetryablePeopleSoftTaskError } from "../../peoplesoft";
import { extractClassNumber } from "../seats-notes/helpers";
import { showToast } from "../seats-notes/toast";
import { CLASS_LINK_SELECTOR, CLASS_ROW_SELECTOR, PAGE_ID } from "./constants";
import { fetchCtecLinks, getCtecLinksFromCache } from "./fetcher";
import { extractInstructorFromRow, extractSubjectAndCatalog } from "./helpers";
import {
  buildCtecCreditToastMessage,
  CTEC_ERROR_TOAST_MESSAGE,
  tryConsumeCtecCredit
} from "./rate-limit";
import type { CtecLinkData, CtecLinkTarget } from "./types";
import {
  ensureCtecCell,
  ensureCtecHeader,
  injectStyles,
  isCtecCellDone,
  isCtecCellReady,
  markCtecCellDone,
  markCtecCellReady,
  renderCtecLinksWidget,
  renderFetchButton,
  renderLoading
} from "./ui";

export class CtecLinksAugmentation implements Augmentation {
  readonly id = "ctec-links";

  private readonly inFlight = new Set<string>();

  run(doc: Document = document): void {
    if (!this.appliesToPage(doc)) return;
    injectStyles();

    for (const target of this.collectTargets(doc)) {
      const key = this.targetKey(target);
      if (this.inFlight.has(key)) continue;
      if (isCtecCellDone(target.container)) continue;
      if (isCtecCellReady(target.container)) continue;
      markCtecCellReady(target.container);

      const cached = getCtecLinksFromCache(target.params);
      if (cached) {
        renderCtecLinksWidget(target.container, cached, () => this.kick(target, key));
        markCtecCellDone(target.container);
      } else {
        renderFetchButton(target.container, () => this.kick(target, key));
      }
    }
  }

  private appliesToPage(doc: Document): boolean {
    const pageId = doc
      .querySelector<HTMLElement>("#pt_pageinfo_win0")
      ?.getAttribute("Page");
    return pageId === PAGE_ID;
  }

  private collectTargets(doc: Document): CtecLinkTarget[] {
    const targets: CtecLinkTarget[] = [];
    const seenTables = new Set<HTMLTableElement>();

    for (const row of Array.from(
      doc.querySelectorAll<HTMLTableRowElement>(CLASS_ROW_SELECTOR)
    )) {
      const table = row.closest<HTMLTableElement>("table");
      if (table && !seenTables.has(table)) {
        ensureCtecHeader(table);
        seenTables.add(table);
      }

      const link = row.querySelector<HTMLAnchorElement>(CLASS_LINK_SELECTOR);
      if (!link) continue;

      const linkText = link.textContent ?? "";
      const parsed = extractSubjectAndCatalog(linkText);
      if (!parsed) continue;

      targets.push({
        row,
        params: {
          classNumber: extractClassNumber(linkText) ?? "",
          subject: parsed.subject,
          catalogNumber: parsed.catalogNumber,
          instructor: extractInstructorFromRow(row)
        },
        container: ensureCtecCell(row)
      });
    }

    return targets;
  }

  private targetKey(target: CtecLinkTarget): string {
    const { subject, catalogNumber, instructor } = target.params;
    return `${subject}:${catalogNumber}:${instructor.toLowerCase().trim()}`;
  }

  private kick(target: CtecLinkTarget, key: string): void {
    if (this.inFlight.has(key)) return;

    const credit = tryConsumeCtecCredit(Date.now());
    if (!credit.ok) {
      showToast(buildCtecCreditToastMessage(credit.waitMs), {
        tone: "warn",
        durationMs: 6000
      });
      return;
    }

    this.inFlight.add(key);
    renderLoading(target.container);

    void fetchCtecLinks(target.params, (msg) => { renderLoading(target.container, msg); })
      .then((data: CtecLinkData) => {
        this.inFlight.delete(key);
        renderCtecLinksWidget(target.container, data, () => this.kick(target, key));
        if (data.state === "found" || data.state === "not-found") {
          markCtecCellDone(target.container);
        }
        if (data.state === "error") {
          showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
        }
      })
      .catch((err: unknown) => {
        this.inFlight.delete(key);
        if (isRetryablePeopleSoftTaskError(err)) {
          renderFetchButton(target.container, () => this.kick(target, key));
          return;
        }

        const errData: CtecLinkData = {
          state: "error",
          message: err instanceof Error ? err.message : "Unknown error"
        };
        renderCtecLinksWidget(target.container, errData, () => this.kick(target, key));
        showToast(CTEC_ERROR_TOAST_MESSAGE, { tone: "warn", durationMs: 9000 });
      });
  }
}
