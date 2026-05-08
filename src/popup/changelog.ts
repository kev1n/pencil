// Source-of-truth lives in ./changelog.json — edit that file to add releases.
// This module just re-exports the typed view for the popup renderer.

import data from "./changelog.json";

export type ChangelogKind = "feat" | "fix";

export interface ChangelogItem {
  kind: ChangelogKind;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  headline?: string;
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogEntry[] = data.entries as ChangelogEntry[];
