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
};

export type CtecIndexStore = {
  version: 1;
  subjects: Record<string, CtecSubjectIndex>;
};
