// Live Back / Forward check for the caesar-history augmentation.
//
// Runs inside the Aside browser REPL (`mcp__aside__repl` or `aside repl`)
// against a signed-in CAESAR session with the unpacked build loaded. It only
// reads: it opens tabs and class details, runs class searches, opens and
// cancels read-only detail dialogs and presses Back / Forward. It never
// enrolls, drops, swaps, edits or adds anything.
//
//   const qa = await loadCaesarHistoryQa();   // paste this file first
//   for (const group of qa.GROUPS) console.log(group);
//   await qa.run("Cart");                     // one group per REPL call
//   for (const [tile, at] of qa.tileChunks()) // every tab of every tile,
//     await qa.run(tile, at);                 //   one chunk per REPL call
//   qa.summary();
//
// A REPL call may run for two minutes at most and a group or chunk takes
// under one, so run them one call at a time. A call that runs over drops the
// REPL session: paste the file again and carry on. `qa.rows` keeps every
// result and `qa.summary()` prints the totals, so "does Back work
// everywhere" is a fixed list of runs, not a guess.

async function loadCaesarHistoryQa() {
  const ORIGIN = "https://caesar.ent.northwestern.edu";
  const HOME = `${ORIGIN}/psc/csnu/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL?`;
  const CART = `${ORIGIN}/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.SSR_SSENRL_CART.GBL?Page=SSR_SSENRL_CART&Action=A`;
  const SEARCH = `${ORIGIN}/psc/csnu/EMPLOYEE/SA/c/SA_LEARNER_SERVICES.CLASS_SEARCH.GBL?Page=SSR_CLSRCH_ENTRY&Action=U`;
  const SETTLE = 5500;
  const rows = [];

  // What is on screen: the selected left tab, plus the page (top window or
  // content frame) title, heading and the classic search fields.
  const view = () =>
    page.evaluate(() => {
      const selected = document.querySelector(
        '.psc_selected[class*="psa_tab_"], .ps_ag-step-button.psc_selected'
      );
      const tab =
        selected?.getAttribute("onclick")?.match(/openCustomStepButton\('([^']+)'/)?.[1] ??
        (selected?.className.match(/psa_tab_\S+/) || [null])[0];
      const frame = document.querySelector("iframe.ps_target-iframe");
      let doc = document;
      try {
        if (frame?.contentDocument?.body) doc = frame.contentDocument;
      } catch {
        return { tab, heading: "(frame on another site)" };
      }
      const text = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim();
      return {
        tab,
        home: /PT_LANDINGPAGE/.test(location.pathname),
        host: location.host,
        // The frame's own title: the top window's title around a frame is
        // whatever page last set it, even on a first visit.
        title: doc.title,
        heading: text(doc.querySelector(".PAPAGETITLE")) || text(doc.querySelector("form.PSForm h1")).slice(0, 40),
        dead: /no longer available/i.test(doc.body?.innerText ?? ""),
        subject: doc.getElementById("SSR_CLSRCH_WRK_SUBJECT_SRCH$0")?.value ?? null,
        number: doc.getElementById("SSR_CLSRCH_WRK_CATALOG_NBR$1")?.value ?? null,
        classic: !!doc.getElementById("SSR_CLSRCH_WRK_CATALOG_NBR$1")?.offsetParent,
        sharper: doc.querySelector('input[placeholder*="comp_sci"]')?.value ?? null,
        sharperShown: !!doc.querySelector('input[placeholder*="comp_sci"]')?.offsetParent
      };
    });
  // Whether CAESAR is still working: its "processing" marker is showing, or
  // the top window or content frame is still loading.
  const busy = () =>
    page.evaluate(() => {
      const docs = [document];
      try {
        const frame = document.querySelector("iframe.ps_target-iframe")?.contentDocument;
        if (frame) docs.push(frame);
      } catch {
        // Frame on another site: nothing of CAESAR's to wait for there.
      }
      return docs.some(
        (doc) =>
          doc.readyState !== "complete" ||
          [...doc.querySelectorAll('[id^="WAIT_win"]')].some(
            (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden"
          )
      );
    });
  // Waits for an action to finish: a short pause for it to start, then until
  // CAESAR is idle and the view reads the same twice in a row. Fluid pages do
  // not always show CAESAR's processing marker, so steps that wait on a
  // server round trip without a visible change (opening or re-opening a
  // left-hand tab) wait for the expected view instead: `openSideTab`, `reach`.
  async function settled(min) {
    await sleep(Math.min(min, 1500));
    let last = null;
    for (const until = Date.now() + 8000; Date.now() < until; ) {
      const shown = await view();
      const now = JSON.stringify(shown);
      // An empty title is a content frame between two pages.
      if (now === last && shown.title && !(await busy())) return;
      last = now;
      await sleep(700);
    }
  }
  const same = (a, b) => a.tab === b.tab && a.title === b.title && a.heading === b.heading;
  const label = (v) => `${v.title}${v.heading && v.heading !== v.title ? " / " + v.heading : ""}`;
  // Re-opening a tab is a server round trip, which CAESAR has been seen to
  // take 20 s over. Waits until the view is `target`, or gives up and returns
  // whatever is showing; a wrong view never matches, so it still fails.
  async function reach(target) {
    let now = await view();
    for (const until = Date.now() + 25000; Date.now() < until && !(same(now, target) && !now.dead); ) {
      await sleep(700);
      now = await view();
    }
    return now;
  }

  // Runs `fn` in the content frame when there is one, else the top window.
  const inPage = (fn, arg) =>
    page.evaluate(
      ([source, value]) => {
        const frame = document.querySelector("iframe.ps_target-iframe");
        const target = frame ? frame.contentWindow : window;
        return target.eval(`(${source})`)(value);
      },
      [fn.toString(), arg]
    );
  const clickId = (id) => inPage((value) => document.getElementById(value).click(), id);
  const back = async (wait = SETTLE) => {
    await page.evaluate(() => history.back());
    await settled(wait);
  };
  const forward = async (wait = SETTLE) => {
    await page.evaluate(() => history.forward());
    await settled(wait);
  };
  const check = (name, pass, detail) => {
    rows.push({ name, pass: !!pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${pass ? "" : "  <- " + detail}`);
  };

  const sideTabs = () =>
    page.evaluate(() => {
      const seen = new Set();
      const tabs = [];
      for (const el of document.querySelectorAll('[onclick][class*="psa_tab_"], .ps_ag-step-button[onclick]')) {
        const handler = el.getAttribute("onclick");
        const step = handler.match(/openCustomStepButton\('([^']+)'/)?.[1];
        const key = step ?? (el.className.match(/psa_tab_\S+/) || [null])[0];
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const url = handler.match(/LaunchURL\(null,'([^']+)'/)?.[1] ?? el.getAttribute("href") ?? "";
        const text = step ? el.textContent.replace(/^[\s\S]*Step Label/, "") : el.closest("li")?.textContent ?? "";
        tabs.push({ key, name: text.replace(/\s+/g, " ").trim().slice(0, 30), internal: url.includes("caesar.ent.northwestern.edu") });
      }
      return tabs;
    });
  // Picks a left-hand tab and waits for its content: the tab is marked
  // selected at once, its page arrives after a server round trip.
  const openSideTab = async (key) => {
    const before = await view();
    await page.evaluate((value) => {
      [...document.querySelectorAll('[onclick][class*="psa_tab_"], .ps_ag-step-button[onclick]')]
        .find((el) => el.getAttribute("onclick").includes(`'${value}'`) || el.classList.contains(value))
        .click();
    }, key);
    for (let now = before, until = Date.now() + 25000; Date.now() < until; now = await view()) {
      // A step-list tab swaps the content frame out; the gap between frames
      // reads as an empty title, which is not the tab's content yet.
      if (now.tab === key && now.title && (now.title !== before.title || now.heading !== before.heading) && !(await busy())) break;
      await sleep(700);
    }
    await settled(1500);
  };
  const openTile = async (name) => {
    await page.goto(HOME);
    await settled(4500);
    const found = await page.evaluate((value) => {
      const tile = [...document.querySelectorAll('[id^="win0divPTNUI_LAND_REC_GROUPLET$"]')].find((el) =>
        el.textContent.replace(/\s+/g, " ").trim().startsWith(value)
      );
      tile?.click();
      return !!tile;
    }, name);
    // The Homepage stays up, idle, until the tile's page starts loading; the
    // tab list renders after the page, marks the first tab selected, and its
    // content arrives last. A tab picked before then is ignored by CAESAR.
    for (const until = Date.now() + 15000; found && Date.now() < until && !(await view()).tab; ) await sleep(500);
    const shell = await view();
    for (const until = Date.now() + 12000; found && Date.now() < until && (await view()).title === shell.title; ) await sleep(500);
    await settled(1500);
    return found;
  };

  // Walks `count` of a tile's CAESAR-hosted tabs from `from` on, then presses
  // Back once per tab and Forward once, expecting each earlier view in turn.
  // A tile with more tabs than fit in one REPL call is walked in chunks:
  // `tileChunks()` lists them.
  async function tile(name, { from = 0, count = TABS_PER_CHUNK } = {}) {
    if (!(await openTile(name))) return check(`${name}: tile opens`, false, "tile not found");
    const start = await view();
    const all = (await sideTabs()).filter((tab) => tab.internal && tab.key !== start.tab);
    const tabs = all.slice(from, from + count);
    console.log(`${name}: tabs ${from + 1}-${from + tabs.length} of ${all.length}: ${tabs.map((tab) => tab.name).join(", ")}`);
    if (tabs.length === 0) return check(`${name}: has other tabs`, true, "nothing to walk");
    const visited = [start];
    for (const tab of tabs) {
      await openSideTab(tab.key);
      visited.push(await view());
    }
    for (let i = visited.length - 2; i >= 0; i -= 1) {
      await back();
      const now = await reach(visited[i]);
      check(`${name}: Back to "${label(visited[i])}"`, same(now, visited[i]) && !now.dead, `got "${label(now)}"`);
    }
    await forward();
    const now = await reach(visited[1]);
    check(`${name}: Forward to "${label(visited[1])}"`, same(now, visited[1]), `got "${label(now)}"`);
    await back();
    await back();
    const out = await view();
    check(`${name}: Back from first tab leaves to Homepage`, out.home, `got "${label(out)}"`);
  }

  // Classic search → results → detail, then Back twice. Works on whatever
  // page is showing Class Search (standalone, or inside Manage Classes).
  async function classicSearch(name) {
    await searchTabs(name);
    await inPage(() => [...document.querySelectorAll("button")].find((b) => /Classic CAESAR/.test(b.textContent))?.click());
    await settled(1500);
    if (!(await view()).classic) return check(`${name}: Classic CAESAR tab opens`, false, "classic search form not shown");
    await inPage(() => {
      const fill = (id, value) => {
        const field = document.getElementById(id);
        field.value = value;
        field.dispatchEvent(new Event("input", { bubbles: true }));
        field.dispatchEvent(new Event("change", { bubbles: true }));
      };
      fill("SSR_CLSRCH_WRK_SUBJECT_SRCH$0", "COMP_SCI");
      fill("SSR_CLSRCH_WRK_CATALOG_NBR$1", "349");
    });
    await settled(2500);
    await clickId("CLASS_SRCH_WRK2_SSR_PB_CLASS_SRCH");
    await settled(6000);
    const results = await view();
    check(`${name}: search shows results`, results.heading === "Search Results", `got "${label(results)}"`);
    await clickId("MTG_CLASSNAME$0");
    await settled(5000);
    check(`${name}: opens a class`, (await view()).heading === "Class Detail", "no class detail");
    await back(3000);
    let now = await view();
    check(`${name}: Back to results`, now.heading === "Search Results" && !now.dead, `got "${label(now)}"`);
    await back(3000);
    now = await view();
    check(
      `${name}: Back to criteria with fields kept`,
      now.heading === "Enter Search Criteria" && now.classic && now.subject === "COMP_SCI" && now.number === "349",
      `got "${label(now)}" subject=${now.subject} number=${now.number} classicTab=${now.classic}`
    );
    await forward(3000);
    now = await view();
    check(`${name}: Forward to results`, now.heading === "Search Results", `got "${label(now)}"`);
    // CAESAR's own return button must not stack a second copy.
    await clickId("MTG_CLASSNAME$0");
    await settled(5000);
    await clickId("CLASS_SRCH_WRK2_SSR_PB_BACK");
    await settled(5000);
    await back(3000);
    now = await view();
    check(`${name}: Back after CAESAR's own "View Search Results"`, now.heading === "Enter Search Criteria", `got "${label(now)}"`);
  }

  // Pencil's Sharper Search / Classic CAESAR tabs: switch, Back, Forward.
  // Ends on the tab the page opened with.
  async function searchTabs(name) {
    const pick = (label) =>
      inPage((value) => [...document.querySelectorAll("button")].find((b) => b.textContent.includes(value))?.click(), label);
    const start = await view();
    const other = start.sharperShown ? "Classic CAESAR" : "Sharper Search";
    await pick(other);
    await settled(1500);
    const switched = await view();
    check(`${name}: switches search tab`, switched.sharperShown !== start.sharperShown, "tab did not change");
    await back(2000);
    let now = await view();
    check(`${name}: Back to the first search tab`, now.sharperShown === start.sharperShown && !now.home, `got "${label(now)}"`);
    await forward(2000);
    now = await view();
    check(`${name}: Forward to the other search tab`, now.sharperShown === switched.sharperShown, `got "${label(now)}"`);
    await back(2000);
  }

  async function standaloneSearch() {
    await page.goto(HOME);
    await settled(4000);
    await page.goto(SEARCH);
    await settled(4500);
    await classicSearch("Class Search (standalone)");
    // On the criteria page now; the opening search tab may sit one entry
    // behind it, so allow one extra press.
    await back(4500);
    if (!(await view()).home) await back(4500);
    check("Class Search (standalone): Back leaves to Homepage", (await view()).home, "did not leave");
  }

  async function manageClassesSearch() {
    if (!(await openTile("Manage Classes"))) return check("Manage Classes: tile opens", false, "tile not found");
    const before = await view();
    const search = (await sideTabs()).find((tab) => tab.name === "Class Search");
    await openSideTab(search.key);
    await settled(3000);
    await classicSearch("Class Search (in Manage Classes)");
    await back();
    if ((await view()).tab === search.key) await back();
    const now = await reach(before);
    check("Class Search (in Manage Classes): Back to previous left tab", same(now, before), `got "${label(now)}"`);
  }

  // Leave the Class Search tab mid-search and come back.
  async function manageClassesReturn() {
    if (!(await openTile("Manage Classes"))) return check("Manage Classes: tile opens", false, "tile not found");
    const before = await view();
    const search = (await sideTabs()).find((tab) => tab.name === "Class Search");
    await openSideTab(search.key);
    await settled(3000);
    // Pencil's search panel mounts once CAESAR's own form has finished loading.
    for (const until = Date.now() + 20000; Date.now() < until && !(await view()).sharperShown; ) {
      await inPage(() => [...document.querySelectorAll("button")].find((b) => /Sharper Search/.test(b.textContent))?.click());
      await sleep(1000);
    }
    await inPage(() => {
      const input = document.querySelector('input[placeholder*="comp_sci"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "comp_sci 349");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settled(2500);
    const drop = (await sideTabs()).find((tab) => tab.name === "Drop Classes");
    await openSideTab(drop.key);
    await back(8000);
    const returned = await view();
    check(
      "Class Search (in Manage Classes): Back from another tab keeps the Sharper query",
      returned.tab === search.key && returned.sharper === "comp_sci 349",
      `got "${label(returned)}" query=${returned.sharper}`
    );
    await back();
    const out = await reach(before);
    check("Class Search (in Manage Classes): next Back goes to previous left tab, no dead press", same(out, before), `got "${label(out)}"`);
  }

  // Back pressed twice before CAESAR has answered the first: the second
  // tab is picked while the first is still loading, which CAESAR ignores
  // unless the pick is repeated.
  async function quickDoubleBack() {
    if (!(await openTile("Manage Classes"))) return check("Manage Classes: tile opens", false, "tile not found");
    const before = await view();
    const tabs = await sideTabs();
    await openSideTab(tabs.find((tab) => tab.name === "Class Search").key);
    await openSideTab(tabs.find((tab) => tab.name === "Drop Classes").key);
    await page.evaluate(() => history.back());
    await sleep(400);
    await page.evaluate(() => history.back());
    const now = await reach(before);
    check("Manage Classes: two quick Backs land two tabs back", same(now, before) && !now.dead, `got "${label(now)}"`);
    await back();
    const out = await view();
    check("Manage Classes: next Back leaves to Homepage", out.home, `got "${label(out)}"`);
  }

  async function cart() {
    await page.goto(HOME);
    await settled(4000);
    await page.goto(CART);
    await settled(4500);
    const cartView = await view();
    // A class followed by a row without a link is paired with a lab or
    // discussion and opens a different page, so pick classes that stand alone.
    const links = await inPage(() =>
      [...document.querySelectorAll('a[id^="P_CLASS_NAME$"]')]
        .map((a) => a.id)
        .filter((id) => document.getElementById("P_CLASS_NAME$" + (Number(id.split("$")[1]) + 1)))
    );
    if (links.length < 2) return check("Cart: has two classes to open", false, "cart has fewer than two classes");
    await clickId(links[0]);
    await settled(4000);
    const detail = await view();
    check("Cart: opens a class", detail.heading !== cartView.heading, "page did not change");
    await back(2500);
    let now = await view();
    check("Cart: Back to cart", same(now, cartView) && !now.dead, `got "${label(now)}"`);
    await forward(2500);
    check("Cart: Forward to class", same(await view(), detail), "wrong page");
    await back(2500);
    await clickId(links[links.length - 1]);
    await settled(4000);
    now = await view();
    check("Cart: restored cart still works (opens another class)", now.heading === detail.heading && !now.dead, `got "${label(now)}"`);
    // Past what the server keeps: Back must give a fresh cart, not a dead page.
    for (let i = 0; i < 6; i += 1) {
      await clickId(i % 2 ? "CLASS_MTG_VW$srt1$0" : "CLASS_MTG_VW$srt0$0");
      await settled(2500);
    }
    await back(6000);
    now = await view();
    check("Cart: Back past the server's limit loads a fresh cart", now.heading === cartView.heading && !now.dead, `got "${label(now)}"`);
    await back(5000);
    check("Cart: Back from fresh cart leaves to Homepage", (await view()).home, "did not leave");
  }

  // A classic page inside the content frame other than Class Search:
  // Manage Classes → Shopping Cart and Enroll → a class → Back / Forward.
  async function framedCart() {
    if (!(await openTile("Manage Classes"))) return check("Manage Classes: tile opens", false, "tile not found");
    const before = await view();
    const tab = (await sideTabs()).find((t) => /Shopping Cart/.test(t.name));
    await openSideTab(tab.key);
    const cartView = await view();
    const classes = await inPage(() =>
      [...document.querySelectorAll('a[id^="P_CLASS_NAME$"]')]
        .map((a) => a.id)
        .filter((id) => document.getElementById("P_CLASS_NAME$" + (Number(id.split("$")[1]) + 1)))
    );
    if (classes.length < 2) return check("Cart (in Manage Classes): has two classes to open", false, `found ${classes.length}`);
    await clickId(classes[0]);
    await settled(4500);
    const detail = await view();
    check("Cart (in Manage Classes): opens a class", detail.heading !== cartView.heading, "page did not change");
    await back(3500);
    let now = await view();
    check("Cart (in Manage Classes): Back to cart", same(now, cartView) && !now.dead, `got "${label(now)}"`);
    await forward(3500);
    check("Cart (in Manage Classes): Forward to class", same(await view(), detail), "wrong page");
    await back(3500);
    await clickId(classes[1]);
    await settled(4500);
    now = await view();
    check("Cart (in Manage Classes): restored cart still works", now.heading === detail.heading && !now.dead, `got "${label(now)}"`);
    await back(3500);
    await back();
    now = await reach(before);
    check("Cart (in Manage Classes): Back to previous left tab", same(now, before), `got "${label(now)}"`);
  }

  const gradesTab = "psa_tab_SSR_VWGD_GRADE_FL";
  const dialogShown = () => page.evaluate(() => !!document.querySelector('#pt_modals [id^="ptMod_"]'));
  const stateNum = () => page.evaluate(() => Number(document.querySelector("#ICStateNum")?.value));
  const termCount = () => page.evaluate(() => document.querySelectorAll('a[id^="TERM$"]').length);
  const cancelDialog = () =>
    page.evaluate(() => document.querySelector('iframe[id^="ptModFrame_"]')?.contentDocument?.getElementById("#ICCancel")?.click());

  // A fluid tab: Academic Records → View Grades → a term → Back / Forward.
  async function viewGrades() {
    if (!(await openTile("Academic Records"))) return check("Academic Records: tile opens", false, "tile not found");
    const before = await view();
    await openSideTab(gradesTab);
    const list = await view();
    await clickId("TERM$1");
    await settled(5000);
    const term = await view();
    check("View Grades: picks a term", term.heading !== list.heading, `got "${label(term)}"`);
    await back(4000);
    let now = await view();
    check("View Grades: Back to the term list", same(now, list) && (await termCount()) > 0 && !now.dead, `got "${label(now)}"`);
    await forward(4000);
    check("View Grades: Forward to the term", same(await view(), term), "wrong page");
    await back(4000);
    await clickId("TERM$2");
    await settled(5000);
    now = await view();
    check("View Grades: restored term list still works", same(now, term) && !now.dead, `got "${label(now)}"`);
    await back(4000);
    await back();
    now = await reach(before);
    check("View Grades: Back to previous left tab", same(now, before), `got "${label(now)}"`);
  }

  // A PeopleSoft dialog on a fluid page (View Grades → a term → Term GPA
  // details): Back closes it; its own Close does too, without an extra entry.
  async function viewGradesDialogs() {
    if (!(await openTile("Academic Records"))) return check("Academic Records: tile opens", false, "tile not found");
    const before = await view();
    await openSideTab(gradesTab);
    const list = await view();
    await clickId("TERM$1");
    await settled(5000);
    const term = await view();
    let now;
    await clickId("DERIVED_ACRD_FL_DESCRFORMAL$0");
    await settled(4000);
    check("View Grades (dialogs): opens the Term GPA dialog", await dialogShown(), "no dialog");
    await back(4000);
    now = await view();
    check("View Grades (dialogs): Back closes the dialog", !(await dialogShown()) && same(now, term), `dialog=${await dialogShown()} got "${label(now)}"`);
    await clickId("DERIVED_ACRD_FL_DESCRFORMAL$1");
    await settled(4000);
    check("View Grades (dialogs): another dialog opens after Back closed one", await dialogShown(), "no dialog");
    await cancelDialog();
    await settled(3500);
    check("View Grades (dialogs): dialog's own Close closes it", !(await dialogShown()), "still open");
    await back(4000);
    now = await view();
    check("View Grades (dialogs): Back after closing a dialog goes to the term list", same(now, list) && !now.dead, `got "${label(now)}"`);
    await back();
    now = await reach(before);
    check("View Grades (dialogs): Back to previous left tab", same(now, before), `got "${label(now)}"`);
  }

  // Back to a fluid page more than five server states ago must load it
  // afresh. Each dialog open + close uses two states without adding entries.
  // A fresh View Grades opens on the term CAESAR last showed (the server
  // remembers it even across tabs), so "fresh" is checked by state number
  // and by the page answering, not by which of its views it shows.
  async function viewGradesDeep() {
    if (!(await openTile("Academic Records"))) return check("Academic Records: tile opens", false, "tile not found");
    const before = await view();
    await openSideTab(gradesTab);
    const list = await view();
    const listState = await stateNum();
    await clickId("TERM$1");
    await settled(5000);
    for (let i = 0; i < 3; i += 1) {
      await clickId("DERIVED_ACRD_FL_DESCRFORMAL$0");
      await settled(3500);
      await cancelDialog();
      await settled(3000);
    }
    const deepState = await stateNum();
    check("View Grades (deep): more than five states past the term list", deepState - listState > 5, `list=${listState} now=${deepState}`);
    await back(6000);
    let now = await view();
    const freshState = await stateNum();
    check(
      "View Grades (deep): Back loads View Grades afresh",
      now.tab === list.tab && !now.dead && freshState > deepState,
      `got "${label(now)}" state ${listState} -> ${deepState} -> ${freshState}`
    );
    if ((await termCount()) > 0) await clickId("TERM$3");
    else await clickId("DERIVED_ACRD_FL_DESCRFORMAL$0");
    await settled(5000);
    now = await view();
    check("View Grades (deep): the fresh page answers", ((await dialogShown()) || now.heading !== list.heading) && !now.dead, `got "${label(now)}"`);
    if (await dialogShown()) {
      await cancelDialog();
      await settled(3500);
    } else {
      await back(4000);
    }
    await back();
    now = await reach(before);
    check("View Grades (deep): Back to previous left tab", same(now, before), `got "${label(now)}"`);
  }

  // Other sessions share the unpacked-extension folder and can swap the
  // build mid-run. A run only counts if this build was recording history
  // both before and after it.
  // `bcHistoryState` on the top document is this version's copy of the
  // current history entry; older builds of the plugin do not keep it.
  const buildActive = () =>
    page.evaluate(() => !!history.state?.bcHistory && "bcHistoryState" in document.documentElement.dataset);
  async function guarded(name, fn) {
    const from = rows.length;
    await page.goto(HOME);
    await settled(4500);
    const before = await buildActive();
    if (before) await fn();
    await page.goto(HOME);
    await settled(4500);
    if (before && (await buildActive())) return;
    rows.length = from;
    check(`${name}: this build is the one loaded`, false, "another build was loaded; results discarded, re-sync and re-run");
  }

  const TILES = [
    "Profile",
    "Degree Progress",
    "Academic Records",
    "Financial Aid",
    "Tasks",
    "Manage Classes",
    "Account and Payments",
    "Student Agreements"
  ];

  // CAESAR-hosted tabs besides the one each tile opens on, as of 2026-11.
  // Tabs that open another site (Bluera, catalogs, registrar forms, the
  // identity portal, Starfish) are skipped by `tile()`.
  const TILE_TABS = {
    Profile: 10,
    "Degree Progress": 3,
    "Academic Records": 6,
    "Financial Aid": 5,
    Tasks: 2,
    "Manage Classes": 8,
    "Account and Payments": 4,
    "Student Agreements": 1
  };
  const TABS_PER_CHUNK = 2;
  // One entry per REPL call: [tile, { from }].
  const tileChunks = () =>
    TILES.flatMap((name) =>
      Array.from({ length: Math.ceil(TILE_TABS[name] / TABS_PER_CHUNK) }, (_, i) => [name, { from: i * TABS_PER_CHUNK }])
    );

  const GROUPS = [
    "Cart",
    "Cart (in Manage Classes)",
    "Class Search (standalone)",
    "Class Search (in Manage Classes)",
    "Class Search (leave and return)",
    "Manage Classes (quick double Back)",
    "View Grades",
    "View Grades (dialogs)",
    "View Grades (past the server's limit)",
    ...TILES
  ];

  // Runs one group. A tile walks the chunk of tabs `options.from` names
  // (default the first chunk); `tileChunks()` covers every tab.
  function run(group, options) {
    if (group === "Cart") return guarded(group, cart);
    if (group === "Cart (in Manage Classes)") return guarded(group, framedCart);
    if (group === "Class Search (standalone)") return guarded(group, standaloneSearch);
    if (group === "Class Search (in Manage Classes)") return guarded(group, manageClassesSearch);
    if (group === "Class Search (leave and return)") return guarded(group, manageClassesReturn);
    if (group === "Manage Classes (quick double Back)") return guarded(group, quickDoubleBack);
    if (group === "View Grades") return guarded(group, viewGrades);
    if (group === "View Grades (dialogs)") return guarded(group, viewGradesDialogs);
    if (group === "View Grades (past the server's limit)") return guarded(group, viewGradesDeep);
    return guarded(group, () => tile(group, options));
  }

  function summary() {
    const failed = rows.filter((row) => !row.pass);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
    for (const row of failed) console.log(`FAIL  ${row.name}  <- ${row.detail}`);
    return rows;
  }

  return {
    run, GROUPS, summary, guarded, cart, standaloneSearch, manageClassesSearch, manageClassesReturn, tile, view, rows, TILES,
    tileChunks, framedCart, viewGrades, viewGradesDialogs, viewGradesDeep,
    // For poking at a page by hand.
    sideTabs, openTile, openSideTab, inPage, back, forward
  };
}
