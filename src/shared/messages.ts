export type LookupClassMessage = {
  type: "lookup-class";
  classNumber: string;
  careerHint?: "UGRD" | "TGS";
};

export type FetchTextMessage = {
  type: "fetch-text";
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  requestId?: string;
};

export type FetchBinaryMessage = {
  type: "fetch-binary";
  url: string;
  requestId?: string;
};

export type FetchBinarySuccess = {
  ok: true;
  status: number;
  // Base64-encoded body. chrome.runtime.sendMessage serializes via JSON
  // in some Chrome versions, which mangles ArrayBuffer bytes — base64
  // sidesteps that.
  base64: string;
  contentType: string;
  finalUrl: string;
};

export type FetchBinaryFailure = {
  ok: false;
  error: string;
  status?: number;
};

export type FetchBinaryResponse = FetchBinarySuccess | FetchBinaryFailure;

export type AbortFetchMessage = {
  type: "abort-fetch";
  requestId: string;
};

export type FetchTextSuccess = {
  ok: true;
  status: number;
  text: string;
  finalUrl: string;
};

export type FetchTextFailure = {
  ok: false;
  error: string;
  status?: number;
};

export type FetchTextResponse = FetchTextSuccess | FetchTextFailure;

export type LookupClassSuccess = {
  ok: true;
  requestedClassNumber: string;
  criteriaClassNumber: string | null;
  firstResultClassNumber: string | null;
  firstResultCourseTitle: string | null;
  firstResultSection: string | null;
  firstResultInstructor: string | null;
  firstResultDaysTimes: string | null;
  firstResultRoom: string | null;
  firstResultMeetingDates: string | null;
  firstResultGrading: string | null;
  firstResultStatus: string | null;
  nextActionForDetails: string | null;
  searchPageId: string | null;
  detailPageId: string | null;
  detailResponseText: string | null;
};

export type LookupClassFailure = {
  ok: false;
  error: string;
};

export type LookupClassResponse = LookupClassSuccess | LookupClassFailure;

export type OpenAuthPopupMessage = {
  type: "open-auth-popup";
  loginUrl: string;
};

export type OpenAuthPopupResponse =
  | { ok: true; tabId: number }
  | { ok: false; error: string };

export type AuthPopupClosedMessage = {
  type: "auth-popup-closed";
  reason: "succeeded" | "user-closed";
};
