import type { CtecCourseAnalytics, CtecReportAggregate } from "../ctec-links/reports";
import type { CtecLinkParams } from "../ctec-links/types";

export type PaperCtecTarget = {
  card: HTMLElement;
  widget: HTMLElement;
  params: CtecLinkParams;
  titleHint: string;
  key: string;
};

export type PaperCtecWidgetData =
  | { state: "found"; aggregate: CtecReportAggregate }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type PaperCtecStatusBarData = {
  state: "loading" | "auth-required" | "ready";
  totalCount: number;
  resolvedCount: number;
  activeCount: number;
  foundCount: number;
  notFoundCount: number;
  errorCount: number;
  authCount: number;
  latestMessage?: string;
  loginUrl?: string;
  awaitingAuthRetry?: boolean;
};

export type PaperCtecAnalyticsState =
  | { state: "found"; analytics: CtecCourseAnalytics }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type PaperCtecSideCardContext = {
  panel: HTMLElement;
  key: string;
  params: CtecLinkParams;
  titleHint: string;
};

// Identity needed to fetch CTEC data and open the analytics modal. Both the
// side panel and the schedule-card analytics button satisfy this — the side
// card has a panel ref it doesn't need to share, and a schedule card just
// has the params.
export type AnalyticsModalSource = {
  key: string;
  params: CtecLinkParams;
  titleHint: string;
};
