// What CAESAR itself says about the class the panel is showing, for the
// term being planned: units, grading basis (where P/N shows), seats,
// requirements and notes. Drawn two ways: the whole of it between the CTEC
// numbers and the comments (or as a CAESAR tab when a class has no CTECs), and the two things that decide a registration (seats left,
// grading) in the foot beside the Add to cart / Register button.
import { html, type TemplateResult } from "lit-html";

import type { SeatsNotesSuccess } from "../../seats-notes/types";
import { seatUrgency, tidyUnits } from "../../seats-notes/urgency";

export type CaesarInfo = { loading: boolean; error?: string; details?: SeatsNotesSuccess; fetchedAt?: number };

// The foot's button: add this class to the cart, or register once it is
// there. `note` says what state that is in when it matters.
export type CartAction = { note: string | null; label: string | null; busy: boolean; onClick: () => void };

function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

function seatMeter(details: SeatsNotesSuccess): TemplateResult | string {
  const seats = seatUrgency(details);
  if (!seats) return "";
  return html`<div class="bc-seat" data-tone=${seats.tone}>
    <span class="bc-seat-bar"><i style=${`width:${Math.round(seats.filled * 100)}%`}></i></span>
    <b>${seats.headline}</b>
  </div>`;
}

export function renderFoot(action: CartAction | null | undefined, info: CaesarInfo | null | undefined): TemplateResult | string {
  if (!action && !info?.details) return "";
  const details = info?.details;
  const line = [action?.note, details?.facts?.grading, tidyUnits(details?.facts?.units)].filter(Boolean).join(" · ");
  return html`<footer class="bc-sheet-foot">
    <div class="bc-sheet-foot-info">
      ${details ? seatMeter(details) : ""}
      ${line ? html`<small>${line}</small>` : info?.loading ? html`<small>Checking CAESAR…</small>` : ""}
    </div>
    ${action?.label
      ? html`<button
          type="button"
          class="bc-sheet-register"
          data-bc-action-button="controller"
          ?disabled=${action.busy}
          @click=${action.onClick}
        >${action.label}</button>`
      : ""}
  </footer>`;
}

// Everything CAESAR states.
export function renderCaesarBody(info: CaesarInfo | null | undefined, onRefresh: () => void): TemplateResult {
  if (!info || info.loading) return html`<p class="bc-sheet-caesar-note">Loading this class from CAESAR…</p>`;
  if (!info.details) {
    return html`<p class="bc-sheet-caesar-note">${info.error ?? "CAESAR didn’t answer."}</p>
      <button type="button" class="bc-sheet-caesar-refresh" data-bc-action-button="controller" @click=${onRefresh}>Try again</button>`;
  }
  const d = info.details;
  const facts = d.facts ?? {};
  const seats = seatUrgency(d);
  const waitlist = d.waitListTotal !== null && d.waitListCapacity !== null ? `${d.waitListTotal} of ${d.waitListCapacity}` : null;
  const cells: Array<[string, string | null | undefined]> = [
    ["Grading", facts.grading],
    ["Units", tidyUnits(facts.units)],
    ["Enrolled", seats?.detail?.replace(/ enrolled$/, "")],
    ["Waitlist", waitlist],
    ["Components", facts.components],
    ["Session", facts.session],
    ["Campus", facts.campus],
    ["Level", facts.career],
    ["Class number", d.requestedClassNumber]
  ];
  const blocks: Array<[string, string | null]> = [
    ["Enrollment requirements", d.enrollmentRequirements],
    ["Class attributes", d.classAttributes],
    ["Class notes", d.classNotes]
  ];
  return html`<section class="bc-sheet-caesar">
      ${seatMeter(d)}
      ${d.isCombinedSection ? html`<p class="bc-sheet-caesar-note">Seats are shared with a cross-listed section.</p>` : ""}
      <p class="bc-sheet-caesar-note">
        Checked ${info.fetchedAt ? ago(info.fetchedAt) : "earlier"}
        <button type="button" class="bc-sheet-caesar-refresh" data-bc-action-button="controller" @click=${onRefresh}>Refresh</button>
      </p>
    </section>
    <section class="bc-sheet-caesar">
      <dl class="bc-sheet-caesar-grid">
        ${cells.filter(([, value]) => value).map(([label, value]) => html`<div><dt>${label}</dt><dd>${value}</dd></div>`)}
      </dl>
    </section>
    ${blocks
      .filter(([, value]) => value)
      .map(([label, value]) => html`<section class="bc-sheet-caesar"><h3 class="bc-sheet-caesar-title">${label}</h3><p class="bc-sheet-caesar-block">${value}</p></section>`)}`;
}
