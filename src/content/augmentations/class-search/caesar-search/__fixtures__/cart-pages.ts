// Mid-wizard intermediate pages and the final cart-landing page.
// `isCartLandingPage` should reject these intermediate ids and accept any
// other valid response.

export const PREFS_PAGE_HTML = `<?xml version='1.0'?>
<PAGE id='SSR_SSENRL_PREFS_FL'>
<div>Choose enrollment preferences.</div>
</PAGE>`;

export const RELATED_PAGE_HTML = `<?xml version='1.0'?>
<PAGE id='SSR_SSENRL_RC_FL'>
<div>Related Class picker.</div>
</PAGE>`;

export const DETAIL_PAGE_HTML = `<?xml version='1.0'?>
<PAGE id='SSR_CLSRCH_DTL'>
<div>Section detail page.</div>
</PAGE>`;

export const CART_LANDING_HTML = `<?xml version='1.0'?>
<PAGE id='SSR_SSENRL_CART'>
<div>Class added to shopping cart.</div>
</PAGE>`;

// Matches the inline submitAction wiring `findNextActionId` looks for.
export const CONFIRM_PAGE_WITH_NEXT_HTML =
  `<div onclick="submitAction_win0(document.win0,'DERIVED_CLS_DTL_NEXT_PB');">Next</div>`;
