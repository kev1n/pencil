import { CartPageHydrator } from "../cart-cache";
import type { Augmentation } from "../framework";
import { caesarBookmarksAugmentation } from "./caesar-go-to";
import { classSearchAugmentation } from "./class-search";
import { courseHistoryViewAugmentation } from "./course-history-view";
import { ctecLinksAugmentation } from "./ctec-links";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { paperBrandAugmentation } from "./paper-brand";
import { paperCombosAugmentation } from "./paper-combos";
import { paperCtecAugmentation } from "./paper-ctec";
import { paperEnrollmentDatesAugmentation } from "./paper-enrollment-dates";
import { paperExportHelperAugmentation } from "./paper-export-helper";
import { paperHideTakenAugmentation } from "./paper-hide-taken";
import { prereqFilterAugmentation } from "./prereq-filter";
import { seatsNotesAugmentation } from "./seats-notes";

// CartPageHydrator isn't user-facing — it's the source-of-truth writer for
// the shared cart cache. Listed here so the runner re-invokes it on every
// CAESAR DOM mutation, which is how PeopleSoft swaps the shopping cart in.
const cartPageHydrator = new CartPageHydrator();

export const augmentationRegistry: Augmentation[] = [
  caesarBookmarksAugmentation,
  enrollmentNavigationAugmentation,
  classSearchAugmentation,
  courseHistoryViewAugmentation,
  ctecLinksAugmentation,
  paperBrandAugmentation,
  paperEnrollmentDatesAugmentation,
  paperCtecAugmentation,
  paperCombosAugmentation,
  paperExportHelperAugmentation,
  paperHideTakenAugmentation,
  prereqFilterAugmentation,
  seatsNotesAugmentation,
  cartPageHydrator
];
