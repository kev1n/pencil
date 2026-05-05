// Error responses from CAESAR. Two flavors:
//   1. <GENMSG> wrapping the error text in CDATA (the typical AJAX error).
//   2. The "term/career missing context" page id NW_TERM_STA1_FL.

export const GENMSG_ERROR_HTML = `<?xml version='1.0'?>
<root>
<GENMSG><![CDATA[The class number you entered is not valid for the term you selected.]]></GENMSG>
</root>`;

export const TERM_STATUS_PAGE_HTML = `<?xml version='1.0'?>
<PAGE id='NW_TERM_STA1_FL'>
<FIELD id='win0divPAGECONTAINER'><![CDATA[
<div>Term-status guard rail.</div>
]]></FIELD>
</PAGE>`;

// A plain, non-error fragment — `looksLikeError` should return false here.
export const NORMAL_FRAGMENT_HTML = `<?xml version='1.0'?>
<root>
<FIELD id='win0divPAGECONTAINER'><![CDATA[
<div>Search results loaded.</div>
]]></FIELD>
</root>`;
