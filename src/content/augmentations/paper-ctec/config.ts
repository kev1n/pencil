export const PAPER_CTEC_CONFIG = {
  aggregate: {
    recentTerms: 3,
    ratingScaleMax: 6,
    hoursGraphMax: 20
  },
  selectors: {
    scheduleGrid: ".schedule-grid-cols",
    scheduleCard: ".schedule-grid-cols div.absolute.z-10.rounded-lg",
    actionHostExact: "div.absolute.right-7.top-4.flex.items-center.gap-1",
    actionHostFallback: "div.absolute.flex.items-center",
    sideCardPanel: "div.fixed.right-0.top-0.h-screen.w-screen div.rounded-xl.p-4.shadow-xl",
    sideCardHeader: "div.mb-6.flex.w-full.items-center.gap-2",
    sideCardItems: "div.my-4.rounded-lg.bg-gray-50.p-2.shadow-sm"
  },
  layout: {
    actionHostInsetRem: 1.75
  },
  ui: {
    summaryChipIconSizePx: 10,
    summaryChipStrokeWidth: 1.8,
    summaryChipStarSizePx: 8,
    summaryChipStarGapPx: 1,
    ratingChipTones: [
      { minScore: 0.95, hue: 116 },
      { minScore: 0.85, hue: 92 },
      { minScore: 0.72, hue: 58 },
      { minScore: 0.55, hue: 34 },
      { minScore: 0.35, hue: 18 },
      { minScore: 0, hue: 4 }
    ],
    hoursChipTones: [
      { minScore: 0.84, hue: 116 },
      { minScore: 0.72, hue: 92 },
      { minScore: 0.58, hue: 58 },
      { minScore: 0.42, hue: 34 },
      { minScore: 0.26, hue: 18 },
      { minScore: 0, hue: 4 }
    ],
    statusIconSizePx: 14,
    statusIconStrokeWidth: 1.9,
    statusBarMinHeightPx: 28,
    analyticsMetricMinWidthPx: 120,
    analyticsTermMetricMinWidthPx: 88,
    analyticsChartMinWidthPx: 170,
    analyticsStarSizePx: 14
  }
} as const;
