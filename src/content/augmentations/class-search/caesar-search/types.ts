// Public types for the class-search → CAESAR cart flow. Kept here so
// parser.ts, forms.ts, and flow.ts can all import without cycles.

import { LANDING_PAGE_URL } from "../../../auth/silent-recovery";

// Re-export so existing call sites that import LANDING_PAGE_URL from this
// module (e.g. paper-ctec) keep compiling. Source of truth is silent-recovery.
export { LANDING_PAGE_URL };

export type CaesarStatus = "Open" | "Closed" | "Wait List" | "Unknown";

// CAESAR row, parsed from the search results page. We keep enough info to
// render a "live status" badge inline AND to drive the add-to-cart chain.
export type CaesarSection = {
  classNumber: string;
  sectionLabel: string; // e.g. "1-LEC", "01-TUT"
  sectionNumber: string; // e.g. "1", "01"
  component: string; // "LEC", "DIS", "LAB", "TUT", "SEM", ...
  daysTime: string;
  room: string;
  instructor: string;
  meetingDates: string;
  grading: string;
  status: CaesarStatus;
  selectActionId: string; // SSR_PB_SELECT$N
  // CAESAR omits the Select button when the user already has the section in
  // their shopping cart — the actions cell is empty. We surface that here
  // so cart-add can short-circuit with a clear message instead of issuing
  // a doomed POST.
  selectAvailable: boolean;
};

export type CaesarCourseGroup = {
  courseId: string; // "COMP_SCI  111-0 - Fundamentals of Computer Programming"
  catalog: string; // "111-0"
  title: string; // "Fundamentals of Computer Programming"
  sections: CaesarSection[];
};

export type CaesarSearchResult = {
  groups: CaesarCourseGroup[];
};

export type CaesarSearchInput = {
  termId: string;
  institution: string;
  subject: string;
  bareCatalog: string; // bare number — NOT the full "111-0"
};

// Row from a related-component picker page (the page CAESAR shows after
// SELECT for courses that require pairing a discussion/lab/recitation).
export type RelatedSectionOption = {
  rowIndex: number;
  classNumber: string;
  section: string;
  schedule: string;
  room: string;
  instructor: string;
  status: CaesarStatus;
};

export type CartFlowResult =
  | {
      ok: true;
      classNumber: string;
      sectionLabel: string;
      courseTitle: string;
      // Parsed groups from the class-number search response. Always
      // contains the matched group with one section row carrying live
      // status / instructor / room. Caller stamps this into its
      // live-status cache so badges populate on the section row without
      // a separate "Load CAESAR data" subject search.
      searchGroups: CaesarCourseGroup[];
    }
  | {
      ok: false;
      // CAESAR is asking the user to pick a discussion/lab/recitation
      // before the add can finish. The picker UI calls
      // `continueCartAddWithRelated` with a chosen rowIndex.
      needsRelatedSection: true;
      classNumber: string;
      courseTitle: string;
      relatedOptions: RelatedSectionOption[];
      // Serialized URLSearchParams of the related-component page's hidden
      // inputs. Caller hands this back to continue the wizard.
      continuationFormState: string;
      sectionLabel: string;
      searchGroups: CaesarCourseGroup[];
    }
  | {
      ok: false;
      error: string;
      classNumber?: string;
      // True when CAESAR returned the section row but omitted the Select
      // button — meaning the user already has it in their shopping cart.
      alreadyInCart?: boolean;
      searchGroups?: CaesarCourseGroup[];
    };

export type CartFlowInput = {
  classNumber: string; // 5-digit CAESAR class number (e.g. "34612")
  termId: string;
  institution: string;
  subject: string; // "COMP_SCI", "LAW", etc. — drives career candidates via nu-careers
  bareCatalog: string; // drives career candidates via nu-careers
};

export type CartFlowContinuationInput = {
  continuationFormState: string;
  selectedRowIndex: number;
  classNumber: string;
  sectionLabel: string;
  courseTitle: string;
  searchGroups: CaesarCourseGroup[];
};

export const INSTITUTION_DEFAULT = "NWUNV";

export class CaesarAuthRequiredError extends Error {
  readonly loginUrl: string;
  constructor(loginUrl: string = LANDING_PAGE_URL) {
    super("CAESAR session expired — sign in to continue.");
    this.name = "CaesarAuthRequiredError";
    this.loginUrl = loginUrl;
  }
}

export function isCaesarAuthRequiredError(error: unknown): error is CaesarAuthRequiredError {
  return error instanceof CaesarAuthRequiredError;
}
