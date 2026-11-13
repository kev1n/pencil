import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from "@ionic/react";
import { IonReactMemoryRouter } from "@ionic/react-router";
import { calendarOutline, mapOutline, personCircleOutline, searchOutline } from "ionicons/icons";
import { createMemoryHistory } from "history";
import { useEffect, useMemo, useState } from "react";
import { Redirect, Route } from "react-router-dom";
import pencilIcon from "@ext/assets/icons/pencil.svg";
import { incomingLink } from "./data/share";
import { CoursePage } from "./pages/CoursePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SchedulePage } from "./pages/SchedulePage";
import { SearchPage } from "./pages/SearchPage";
import { WalkPage } from "./pages/WalkPage";
import { YouPage } from "./pages/YouPage";
import { Welcome } from "./components/Welcome";

const TABS = [
  { tab: "schedule", label: "Schedule", icon: calendarOutline },
  { tab: "search", label: "Search", icon: searchOutline },
  { tab: "walk", label: "Walk", icon: mapOutline },
  { tab: "you", label: "You", icon: personCircleOutline }
];

// Tabs own the navigation; the wide layout's side list and the Mac menus
// go through them.
function shownWeek(): HTMLElement | null {
  return [...document.querySelectorAll<HTMLElement>(".week")].find((el) => el.getClientRects().length > 0) ?? null;
}

function showTab(tab: string): void {
  const button = document.querySelector<HTMLElement>(`ion-tab-button[tab="${tab}"]`);
  if (!button || button.classList.contains("tab-selected")) return;
  // In a wide window the screens change as one movement: the week travels
  // from where it was to where it is on the new screen, and the rest of
  // that screen arrives around it (theme.css, under `.arriving`).
  const wide = window.matchMedia("(min-width: 900px)").matches;
  const from = wide ? shownWeek() : null;
  const was = from?.getBoundingClientRect();
  button.click();
  if (!wide) return;
  const began = performance.now();
  const arrive = () => {
    const week = shownWeek();
    // The new screen is up once the old week is gone; it may have no week.
    if (week === from || !button.classList.contains("tab-selected")) {
      if (performance.now() - began < 800) requestAnimationFrame(arrive);
      return;
    }
    const root = document.documentElement;
    root.classList.add("arriving");
    setTimeout(() => root.classList.remove("arriving"), 420);
    if (!week) return;
    const now = week.getBoundingClientRect();
    if (!was) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || now.width === 0 || now.height === 0) return;
    week.animate(
      [
        {
          transformOrigin: "0 0",
          transform: `translate(${was.left - now.left}px, ${was.top - now.top}px) scale(${was.width / now.width}, ${was.height / now.height})`
        },
        { transformOrigin: "0 0", transform: "none" }
      ],
      { duration: 360, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)" }
    );
  };
  requestAnimationFrame(arrive);
}

export function App({ initialRoute }: { initialRoute: string }) {
  const history = useMemo(() => createMemoryHistory({ initialEntries: [initialRoute] }), [initialRoute]);
  const [path, setPath] = useState(history.location.pathname);
  useEffect(() => history.listen((location) => setPath(location.pathname)), [history]);

  // A plan link the app was opened with is handled on You.
  useEffect(() => incomingLink.subscribe(() => incomingLink.get() && showTab("you")), []);
  useEffect(() => {
    if (incomingLink.get()) setTimeout(() => showTab("you"), 300);
  }, []);

  // The Mac app's menus and shortcuts.
  useEffect(() => {
    const find = () => {
      // A wide window has the search down the left of Schedule.
      showTab(window.matchMedia("(min-width: 900px)").matches ? "schedule" : "search");
      setTimeout(() => document.querySelector<HTMLInputElement>(".search-top input")?.focus(), 150);
    };
    const go = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (tab === "search" && window.matchMedia("(min-width: 900px)").matches) find();
      else showTab(tab);
    };
    window.addEventListener("pencil:go", go);
    window.addEventListener("pencil:find", find);
    return () => {
      window.removeEventListener("pencil:go", go);
      window.removeEventListener("pencil:find", find);
    };
  }, []);

  return (
    <IonApp>
      <nav className="side">
        <span className="hand">
          <img src={pencilIcon} alt="" width="22" height="22" />
          <span>Pencil</span>
        </span>
        {TABS.filter(({ tab }) => tab !== "search").map(({ tab, label, icon }) => (
          <button key={tab} className={`side-item${path.startsWith(`/${tab}`) ? " is-on" : ""}`} title={label} onClick={() => showTab(tab)}>
            <IonIcon icon={icon} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <IonReactMemoryRouter history={history}>
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/search" component={SearchPage} />
            <Route exact path="/search/course/:termId/:subject/:catalog" component={CoursePage} />
            <Route exact path="/schedule" component={SchedulePage} />
            <Route exact path="/walk" component={WalkPage} />
            <Route exact path="/you" component={YouPage} />
            <Route exact path="/you/history" component={HistoryPage} />
            <Route exact path="/">
              <Redirect to="/schedule" />
            </Route>
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="schedule" href="/schedule">
              <IonIcon icon={calendarOutline} />
              <IonLabel>Schedule</IonLabel>
            </IonTabButton>
            <IonTabButton tab="search" href="/search">
              <IonIcon icon={searchOutline} />
              <IonLabel>Search</IonLabel>
            </IonTabButton>
            <IonTabButton tab="walk" href="/walk">
              <IonIcon icon={mapOutline} />
              <IonLabel>Walk</IonLabel>
            </IonTabButton>
            <IonTabButton tab="you" href="/you">
              <IonIcon icon={personCircleOutline} />
              <IonLabel>You</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      </IonReactMemoryRouter>
      <Welcome />
    </IonApp>
  );
}
