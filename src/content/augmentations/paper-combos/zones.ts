import { logQuiet } from "../../../shared/log";
import type { ComboSection } from "./types";

const ZONES_STORAGE_KEY = "better-caesar:paper-combos-zones:v1";

export type ProhibitedZone = {
  id: string;
  day: number; // 0=Mon..4=Fri
  startMin: number; // minutes from midnight
  endMin: number;
};

let zonesCache: ProhibitedZone[] | null = null;

function isValidZone(value: unknown): value is ProhibitedZone {
  if (!value || typeof value !== "object") return false;
  const z = value as Record<string, unknown>;
  return (
    typeof z.id === "string" &&
    typeof z.day === "number" &&
    typeof z.startMin === "number" &&
    typeof z.endMin === "number" &&
    z.day >= 0 &&
    z.day <= 4 &&
    z.startMin >= 0 &&
    z.endMin > z.startMin
  );
}

export async function loadZones(): Promise<ProhibitedZone[]> {
  if (zonesCache) return zonesCache;
  try {
    const result = (await chrome.storage.local.get(ZONES_STORAGE_KEY)) as Record<
      string,
      unknown
    >;
    const raw = result[ZONES_STORAGE_KEY];
    if (!Array.isArray(raw)) {
      zonesCache = [];
      return zonesCache;
    }
    zonesCache = raw.filter(isValidZone);
    return zonesCache;
  } catch (err) {
    logQuiet("paper-combos.zones.load", err);
    zonesCache = [];
    return zonesCache;
  }
}

export async function saveZones(zones: ProhibitedZone[]): Promise<void> {
  zonesCache = [...zones];
  try {
    await chrome.storage.local.set({ [ZONES_STORAGE_KEY]: zonesCache });
  } catch (err) {
    logQuiet("paper-combos.zones.save", err);
  }
}

// Subscribe to live zone updates from chrome.storage (e.g. another tab
// or the popup wrote to the key). The augmentation re-runs combos when
// the cache changes.
export function subscribeZoneChanges(callback: () => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ): void => {
    if (areaName !== "local") return;
    const change = changes[ZONES_STORAGE_KEY];
    if (!change) return;
    const next = change.newValue;
    zonesCache = Array.isArray(next) ? next.filter(isValidZone) : [];
    callback();
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

// Two minutes-ranges overlap if either's start lies inside the other —
// using `<=` so back-to-back zones touch but don't double-block. Same
// inclusive convention paper.nu's own timesOverlap uses for sections.
export function sectionConflictsWithZones(
  section: ComboSection,
  zones: readonly ProhibitedZone[]
): boolean {
  if (zones.length === 0) return false;
  for (const block of section.blocks) {
    const blockStart = block.start.h * 60 + block.start.m;
    const blockEnd = block.end.h * 60 + block.end.m;
    for (const zone of zones) {
      if (zone.day !== block.day) continue;
      if (blockStart <= zone.endMin && zone.startMin <= blockEnd) return true;
    }
  }
  return false;
}

// Round to the nearest 15-minute increment so zones snap visually and
// the conflict math is forgiving (a 9:43 click rounds to 9:45 and won't
// surprise the user with weird minute offsets).
export function snapMinutes(minutes: number, snap = 15): number {
  if (minutes < 0) return 0;
  return Math.round(minutes / snap) * snap;
}

export function makeZoneId(): string {
  return `zone-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
