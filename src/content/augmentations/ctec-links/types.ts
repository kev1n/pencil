export type CtecLinkParams = {
  classNumber: string;
  subject: string;
  catalogNumber: string;
  instructor: string;
};

export type CtecLinkEntry = {
  term: string;
  url: string;
  instructor: string;
  description: string;
};

export type CtecLinkData =
  | { state: "found"; entries: CtecLinkEntry[]; totalCount: number; incomplete: boolean; hasMore: boolean }
  | { state: "auth-required"; loginUrl: string }
  | { state: "not-found" }
  | { state: "error"; message: string };

export type CtecLinkTarget = {
  row: HTMLTableRowElement;
  params: CtecLinkParams;
  container: HTMLElement;
};
