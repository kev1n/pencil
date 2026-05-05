// Barrel re-export. Preserves the public surface of the original
// caesar-search.ts so callers (`augmentation.ts`, `paper-ctec/cart-flow.ts`,
// `catalog-cache.ts`) keep working unchanged.

export {
  CaesarAuthRequiredError,
  isCaesarAuthRequiredError,
  type CaesarCourseGroup,
  type CaesarSearchInput,
  type CaesarSearchResult,
  type CaesarSection,
  type CaesarStatus,
  type CartFlowContinuationInput,
  type CartFlowInput,
  type CartFlowResult,
  type RelatedSectionOption
} from "./types";

export {
  careerOrderFor,
  matchCaesarGroup,
  matchCaesarSection,
  normalizeSectionNumber,
  parseAjaxFragment,
  parseCaesarGroups,
  parseRelatedComponentOptions,
  parseSectionRow,
  parseStatus,
  splitCourseIdAndTitle,
  statusFromAlt
} from "./parser";

export {
  buildClassNumberSearchParams,
  buildSearchPostParams,
  isCartLandingPage,
  looksLikeError
} from "./forms";

export {
  addSectionToCart,
  continueCartAddWithRelated,
  searchCaesarCatalog
} from "./flow";
