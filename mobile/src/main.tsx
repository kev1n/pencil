// The request and storage layer must exist before any extension module loads.
import "./platform/chrome-shim";

import "@ionic/react/css/core.css";
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";
import "@ionic/react/css/padding.css";
import "./theme.css";

import { setupIonicReact } from "@ionic/react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { initCaesarData } from "./data/caesar";
import { selectTerm } from "./data/catalog";
import { initRegistration } from "./data/registration";
import { initSchedule } from "./data/schedule";
import { bootstrapDesign } from "./platform/design";
import { listenForLinks } from "./data/share";
import { startSync } from "./data/sync";
import { startKeepAlive } from "./platform/keep-alive";
import { isMac, NUSession } from "./platform/native";
import { loadSessionState } from "./platform/session-state";

// Native styling follows the platform: iOS controls on iPhone and Mac,
// Material on Android.
setupIonicReact(isMac ? { mode: "ios" } : undefined);
if (isMac) document.documentElement.classList.add("mac");

bootstrapDesign();

async function start(): Promise<void> {
  await Promise.all([initSchedule(), initRegistration(), initCaesarData(), loadSessionState()]);
  // Development aid: `simctl launch <device> nu.pencil.app -route /you`
  // opens the app on that screen.
  const route = await NUSession.debugRoute().then((r) => r.route).catch(() => "");
  // `?term=5040` picks the term too.
  const params = new URLSearchParams(route.split("?")[1] ?? "");
  const term = params.get("term");
  if (term) selectTerm(term);
  (window as unknown as { launchParams: URLSearchParams }).launchParams = params;
  // Launch-route development aid: `?then=search` switches screen a moment
  // after launch.
  const then = params.get("then");
  if (then) setTimeout(() => window.dispatchEvent(new CustomEvent("pencil:go", { detail: then })), 3000);
  // `?drag=dx,dy` drags the Walk map by that much a moment after launch
  // (same aid: there is no pointer in a screenshot run).
  const dragBy = params.get("drag")?.split(",").map(Number);
  if (dragBy?.length === 2) {
    setTimeout(() => {
      const map = document.querySelector(".trail-map");
      const box = map?.getBoundingClientRect();
      if (!map || !box) return;
      const at = (type: string, x: number, y: number) =>
        map.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 7, clientX: box.left + box.width / 2 + x, clientY: box.top + box.height / 2 + y }));
      at("pointerdown", 0, 0);
      at("pointermove", dragBy[0]! / 2, dragBy[1]! / 2);
      at("pointermove", dragBy[0]!, dragBy[1]!);
      at("pointerup", dragBy[0]!, dragBy[1]!);
    }, 3500);
  }
  // `?scroll=<selector>` keeps that element scrolled to its end (same aid),
  // to check a pane really scrolls and to see what is at its foot.
  const scroll = params.get("scroll");
  if (scroll) setInterval(() => document.querySelector(scroll)?.scrollTo(0, 1e6), 2000);
  // `?over=<selector>` puts the pointer over that element (same aid), to
  // check what pointing at it previews. It also gets the class `is-over`,
  // styled like `:hover`, which a script cannot set.
  const over = params.get("over");
  if (over)
    setTimeout(() => {
      const target = document.querySelector(over);
      target?.classList.add("is-over");
      target?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    }, 6000);
  // `?click=<selector>` clicks that element a moment after launch (same aid);
  // `a;;b` clicks one after the other.
  (params.get("click") ?? "").split(";;").filter(Boolean).forEach((selector, i) =>
    setTimeout(() => (document.querySelector(selector) as HTMLElement | null)?.click(), 6000 + i * 2500)
  );
  startKeepAlive();
  listenForLinks(NUSession.launchLink());
  void startSync();
  createRoot(document.getElementById("root")!).render(<App initialRoute={route || "/schedule"} />);
}

void start();
