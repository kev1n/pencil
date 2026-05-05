// Synthesized "related component" picker page that CAESAR returns after a
// SELECT for a course requiring a paired discussion / lab. Two radio rows
// in the SSR_CLS_TBL_R1 grid; column order is radio | Class Nbr | Section |
// Schedule | Room | Instructor | Status.

export const RELATED_COMPONENT_HTML = `<?xml version='1.0'?>
<root>
<FIELD id='win0divPAGECONTAINER'><![CDATA[
<table>
  <tr>
    <td><input type="radio" id="SSR_CLS_TBL_R1$sels$0$$0" value="0"/></td>
    <td>34601</td>
    <td>61-DIS</td>
    <td>Mo 4:00PM - 4:50PM</td>
    <td>Tech L168</td>
    <td>TA Alpha</td>
    <td><img alt="Status: Open" src="open.gif"/></td>
  </tr>
  <tr>
    <td><input type="radio" id="SSR_CLS_TBL_R1$sels$1$$0" value="1"/></td>
    <td>34602</td>
    <td>62-DIS</td>
    <td>We 4:00PM - 4:50PM</td>
    <td>Tech L168</td>
    <td>TA Beta</td>
    <td><img alt="Status: Wait List" src="waitlist.gif"/></td>
  </tr>
</table>
]]></FIELD>
</root>`;

// Search-results fragment masquerading as a related-component check —
// `parseRelatedComponentOptions` should return null for this since there
// are no radios.
export const RELATED_COMPONENT_NONE_HTML = `<?xml version='1.0'?>
<root>
<FIELD id='win0divPAGECONTAINER'><![CDATA[
<div>No related components on this page.</div>
]]></FIELD>
</root>`;
