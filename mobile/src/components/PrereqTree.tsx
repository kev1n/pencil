import { IonContent, IonModal } from "@ionic/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useWide } from "../platform/wide";
import { useCourseHistory } from "../data/caesar";
import { loadPrereqs, type Prereqs } from "../data/prereqs";
import { courseCode, Icon, Section, Sep, tidyCourseText } from "./bits";

const STATE_TEXT: Record<Prereqs["state"], string> = {
  ready: "You’ve met these",
  "needs-consent": "Needs permission",
  "in-progress": "In progress this term",
  blocked: "Not met yet",
  unknown: "Can’t be checked automatically",
  "no-data": ""
};

// The extension's prerequisite tree: this course on the left, what it needs
// to the right, coloured by what the student has already taken.
// `title`, `meta` and `about` describe the course at the top of the dialog
// the full chain opens in.
export function PrereqTree({ subject, catalog, raw, title, meta, about, facts }: {
  subject: string;
  catalog: string;
  raw?: string;
  title?: string;
  meta?: string;
  about?: string;
  // Its sections, one line each: who, when, rating, seats.
  facts?: ReactNode;
}) {
  const history = useCourseHistory();
  const [prereqs, setPrereqs] = useState<Prereqs | null>(null);
  const host = useRef<HTMLDivElement>(null);
  // The full chain can be several screens wide, so it opens on request: in
  // place on a phone, in a dialog as wide as it needs in a wide window.
  const [deep, setDeep] = useState(false);
  const wide = useWide();
  // Set once the dialog is on screen and has a size to centre the tree in.
  const [presented, setPresented] = useState(false);

  useEffect(() => {
    let current = true;
    loadPrereqs(subject, catalog).then((loaded) => current && setPrereqs(loaded), () => undefined);
    return () => {
      current = false;
    };
  }, [subject, catalog, history]);

  useEffect(() => {
    const shown = (!wide && deep && prereqs?.fullTree) || prereqs?.tree;
    if (shown) host.current?.replaceChildren(shown);
  }, [prereqs, deep, wide]);

  // The wording the tree was drawn from, when there is a tree.
  raw = (prereqs?.raw ?? raw)?.replace(/^Enrollment Requirements:\s*/i, "");
  if (!raw && !prereqs?.tree) return null;
  const known = Boolean(history?.refreshedAt);
  return (
    <Section title="Prerequisites" ctx={prereqs?.tree && known ? STATE_TEXT[prereqs.state] : undefined}>
      {prereqs?.tree && <div className="tree-host" ref={host} />}
      {prereqs?.fullTree && (
        <button className="link quiet" style={{ marginTop: 6 }} onClick={() => setDeep((v) => !v)}>
          {deep && !wide ? "Show only this course’s requirements" : "Show what those courses need too"}
        </button>
      )}
      {wide && prereqs?.fullTree && (
        <IonModal
          className="tree-modal"
          isOpen={deep}
          onDidPresent={() => setPresented(true)}
          onDidDismiss={() => {
            setPresented(false);
            setDeep(false);
          }}
        >
          <IonContent scrollY={false}>
            <div className="tree-modal-body">
              <div className="tree-modal-top">
                <div>
                  <b>{courseCode(subject, catalog)}{title && <><Sep />{title}</>}</b>
                  {meta && <span>{meta}</span>}
                  {about && <p>{about}</p>}
                  {facts}
                </div>
                <button aria-label="Close" onClick={() => setDeep(false)}><Icon name="close" /></button>
              </div>
              {presented && <TreeCanvas tree={prereqs.fullTree} />}
            </div>
          </IonContent>
        </IonModal>
      )}
      {raw && <p className="note-text" style={{ marginTop: prereqs?.tree ? 8 : 0 }}>{tidyCourseText(raw)}</p>}
      {prereqs?.tree && !known && (
        <p className="note-text" style={{ marginTop: 6 }}>Sign in to check these against the classes you’ve taken.</p>
      )}
      {prereqs?.notes.map((note) => <p key={note} className="note-text">{note}</p>)}
    </Section>
  );
}

// A surface the tree sits on and can be dragged around: drag or scroll to
// move, pinch (or ctrl-scroll) to zoom about the pointer, double-click to
// fit it back in view. There are no edges to hit.
function TreeCanvas({ tree }: { tree: HTMLElement }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const o = outer.current!;
    const i = inner.current!;
    i.replaceChildren(tree);
    const view = { x: 0, y: 0, k: 1 };
    const apply = () => {
      i.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
    };
    const fit = () => {
      view.k = Math.max(0.3, Math.min(1, (o.clientWidth - 48) / i.offsetWidth, (o.clientHeight - 48) / i.offsetHeight));
      view.x = (o.clientWidth - i.offsetWidth * view.k) / 2;
      view.y = (o.clientHeight - i.offsetHeight * view.k) / 2;
      apply();
    };
    fit();
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (event.ctrlKey) {
        const box = o.getBoundingClientRect();
        const cx = event.clientX - box.left;
        const cy = event.clientY - box.top;
        const k = Math.max(0.25, Math.min(3, view.k * Math.exp(-event.deltaY * 0.01)));
        view.x = cx - ((cx - view.x) * k) / view.k;
        view.y = cy - ((cy - view.y) * k) / view.k;
        view.k = k;
      } else {
        view.x -= event.deltaX;
        view.y -= event.deltaY;
      }
      apply();
    };
    let last: { x: number; y: number } | null = null;
    const down = (event: PointerEvent) => {
      last = { x: event.clientX, y: event.clientY };
      o.setPointerCapture(event.pointerId);
      o.classList.add("is-dragging");
    };
    const move = (event: PointerEvent) => {
      if (!last) return;
      view.x += event.clientX - last.x;
      view.y += event.clientY - last.y;
      last = { x: event.clientX, y: event.clientY };
      apply();
    };
    const up = () => {
      last = null;
      o.classList.remove("is-dragging");
    };
    o.addEventListener("wheel", wheel, { passive: false });
    o.addEventListener("pointerdown", down);
    o.addEventListener("pointermove", move);
    o.addEventListener("pointerup", up);
    o.addEventListener("pointercancel", up);
    o.addEventListener("dblclick", fit);
    return () => {
      o.removeEventListener("wheel", wheel);
      o.removeEventListener("pointerdown", down);
      o.removeEventListener("pointermove", move);
      o.removeEventListener("pointerup", up);
      o.removeEventListener("pointercancel", up);
      o.removeEventListener("dblclick", fit);
    };
  }, [tree]);
  return (
    <div className="tree-canvas" ref={outer}>
      <div className="tree-canvas-in" ref={inner} />
    </div>
  );
}
