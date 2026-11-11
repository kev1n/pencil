import { LANDING_PAGE_URL } from "../../auth/silent-recovery";
import { MANAGE_CLASSES_TABS, TAB_FRAGMENT, manageClassesTabUrl } from "../../peoplesoft/shared";
import { CAESAR_ORIGIN } from "../../../shared/nu-hosts";

const ACADEMIC_RECORDS_URL = `${CAESAR_ORIGIN}/psc/csnu/EMPLOYEE/SA/c/SSR_STUDENT_ACAD_REC_FL.SSR_MD_ACAD_REC_FL.GBL?Action=U&MD=Y&GMenu=SSR_STUDENT_ACAD_REC_FL&GComp=SSR_ACADREC_NAV_FL&GPage=SCC_START_PAGE_FL&scname=CS_SSR_ACADEMIC_RECORDS_FL`;

export type Bookmark = {
  id: string;
  label: string;
  shortLabel?: string;
  href?: string;
  navigate(): void;
};

type Route = Omit<Bookmark, "navigate"> & {
  nativeLabels: readonly string[];
  // The Manage Classes tab this bookmark opens.
  tab?: string;
};

const ROUTES: readonly Route[] = [
  {
    id: "home",
    label: "CAESAR Home",
    shortLabel: "Home",
    nativeLabels: [],
    href: LANDING_PAGE_URL
  },
  {
    id: "search",
    label: "Class Search",
    nativeLabels: ["class search", "search for classes"],
    tab: MANAGE_CLASSES_TABS.search,
    href: manageClassesTabUrl(MANAGE_CLASSES_TABS.search)
  },
  {
    id: "cart",
    label: "Shopping Cart",
    shortLabel: "Cart",
    nativeLabels: ["shopping cart and enroll", "shopping cart"],
    tab: MANAGE_CLASSES_TABS.cart,
    href: manageClassesTabUrl(MANAGE_CLASSES_TABS.cart)
  },
  {
    id: "schedule",
    label: "My Class Schedule",
    shortLabel: "Schedule",
    nativeLabels: ["my class schedule", "view my class schedule", "view my classes"]
  },
  {
    id: "appointment",
    label: "Enrollment Dates",
    nativeLabels: ["enrollment appointment/dates", "enrollment dates", "enrollment appointments"],
    href: manageClassesTabUrl(MANAGE_CLASSES_TABS.dates)
  },
  {
    id: "history",
    label: "Course History",
    nativeLabels: ["course history", "my course history"],
    href: ACADEMIC_RECORDS_URL
  }
];

const NAV_LINKS = "nav a[href], [role='navigation'] a[href], #PT_SIDE a[href], #PT_LEFT_PANEL a[href], [role='link'][href]";
const CART_SEARCH = "form#SSR_SSENRL_CART #DERIVED_REGFRM1_SSR_PB_SRCH";

function findTab(doc: Document, tab: string): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`.ps_ag-step-button[onclick*="'${tab}'"]`);
}

// Picks the tab a bookmark link named, once Manage Classes has loaded.
// Returns true while the tab still has to open: CAESAR ignores a pick made
// while its first tab is loading, so the caller calls again.
export function openRequestedTab(doc: Document, giveUp = false): boolean {
  const { hash } = doc.location;
  if (!hash.startsWith(TAB_FRAGMENT)) return false;
  const tab = findTab(doc, hash.slice(TAB_FRAGMENT.length));
  if (!tab && !giveUp) return true;
  if (giveUp || tab!.classList.contains("psc_selected")) {
    const view = doc.defaultView!;
    view.history.replaceState(view.history.state, "", doc.location.pathname + doc.location.search);
    return false;
  }
  tab!.click();
  return true;
}

function findNativeLink(doc: Document, routeId: string, labels: readonly string[]): HTMLElement | undefined {
  const frameDoc = doc.querySelector<HTMLIFrameElement>("#ptifrmtgtframe")?.contentDocument;
  if (routeId === "search") {
    const cartSearch = doc.querySelector<HTMLElement>(CART_SEARCH) ?? frameDoc?.querySelector<HTMLElement>(CART_SEARCH);
    if (cartSearch) return cartSearch;
  }
  const links = [...doc.querySelectorAll<HTMLElement>(NAV_LINKS)];
  if (frameDoc) links.push(...frameDoc.querySelectorAll<HTMLElement>(NAV_LINKS));
  return links.find((link) => {
    if (link.closest("#bc-caesar-bookmarks, [hidden], [aria-hidden='true']")) return false;
    const label = link.textContent?.trim().toLowerCase().replace(/\s+/g, " ");
    if (!label || !labels.includes(label)) return false;
    const href = link.getAttribute("href");
    if (!href || !URL.canParse(href, doc.location.href)) return false;
    const url = new URL(href, doc.location.href);
    return url.protocol === "javascript:" || url.origin === doc.location.origin;
  });
}

export function readBookmarks(doc: Document): Bookmark[] {
  return ROUTES.flatMap(({ nativeLabels, tab, ...bookmark }) => {
    if (!bookmark.href && !findNativeLink(doc, bookmark.id, nativeLabels)) return [];
    return [{
      ...bookmark,
      navigate() {
        const native = (tab && findTab(doc, tab)) || findNativeLink(doc, bookmark.id, nativeLabels);
        if (native) native.click();
        else if (bookmark.href) doc.location.assign(bookmark.href);
      }
    }];
  });
}
