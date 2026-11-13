import { useIonToast } from "@ionic/react";
import { useState, type ReactNode } from "react";
import { enroll, type EnrollResult } from "../data/enroll";
import { describeError } from "../platform/sign-in";
import { Spin } from "./bits";

type Step =
  | { at: "idle" }
  | { at: "picking"; picked: Set<string> }
  | { at: "busy" }
  | { at: "done"; results: EnrollResult[] }
  | { at: "stopped"; message: string };

// Registering from the cart list. A class's own Register button turns the
// list into a pick-several list with that class ticked; the bar under the
// list then registers the ticked classes and shows CAESAR's answer for each.
export function useRegister(termId: string | null, all: string[]): {
  // While picking: which classes are ticked. Otherwise null.
  picked: Set<string> | null;
  toggle: (classNumber: string) => void;
  // A cart row's own Register button; nothing while picking.
  button: (classNumber: string) => ReactNode;
  bar: ReactNode;
} {
  const [step, setStep] = useState<Step>({ at: "idle" });
  const idle = () => setStep({ at: "idle" });
  const start = (classNumbers: string[]) => setStep({ at: "picking", picked: new Set(classNumbers) });
  const toggle = (classNumber: string) =>
    setStep((current) => {
      if (current.at !== "picking") return current;
      const picked = new Set(current.picked);
      if (!picked.delete(classNumber)) picked.add(classNumber);
      return { at: "picking", picked };
    });

  async function go(classNumbers: string[]): Promise<void> {
    setStep({ at: "busy" });
    try {
      const answer = await enroll(termId!, classNumbers);
      setStep(answer.kind === "done" ? { at: "done", results: answer.results } : { at: "stopped", message: answer.message });
    } catch (error) {
      // The request may have gone through: say so instead of guessing.
      setStep({ at: "stopped", message: `${describeError(error)} Refresh to see whether CAESAR enrolled you before trying again.` });
    }
  }

  const button = (classNumber: string) =>
    step.at === "idle" ? (
      <span className="row-register">
        <button
          className="bc-btn bc-btn--primary"
          onClick={(event) => {
            event.stopPropagation();
            start([classNumber]);
          }}
        >
          Register
        </button>
      </span>
    ) : null;

  const count = step.at === "picking" ? step.picked.size : 0;
  const bar =
    all.length === 0 || step.at === "idle" ? null : step.at === "picking" ? (
      <div className="register">
        <button className="bc-btn bc-btn--primary" disabled={count === 0} onClick={() => void go(all.filter((n) => step.picked.has(n)))}>
          {count === 0 ? "Pick classes to register" : `Register for ${count} ${count === 1 ? "class" : "classes"}`}
        </button>
        <button className="bc-btn bc-btn--secondary" onClick={idle}>Cancel</button>
        <span className="note-text">This enrolls you in CAESAR.</span>
      </div>
    ) : (
      <div className="register-panel">
        {step.at === "busy" && <p className="note-text"><Spin /> Enrolling with CAESAR</p>}
        {step.at === "done" && (
          <>
            <div className="rows">
              {step.results.map((result) => (
                <div key={result.label + result.message} className="row">
                  <span className="row-body">
                    <span className="row-code">{result.label.replace(/_/g, " ")}</span>
                    <span className={`mark ${result.ok ? "open" : "closed"}`}>{result.ok ? "Enrolled" : "Not enrolled"}</span>
                    <span className="row-about">{result.message}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="actions"><button className="bc-btn bc-btn--secondary" onClick={idle}>Done</button></div>
          </>
        )}
        {step.at === "stopped" && (
          <>
            <p className="note-text is-error">{step.message}</p>
            <div className="actions"><button className="bc-btn bc-btn--secondary" onClick={idle}>Close</button></div>
          </>
        )}
      </div>
    );

  return { picked: step.at === "picking" ? step.picked : null, toggle, button, bar };
}

// Registering for one class that is in the cart, from wherever that class is
// shown: the first press asks, the second enrolls, and CAESAR's answer comes
// up as a message. `link` draws it small, for a line of links.
export function RegisterOne({ termId, classNumber, link }: { termId: string; classNumber: string; link?: boolean }) {
  const [at, setAt] = useState<"idle" | "armed" | "busy">("idle");
  const [toast] = useIonToast();
  const say = (message: string) => void toast({ message, duration: 6000, position: "top" });

  async function go(): Promise<void> {
    setAt("busy");
    try {
      const answer = await enroll(termId, [classNumber]);
      if (answer.kind === "refused") return say(answer.message);
      const mine = answer.results.find((result) => result.label.includes(`(${classNumber})`)) ?? answer.results[0]!;
      say(`${mine.ok ? "Enrolled" : "Not enrolled"}: ${mine.message}`);
    } catch (error) {
      say(`${describeError(error)} Refresh to see whether CAESAR enrolled you before trying again.`);
    } finally {
      setAt("idle");
    }
  }

  if (at === "busy") return link ? <Spin /> : <button className="bc-btn bc-btn--primary" disabled><Spin /></button>;
  if (at === "armed") {
    return link ? (
      <>
        <span className="row-register">
          <button className="bc-btn bc-btn--primary" onClick={() => void go()}>Confirm: enroll me</button>
          <button className="link quiet" onClick={() => setAt("idle")}>Cancel</button>
        </span>
      </>
    ) : (
      <button className="bc-btn bc-btn--primary" onClick={() => void go()} onBlur={() => setAt("idle")}>Confirm: enroll me</button>
    );
  }
  return link ? (
    <span className="row-register"><button className="bc-btn bc-btn--primary" onClick={() => setAt("armed")}>Register</button></span>
  ) : (
    <button className="bc-btn bc-btn--primary" onClick={() => setAt("armed")}>Register</button>
  );
}
