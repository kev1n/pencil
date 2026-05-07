export const PAPER_COMBOS_CONFIG = {
  selectors: {
    scheduleGrid: ".schedule-grid-cols",
    scheduleCard: ".schedule-grid-cols div.absolute.z-10.rounded-lg",
    hoursColumnFirstCellLabel:
      ".schedule-grid-cols > :first-child > div:first-child p"
  },
  storage: {
    paperDbName: "paper",
    paperStoreName: "keyvaluepairs",
    scheduleKey: "data_schedule"
  }
} as const;
