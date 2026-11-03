import { LANDING_PAGE_URL } from "../../auth/silent-recovery";
import { CART_URL } from "../../cart-cache/reconcile";
import { COURSE_HISTORY_PAGE_URL } from "../../course-history/reconcile";
import { SEARCH_ENTRY_URL } from "../../peoplesoft/shared";
import type { Destination } from "./palette";

type Route = Omit<Destination, "navigate"> & {
  nativeLabels: readonly string[];
  fallback?: string;
};

const ROUTES: readonly Route[] = [
  {
    id: "search",
    label: "Class search",
    group: "Registration",
    icon: "search",
    aliases: "find classes catalog sharper search courses",
    // Open the entry form enhanced by Sharper Search, including in the fluid shell.
    nativeLabels: [],
    fallback: SEARCH_ENTRY_URL
  },
  {
    id: "cart",
    label: "Shopping cart",
    group: "Registration",
    icon: "cart",
    aliases: "enroll register registration",
    nativeLabels: ["shopping cart and enroll", "shopping cart"],
    fallback: CART_URL
  },
  {
    id: "appointment",
    label: "Enrollment appointments",
    group: "Registration",
    icon: "clock",
    aliases: "when do i register registration time date prereg pre-registration",
    nativeLabels: ["enrollment appointment/dates", "enrollment dates", "enrollment appointments"],
    fallback: "/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_APPT.GBL?Action=A"
  },
  {
    id: "schedule",
    label: "My class schedule",
    group: "Registration",
    icon: "calendar",
    aliases: "enrolled classes timetable calendar",
    nativeLabels: ["my class schedule", "view my classes"]
  },
  {
    id: "history",
    label: "Course history",
    group: "Academic records",
    icon: "file",
    aliases: "classes taken completed academic records",
    nativeLabels: ["course history", "my course history"],
    fallback: COURSE_HISTORY_PAGE_URL
  },
  {
    id: "grades",
    label: "View grades",
    group: "Academic records",
    icon: "file",
    aliases: "gpa academic records",
    nativeLabels: ["view grades", "view my grades"]
  },
  {
    id: "transcript",
    label: "Unofficial transcript",
    group: "Academic records",
    icon: "file",
    aliases: "academic records report",
    nativeLabels: ["view unofficial transcript", "unofficial transcript"]
  },
  {
    id: "degree",
    label: "Degree progress",
    group: "Academic records",
    icon: "file",
    aliases: "requirements dpr degree audit academic records",
    nativeLabels: ["degree progress", "view degree progress report"]
  },
  {
    id: "home",
    label: "Student homepage",
    group: "CAESAR",
    icon: "home",
    aliases: "caesar dashboard tiles home",
    nativeLabels: ["student homepage"],
    fallback: LANDING_PAGE_URL
  }
];

const NAV_LINKS = "nav a[href], [role='navigation'] a[href], #PT_SIDE a[href], #PT_LEFT_PANEL a[href]";

export function readDestinations(doc: Document): Destination[] {
  const links = [...doc.querySelectorAll<HTMLAnchorElement>(NAV_LINKS)];
  const frameDoc = doc.querySelector<HTMLIFrameElement>("#ptifrmtgtframe")?.contentDocument;
  if (frameDoc) links.push(...frameDoc.querySelectorAll<HTMLAnchorElement>(NAV_LINKS));
  const byLabel = new Map<string, HTMLAnchorElement>();
  for (const link of links) {
    if (!link.closest("[hidden], [aria-hidden='true']") &&
        (link.protocol === "javascript:" || link.origin === doc.location.origin)) {
      const label = link.textContent?.trim().toLowerCase().replace(/\s+/g, " ");
      if (label) byLabel.set(label, link);
    }
  }

  return ROUTES.flatMap(({ nativeLabels, fallback, ...destination }) => {
    const native = nativeLabels.map((label) => byLabel.get(label)).find(Boolean);
    if (!native && !fallback) return [];
    return [{
      ...destination,
      navigate(closePalette) {
        if (native?.isConnected) {
          closePalette();
          native.click();
        } else if (fallback) {
          // Keep focus in the palette until the new page takes over. Closing
          // first can refocus an offscreen control in the document being left.
          doc.location.assign(fallback);
        } else {
          closePalette();
        }
      }
    }];
  });
}
