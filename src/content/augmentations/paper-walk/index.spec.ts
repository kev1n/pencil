// @vitest-environment-options {"url":"https://www.paper.nu/"}
import { expect, it, vi } from "vitest";

vi.mock("../paper-combos/data", () => ({ readPaperScheduleSnapshot: () => Promise.resolve(null) }));
vi.mock("../class-search/paper-data", () => ({ getTermCourses: () => Promise.resolve([]) }));

import { PaperWalkAugmentation, walkOf } from ".";

const section = (days: string, start: number, end: number, room: string) => ({
  section_id: `${days}-${start}`,
  course_id: "",
  subject: "X",
  catalog: "1-0",
  title: "",
  section: "1",
  component: "LEC",
  meeting_days: [days],
  start_time: [{ h: start, m: 0 }],
  end_time: [{ h: end, m: 0 }],
  room: [room]
});
const entry = (key: string, s: ReturnType<typeof section>) => ({ key, code: key, title: "", section: s });

it("orders a day's classes, places them, and leaves an overlapping one out", () => {
  const stops = walkOf(
    [
      entry("B", section("02", 11, 12, "Annenberg Hall G21")),
      entry("A", section("0", 9, 10, "Tech Institute Lecture Room 2")),
      entry("C", section("0", 11, 13, "Online"))
    ],
    0
  );
  expect(stops.map((stop) => stop.entry.key)).toEqual(["A", "B"]);
  expect(stops.map((stop) => stop.place?.name)).toEqual(["Tech", "Annenberg Hall"]);
});

// Paper.nu's map box as it is on the page: the box, a wrapper, the Leaflet map.
function paperMap(): { box: HTMLElement; wrapper: HTMLElement } {
  const box = document.createElement("div");
  const wrapper = document.createElement("div");
  wrapper.innerHTML = `<div class="leaflet-container"></div>`;
  box.append(wrapper);
  document.body.append(box);
  return { box, wrapper };
}

it("hides Paper.nu's map, mounts once, and puts everything back on cleanup", () => {
  document.body.innerHTML = "";
  const { box, wrapper } = paperMap();
  const walk = new PaperWalkAugmentation();
  walk.run(document);
  const host = document.getElementById("bc-paper-walk");
  expect(host?.parentElement).toBe(box);
  expect(wrapper.hasAttribute("data-bc-paper-walk-hidden")).toBe(true);

  // A second run (the runner re-runs on every mutation) keeps the same host.
  walk.run(document);
  expect(document.getElementById("bc-paper-walk")).toBe(host);
  expect(box.querySelectorAll("#bc-paper-walk")).toHaveLength(1);

  walk.cleanup(document);
  expect(document.getElementById("bc-paper-walk")).toBeNull();
  expect(document.getElementById("bc-paper-walk-style")).toBeNull();
  expect(document.querySelector("[data-bc-paper-walk-hidden]")).toBeNull();
});

it("hides Paper.nu's map again when Paper.nu draws it anew in the same box", () => {
  document.body.innerHTML = "";
  const { box, wrapper } = paperMap();
  const walk = new PaperWalkAugmentation();
  walk.run(document);
  wrapper.remove();
  const redrawn = document.createElement("div");
  redrawn.innerHTML = `<div class="leaflet-container"></div>`;
  box.prepend(redrawn);
  walk.run(document);
  expect(redrawn.hasAttribute("data-bc-paper-walk-hidden")).toBe(true);
  expect(box.querySelectorAll("#bc-paper-walk")).toHaveLength(1);
  walk.cleanup(document);
  expect(document.querySelector("[data-bc-paper-walk-hidden]")).toBeNull();
});
