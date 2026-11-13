import { useEffect, useState } from "react";
import { loadCtec, useCtec, type CtecSectionIdentity } from "../data/ctec";
import { describeError } from "../platform/sign-in";
import { Spin } from "./bits";

// Shown when ratings stopped loading because the CTEC site wants a fresh
// sign-in. The button signs in and loads `identity`'s ratings; the prompt
// says how that is going, and what went wrong when it does not work.
export function RatingsPrompt({ identity, onDone }: { identity: CtecSectionIdentity; onDone: () => void }) {
  const state = useCtec(identity);
  const [asked, setAsked] = useState(false);
  const settled = asked && state.status !== "loading" && state.status !== "idle";
  const failed = settled && (state.status === "error" || state.status === "no-access");
  useEffect(() => {
    if (settled && !failed) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled, failed]);
  const loading = asked && state.status === "loading";
  return (
    <div className="ratings-ask">
      <div>
        <b>{failed ? "Ratings still didn’t load" : "Professor ratings aren’t showing"}</b>
        <span>
          {loading
            ? state.message
            : state.status === "no-access"
              ? "Northwestern says this account can’t see CTECs yet. They open once you’ve filled in your own evaluations."
              : failed && state.status === "error"
                ? describeError(state.error)
                : "Northwestern’s CTEC site needs you to sign in again. It takes a moment, and ratings then load for your classes."}
        </span>
      </div>
      <button
        className="bc-btn bc-btn--primary bc-btn--compact"
        disabled={loading}
        onClick={() => {
          setAsked(true);
          void loadCtec(identity);
        }}
      >
        {loading ? <Spin /> : failed ? "Try again" : "Sign in to load ratings"}
      </button>
    </div>
  );
}
