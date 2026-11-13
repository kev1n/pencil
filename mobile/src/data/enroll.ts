// Registering for classes from the app: the extension's own steps, with the
// app's sign-in and request budget around them.
import { enrollFromCart, type EnrollOutcome, type EnrollResult } from "@ext/content/enroll/flow";
import { needsSession, refreshCart, spendCredit } from "./caesar";

export type { EnrollOutcome, EnrollResult };

export async function enroll(termId: string, classNumbers: string[]): Promise<EnrollOutcome> {
  spendCredit("app-enroll");
  const outcome = await needsSession(() => enrollFromCart(termId, classNumbers, "app-enroll"));
  if (outcome.kind === "done") await refreshCart(termId).catch(() => undefined);
  return outcome;
}
