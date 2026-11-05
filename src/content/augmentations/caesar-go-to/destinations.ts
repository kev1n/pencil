import { CART_URL } from "../../cart-cache/reconcile";
import { LANDING_PAGE_URL } from "../../auth/silent-recovery";
import { COURSE_HISTORY_PAGE_URL } from "../../course-history/reconcile";
import { SEARCH_ENTRY_URL } from "../../peoplesoft/shared";
import { APPOINTMENTS_URL } from "./appointment-dates";

export type Bookmark = {
  id: string;
  label: string;
  shortLabel?: string;
  href?: string;
  navigate(): void;
};

type Route = Omit<Bookmark, "navigate"> & {
  nativeLabels: readonly string[];
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
    href: SEARCH_ENTRY_URL
  },
  {
    id: "cart",
    label: "Shopping Cart",
    shortLabel: "Cart",
    nativeLabels: ["shopping cart and enroll", "shopping cart"],
    href: CART_URL
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
    href: APPOINTMENTS_URL
  },
  {
    id: "history",
    label: "Course History",
    nativeLabels: ["course history", "my course history"],
    href: COURSE_HISTORY_PAGE_URL
  }
];

const NAV_LINKS = "nav a[href], [role='navigation'] a[href], #PT_SIDE a[href], #PT_LEFT_PANEL a[href], [role='link'][href]";
const CART_SEARCH = "form#SSR_SSENRL_CART #DERIVED_REGFRM1_SSR_PB_SRCH";

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
  return ROUTES.flatMap(({ nativeLabels, ...bookmark }) => {
    if (!bookmark.href && !findNativeLink(doc, bookmark.id, nativeLabels)) return [];
    return [{
      ...bookmark,
      navigate() {
        const native = findNativeLink(doc, bookmark.id, nativeLabels);
        if (native) native.click();
        else if (bookmark.href) doc.location.assign(bookmark.href);
      }
    }];
  });
}
