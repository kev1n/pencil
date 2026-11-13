// CTEC ratings, fetched and combined by the extension's own code.
import {
  buildCtecSectionIdentity,
  type CtecSectionIdentity
} from "@ext/content/augmentations/class-search/ctec/identity";
import {
  CTEC_SITE_ERROR_MESSAGE,
  fetchCtecReportAggregate,
  getCachedChipAggregate,
  type CtecFetchAttempt,
  type CtecReportAggregate
} from "@ext/content/augmentations/ctec-links/reports";
import { readSubjectIndex, writeSubjectIndex } from "@ext/content/ctec-index/storage";
import { backInLine, wasBumped } from "./caesar";
import { NUSession } from "../platform/native";
import { SignInCancelledError, withSignIn } from "../platform/sign-in";
import type { PaperSection, PaperTermCourse } from "./catalog";
import { createStore, useStore } from "./store";

export type { CtecReportAggregate, CtecSectionIdentity };

// How many of the most recent terms a rating averages.
const RECENT_TERMS = 3;

export type CtecState =
  | { status: "idle" }
  | { status: "loading"; message: string }
  | { status: "ready"; aggregate: CtecReportAggregate }
  | { status: "none" }
  | { status: "no-access" }
  | { status: "error"; error: unknown };

const states = createStore<Record<string, CtecState>>({});

function set(key: string, state: CtecState): void {
  states.update((current) => ({ ...current, [key]: state }));
}

export function ctecIdentity(course: PaperTermCourse, section: PaperSection): CtecSectionIdentity | null {
  return buildCtecSectionIdentity(course, section);
}

export function useCtec(identity: CtecSectionIdentity | null): CtecState {
  const all = useStore(states);
  if (!identity) return { status: "none" };
  const known = all[identity.key];
  if (known) return known;
  const cached = getCachedChipAggregate(identity.params, identity.titleHint, RECENT_TERMS);
  return cached ? { status: "ready", aggregate: cached } : { status: "idle" };
}

// `quiet` is a load nobody tapped for: it never opens a sign-in page, and
// goes back to the "Load" link when one would be needed.
export async function loadCtec(identity: CtecSectionIdentity, quiet = false): Promise<void> {
  if (states.get()[identity.key]?.status === "loading") return;
  set(identity.key, { status: "loading", message: "Connecting to Northwestern CTECs…" });
  const attempt: CtecFetchAttempt = { linksFound: false };
  const signedIn = quiet ? <T,>(run: () => Promise<T>) => run() : withSignIn;
  // Pushed aside by something the student tapped: go back in line.
  const fetch = () =>
    backInLine(
      () =>
        signedIn(() =>
          fetchCtecReportAggregate(
            identity.params,
            identity.titleHint,
            (message) => set(identity.key, { status: "loading", message }),
            { fetchLimit: RECENT_TERMS, aggregateLimit: RECENT_TERMS, attempt }
          )
        ),
      (result) => result.state === "error" && wasBumped(new Error(result.message))
    );
  // The CTEC site answers a worn-out session with its own error page.
  // Blanks saved by earlier versions look the same: listed, none readable.
  // Each sign-in hand-off that is started and not finished leaves a cookie
  // behind on that site. Enough of them and it refuses every request as
  // too long (a 400), until its cookies are dropped.
  const overfull = (result: Awaited<ReturnType<typeof fetch>>) =>
    result.state === "error" && result.message === "Request failed (400).";
  const unread = (result: Awaited<ReturnType<typeof fetch>>) =>
    overfull(result) ||
    (result.state === "error" && result.message === CTEC_SITE_ERROR_MESSAGE) ||
    (result.state === "found" && result.aggregate.aggregateParsedCount === 0);
  try {
    let result = await fetch();
    if (unread(result) && quiet) {
      if (overfull(result)) await NUSession.forgetSite({ host: "bluera.com" }).catch(() => undefined);
      forgetBlankReports(identity.params.subject);
      set(identity.key, { status: "idle" });
      return;
    }
    if (unread(result)) {
      // Start a new session with that site and read the reports once more.
      forgetBlankReports(identity.params.subject);
      await NUSession.forgetSite({ host: "bluera.com" }).catch(() => undefined);
      result = await fetch();
      if (unread(result)) forgetBlankReports(identity.params.subject);
    }
    if (unread(result)) set(identity.key, { status: "error", error: new Error(CTEC_SITE_ERROR_MESSAGE) });
    else if (result.state === "found") set(identity.key, { status: "ready", aggregate: result.aggregate });
    else if (result.state === "no-access") set(identity.key, { status: "no-access" });
    else if (result.state === "not-found") set(identity.key, { status: "none" });
    else set(identity.key, { status: "error", error: new Error(result.message) });
  } catch (error) {
    const needsSignIn = typeof (error as { loginUrl?: unknown } | null)?.loginUrl === "string";
    // A report request that ends at the sign-in page leaves two cookies on
    // the CTEC site for a hand-off nobody finished (`Saml2.*`, `TabState.*`).
    // They are never cleaned up there, and this app keeps cookies between
    // launches, so they would pile up until the site refuses every request.
    // Signed out of that site, its cookies hold nothing worth keeping.
    if (needsSignIn || error instanceof SignInCancelledError) {
      await NUSession.forgetSite({ host: "bluera.com" }).catch(() => undefined);
    }
    set(identity.key, quiet && needsSignIn ? { status: "idle" } : { status: "error", error });
  }
}

function forgetBlankReports(subject: string): void {
  const index = readSubjectIndex(subject);
  if (!index) return;
  writeSubjectIndex(subject, {
    ...index,
    entries: index.entries.map((entry) => {
      if (entry.reportSummary !== null) return entry;
      const { reportSummary: _blank, ...rest } = entry;
      return rest;
    })
  });
}

// A saved rating for one section, if its CTECs were loaded before. No network.
export function savedCtec(course: PaperTermCourse, section: PaperSection): CtecReportAggregate | null {
  const identity = buildCtecSectionIdentity(course, section);
  if (!identity) return null;
  const known = states.get()[identity.key];
  if (known?.status === "ready") return known.aggregate;
  return getCachedChipAggregate(identity.params, identity.titleHint, RECENT_TERMS);
}

// Subscribes a screen to CTEC loads, so saved ratings appear as they arrive.
export function useCtecChanges(): unknown {
  return useStore(states);
}

// The one number the app shows for a class: the average of its instruction,
// course and "learned" ratings, as the CTEC sheet's overall rating does.
export function overallRating(aggregate: CtecReportAggregate | null | undefined): number | undefined {
  const m = aggregate?.metrics;
  const parts = [m?.instruction?.mean, m?.course?.mean, m?.learned?.mean].filter(
    (value): value is number => typeof value === "number"
  );
  return parts.length ? parts.reduce((sum, value) => sum + value, 0) / parts.length : undefined;
}

// Whether a load was tried for this class and stopped short of a rating
// (a fresh sign-in is needed, or the CTEC site could not open the reports).
export function ctecStalled(identity: CtecSectionIdentity): boolean {
  const status = states.get()[identity.key]?.status;
  return status === "idle" || status === "error";
}
