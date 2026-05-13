export type CtecRowSeed = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
};

export type CtecCourseSeed = {
  actionId: string;
  description: string;
};

export type CtecIndexedEntry = {
  actionId: string;
  term: string;
  description: string;
  instructor: string;
  blueraUrl: string | null;
  error: string | null;
  searchText: string;
  reportSummary?: CtecReportSummary | null;
};

export type CtecReportScalarMetric = {
  mean: number;
  responseCount: number;
};

export type CtecReportHoursMetric = {
  mean: number;
  responseCount: number;
  // Per-bucket counts as parsed from the CTEC HTML table. Optional because
  // entries cached before this field was added still fall back to mean/count
  // only — the modal degrades to chart image when buckets are missing.
  buckets?: { label: string; count: number }[];
};

export type CtecReportChart = {
  question: string;
  imageUrl: string;
  alt: string | null;
  // Pixel-extracted bar counts (length 6, top→bottom). Captured at CTEC
  // load time so the modal can render the histogram synchronously without
  // re-fetching the PNG. Absent on entries cached before this field was
  // added or when extraction failed.
  counts?: number[];
};

export type CtecReportCommentGroup = {
  prompt: string;
  comments: string[];
};

export type CtecReportSummary = {
  url: string;
  parsedAt: number;
  metrics: {
    instruction?: CtecReportScalarMetric;
    course?: CtecReportScalarMetric;
    learned?: CtecReportScalarMetric;
    challenging?: CtecReportScalarMetric;
    stimulating?: CtecReportScalarMetric;
    hours?: CtecReportHoursMetric;
  };
  charts: CtecReportChart[];
  commentGroups: CtecReportCommentGroup[];
};

// Per-course discovery state, keyed by `${catalogNumber}|${normalizedInstructor}`
// (see buildCourseStateKey in ctec-links/fetcher.ts). pendingRowCount is the
// number of class rows the most recent PeopleSoft discovery saw that we
// haven't fetched yet. Lets the UI keep "Load N more (M left)" accurate
// across reloads without doing another discovery probe just to find out.
export type CtecCourseDiscoveryState = {
  pendingRowCount: number;
  updatedAt: number;
};

export type CtecSubjectIndex = {
  subjectCode: string;
  subjectLabel: string;
  builtAt: number;
  sourceUrl: string;
  entries: CtecIndexedEntry[];
  courseState?: Record<string, CtecCourseDiscoveryState>;
  // Per-section analytics-lens preference, keyed by
  // `${catalogNumber}|${normalizedInstructor}`. Overrides the global
  // `getCtecStrategy()` for this pair so reopening the modal lands on
  // the user's pick. Literal-typed to avoid a back-dependency on
  // ctec-links/types.
  sectionLens?: Record<string, "combo" | "course" | "instructor">;
  // Set only when the user EXPLICITLY confirmed a lens via the dry-run
  // wizard (Adjust selection → Load). Distinct from sectionLens, which
  // also flips on tab clicks. The schedule chip honors sectionLens
  // only when this flag is set — so tab-switching browses without
  // changing the chip rating, but wizard confirms do change it (and
  // persist across page reload).
  sectionLensConfirmed?: Record<string, true>;
  // Persisted wizard discovery rows so the dry-run dialog skips the
  // PeopleSoft scrape after reload. Presentation-only — `actionId` is
  // response-local and goes stale, but the actual report fetch re-
  // discovers fresh ones.
  courseDiscovery?: Record<string, CtecRowSeed[]>;
  instructorDiscovery?: Record<string, CtecRowSeed[]>;
};

export type CtecIndexStore = {
  version: 1;
  subjects: Record<string, CtecSubjectIndex>;
};
