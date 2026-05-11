import { CartPageHydrator } from "../cart-cache";
import type { Augmentation } from "../framework";
import { classSearchAugmentation } from "./class-search";
import { ctecLinksAugmentation } from "./ctec-links";
import { enrollmentNavigationAugmentation } from "./enrollment-navigation";
import { paperCombosAugmentation } from "./paper-combos";
import { paperCtecAugmentation } from "./paper-ctec";
import { prereqFilterAugmentation } from "./prereq-filter";
import { seatsNotesAugmentation } from "./seats-notes";

// CartPageHydrator isn't user-facing — it's the source-of-truth writer for
// the shared cart cache. Listed here so the runner re-invokes it on every
// CAESAR DOM mutation, which is how PeopleSoft swaps the shopping cart in.
const cartPageHydrator = new CartPageHydrator();

export const augmentationRegistry: Augmentation[] = [
  enrollmentNavigationAugmentation,
  classSearchAugmentation,
  ctecLinksAugmentation,
  paperCtecAugmentation,
  paperCombosAugmentation,
  prereqFilterAugmentation,
  seatsNotesAugmentation,
  cartPageHydrator
];
