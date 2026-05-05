// Synthesized CAESAR search-results AJAX fragment. Mirrors the shape
// `parseAjaxFragment` + `parseCaesarGroups` consume: an XML payload whose
// `win0divPAGECONTAINER` FIELD wraps HTML in CDATA, with one course-group
// header containing a section row keyed by `$0`.

export const SEARCH_RESULTS_HTML = `<?xml version='1.0'?>
<root>
<FIELD id='win0divPAGECONTAINER'><![CDATA[
<div id="win0divSSR_CLSRSLT_WRK_GROUPBOX2$0">
  <a id="SSR_CLSRSLT_WRK_GROUPBOX2$0" title="Collapse section COMP_SCI  111-0 - Fundamentals of Computer Programming"></a>
  <table>
    <tr>
      <td><a id="MTG_CLASS_NBR$0" href="#">12345</a></td>
    </tr>
  </table>
</div>
<span id="MTG_CLASSNAME$0">20-LEC</span>
<span id="MTG_DAYTIME$0">MoWeFr 1:00PM - 1:50PM</span>
<span id="MTG_ROOM$0">Tech&nbsp;LR2</span>
<span id="MTG_INSTR$0">Connor Bain<br>Sara Sood</span>
<span id="MTG_TOPIC$0">01/06/2025 - 03/14/2025</span>
<span id="NW_DERIVED_SS3_DESCR$0">Graded</span>
<div id="win0divDERIVED_CLSRCH_SSR_STATUS_LONG$0">
  <img alt="Status: Open" src="open.gif"/>
</div>
<div id="win0divSSR_PB_SELECT$0">
  <input type="button" value="Select"/>
</div>
]]></FIELD>
</root>`;

// Same fragment but with the Select button cell empty — mirrors what CAESAR
// does when the section is already in the user's shopping cart.
export const SEARCH_RESULTS_HTML_NO_SELECT = `<?xml version='1.0'?>
<root>
<FIELD id='win0divPAGECONTAINER'><![CDATA[
<div id="win0divSSR_CLSRSLT_WRK_GROUPBOX2$0">
  <a id="SSR_CLSRSLT_WRK_GROUPBOX2$0" title="Collapse section MATH 230-1 - Multivariable Differential Calculus"></a>
  <table>
    <tr>
      <td><a id="MTG_CLASS_NBR$0" href="#">22222</a></td>
    </tr>
  </table>
</div>
<span id="MTG_CLASSNAME$0">01-LEC</span>
<span id="MTG_DAYTIME$0">TuTh 9:30AM - 10:50AM</span>
<span id="MTG_ROOM$0">Lunt 105</span>
<span id="MTG_INSTR$0">Staff</span>
<span id="MTG_TOPIC$0">01/06/2025 - 03/14/2025</span>
<span id="NW_DERIVED_SS3_DESCR$0">Graded</span>
<div id="win0divDERIVED_CLSRCH_SSR_STATUS_LONG$0">
  <img alt="Status: Closed" src="closed.gif"/>
</div>
<div id="win0divSSR_PB_SELECT$0">&nbsp;</div>
]]></FIELD>
</root>`;
