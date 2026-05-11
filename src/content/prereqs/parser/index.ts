// PUBLIC ENTRY POINT for the prereqs parser. Locked signature; the
// implementation lives across the sibling files (regex, normalize,
// splitters, modifiers, atoms, composers, parser). External callers
// import from here, never from the sub-files.

import type { ParsePrereq } from "../types";
import { parseRoot } from "./parser";

export const parsePrereq: ParsePrereq = (text, parentSubject) => {
  return parseRoot(text, parentSubject);
};
