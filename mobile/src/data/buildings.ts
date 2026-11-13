// Where Northwestern's Evanston classroom buildings are, for the walking
// trail on Schedule. A room name from the catalog ("Tech Institute Lecture
// Room 2") is matched to a building by how it starts, or by a phrase it
// contains. Coordinates come from Paper.nu's building table; the two marked
// "by address" were placed from the street address and are approximate.

export type Building = { name: string; lat: number; lon: number };

type Entry = Building & { starts?: string[]; has?: string[] };

const BUILDINGS: Entry[] = [
  { name: "Tech", lat: 42.057728, lon: -87.675869, starts: ["Technological Institute", "Tech Institute", "Tech "] },
  { name: "Ford", lat: 42.057021, lon: -87.676733, starts: ["Ford "] },
  { name: "Kellogg Global Hub", lat: 42.057432, lon: -87.671941, starts: ["Kellogg "] },
  { name: "Frances Searle", lat: 42.058635, lon: -87.673723, starts: ["Frances Searle"], has: ["Frances Srle"] },
  { name: "Pancoe", lat: 42.057129, lon: -87.673563, starts: ["Pancoe"] },
  { name: "Hogan", lat: 42.057356, lon: -87.674151, starts: ["Hogan"] },
  { name: "Cook Hall", lat: 42.0584, lon: -87.6745, starts: ["Cook Hall"] }, // by address
  { name: "The Garage", lat: 42.059339, lon: -87.673992, starts: ["Garage ", "North Garage"] },
  { name: "2315 Campus Dr", lat: 42.059221, lon: -87.674565, starts: ["2315 Campus Dr"] },
  { name: "Elder Hall", lat: 42.060905, lon: -87.677586, starts: ["Elder Hall"] },
  { name: "560 Lincoln", lat: 42.061374, lon: -87.675655, starts: ["560 Lincoln"] },
  { name: "620 Lincoln", lat: 42.061367, lon: -87.678179, starts: ["620 Lincoln"] },
  { name: "616 Noyes", lat: 42.058167, lon: -87.678163, has: ["616 Noyes"] },
  { name: "2122 Sheridan", lat: 42.056927, lon: -87.677873, starts: ["2122 Sheridan"] },
  { name: "Annenberg Hall", lat: 42.056058, lon: -87.674515, starts: ["Annenberg"] },
  { name: "Swift Hall", lat: 42.055138, lon: -87.674953, starts: ["Swift Hall"] },
  { name: "Cresap", lat: 42.054702, lon: -87.67496, starts: ["Cresap"] },
  { name: "Lunt Hall", lat: 42.054803, lon: -87.676345, starts: ["Lunt Hall"] },
  { name: "2006 Sheridan", lat: 42.054166, lon: -87.677641, has: ["2006 Sher"] },
  { name: "2001 Sheridan", lat: 42.0537, lon: -87.6772, starts: ["2001 Sheridan"] }, // by address
  { name: "Library", lat: 42.05282, lon: -87.674493, starts: ["University Library"] },
  { name: "Pick-Staiger", lat: 42.052713, lon: -87.672245, starts: ["Pick-Staiger"] },
  { name: "Block Museum", lat: 42.052326, lon: -87.6727, starts: ["Block "] },
  { name: "Annie May Swift", lat: 42.052311, lon: -87.675093, starts: ["Annie May Swift", "AM Swift", "Helmerich"] },
  { name: "Regenstein", lat: 42.052194, lon: -87.671434, starts: ["Regenstein"] },
  { name: "Wirtz Center", lat: 42.052122, lon: -87.673266, starts: ["Wirtz"] },
  { name: "University Hall", lat: 42.051901, lon: -87.67596, starts: ["University Hall"] },
  { name: "Ryan Center for the Musical Arts", lat: 42.051748, lon: -87.671488, starts: ["RCMA"] },
  { name: "Scott Hall", lat: 42.051747, lon: -87.677568, starts: ["Scott Hall"] },
  { name: "Kresge", lat: 42.051677, lon: -87.675097, starts: ["Kresge", "Crowe"] },
  { name: "Louis Hall", lat: 42.051513, lon: -87.673291, starts: ["Louis Hall"] },
  { name: "McCormick Foundation Center", lat: 42.051381, lon: -87.674162, starts: ["McCormick "] },
  { name: "Harris Hall", lat: 42.051269, lon: -87.676279, starts: ["Harris Hall"] },
  { name: "Locy Hall", lat: 42.051062, lon: -87.673933, starts: ["Locy Hall"] },
  { name: "Lutkin Hall", lat: 42.051018, lon: -87.680259, starts: ["Lutkin"] },
  { name: "Shepard Hall", lat: 42.050883, lon: -87.67893, starts: ["Shepard Hall"] },
  { name: "Fisk Hall", lat: 42.050793, lon: -87.674174, starts: ["Fisk Hall"] },
  { name: "Allison", lat: 42.050435, lon: -87.67821, starts: ["Allison"] },
  { name: "Parkes Hall", lat: 42.050071, lon: -87.677239, starts: ["Parkes Hall"] },
  { name: "1810 Hinman", lat: 42.049573, lon: -87.676887, has: ["1810 Hinmn"] },
  { name: "555 Clark", lat: 42.049555, lon: -87.677517, starts: ["555 Clark"] }
];

export const CAMPUS: Building[] = BUILDINGS;

// The building a room is in, or null when the room is off the Evanston
// campus, online, not set yet or not one this table knows.
export function buildingOf(room: string | null): Building | null {
  if (!room || room.includes("Chicago")) return null;
  return (
    BUILDINGS.find((b) => b.starts?.some((s) => room.startsWith(s))) ??
    BUILDINGS.find((b) => b.has?.some((s) => room.includes(s))) ??
    null
  );
}

// Metres between two buildings, in a straight line.
export function metresBetween(a: Building, b: Building): number {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lon - b.lon) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

// Minutes on foot: paths are longer than the straight line, at an easy pace.
export function walkMinutes(a: Building, b: Building): number {
  return Math.max(1, Math.round((metresBetween(a, b) * 1.3) / 80));
}
