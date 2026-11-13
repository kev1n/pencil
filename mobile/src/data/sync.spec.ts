// Several devices syncing through a stand-in relay. Each device is its own
// copy of the sync module with its own plan.
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECTIONS = ["c1", "c2", "c3", "c4"];
const relay = new Map<string, string>();

beforeEach(() => {
  relay.clear();
  vi.stubGlobal("chrome", { storage: { local: { set: async () => undefined, remove: async () => undefined, get: async () => ({}) } } });
  vi.stubGlobal("fetch", async (url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === "PUT") {
      relay.set(url, init.body ?? "");
      return new Response("", { status: 200 });
    }
    const blob = relay.get(url);
    return blob === undefined ? new Response("", { status: 404 }) : new Response(blob, { status: 200 });
  });
});

async function device(classes: string[]) {
  vi.resetModules();
  const planned: Record<string, { addedAt: number }> = {};
  const removed: Record<string, number> = {};
  classes.forEach((id, i) => (planned[`T|${id}`] = { addedAt: 100 + i }));
  vi.doMock("./schedule", () => ({
    scheduleChanges: () => ({ planned, removed }),
    addToSchedule: (e: { termId: string; section: { section_id: string } }, at: number) => {
      planned[`${e.termId}|${e.section.section_id}`] = { addedAt: at };
    },
    removeFromSchedule: (termId: string, sectionId: string, at: number) => {
      delete planned[`${termId}|${sectionId}`];
      removed[`${termId}|${sectionId}`] = at;
    },
    onScheduleChange: () => () => undefined
  }));
  vi.doMock("@ext/content/augmentations/class-search/paper-data", () => ({
    getTermCourses: async () => [{ subject: "X", catalog: "1", title: "t", sections: SECTIONS.map((section_id) => ({ section_id })) }]
  }));
  const sync = await import("./sync");
  const has = () => Object.keys(planned).map((key) => key.split("|")[1]).sort();
  return { ...sync, planned, has };
}

describe("sync groups", () => {
  it("merges plans when a device joins", async () => {
    const mac = await device(["c1"]);
    const a = mac.turnOnSync();
    await mac.syncNow();
    const phone = await device(["c2"]);
    await phone.joinSync(a);
    await mac.syncNow();
    expect(mac.has()).toEqual(["c1", "c2"]);
    expect(phone.has()).toEqual(["c1", "c2"]);
  });

  it("brings a whole group along when one of its devices joins another group", async () => {
    const mac = await device(["c1"]);
    const a = mac.turnOnSync();
    await mac.syncNow();
    const phone = await device(["c2"]);
    await phone.joinSync(a);

    const pc = await device(["c3"]);
    const b = pc.turnOnSync();
    await pc.syncNow();

    // The phone scans the PC's code. The Mac was never told directly.
    await phone.joinSync(b);
    await mac.syncNow();
    await pc.syncNow();
    for (const d of [mac, phone, pc]) expect(d.has()).toEqual(["c1", "c2", "c3"]);

    // A class added on the Mac now reaches the PC: they are one group.
    mac.planned["T|c4"] = { addedAt: 900 };
    await mac.syncNow();
    await pc.syncNow();
    expect(pc.has()).toEqual(["c1", "c2", "c3", "c4"]);

    // Scanning the old group's code afterwards leads back to the same group.
    await pc.joinSync(a);
    mac.planned["T|c4"] = { addedAt: 900 };
    await phone.syncNow();
    expect(phone.has()).toEqual(["c1", "c2", "c3", "c4"]);
    expect(relay.size).toBe(2);
  });
});
