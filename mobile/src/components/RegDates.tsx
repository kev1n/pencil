import { useEffect, useState } from "react";
import { formatAppointmentTime, googleCalendarUrl, loadRegistration, useRegistration } from "../data/registration";
import { useSessionState } from "../platform/session-state";
import { describeError } from "../platform/sign-in";
import { Icon, Sep, Spin, timeAgo } from "./bits";

const STALE = 12 * 60 * 60 * 1000;

// When registration opens for the term: the student's own appointment
// first, the general windows behind "All dates".
export function RegDates({ termName }: { termName: string }) {
  const saved = useRegistration(termName);
  const session = useSessionState();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = session.caesar === "in" && !session.unreachable;

  // Checked on its own when signed in and the saved copy is old.
  useEffect(() => {
    if (live && termName && (!saved || Date.now() - saved.at > STALE)) void loadRegistration(termName, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, termName]);

  if (!saved) return null;
  const dates = saved.dates;

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await loadRegistration(termName);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  return (
    <div className="reg">
      {dates?.appointments.map((appointment) => {
        const isOpen = appointment.startsAt <= now && (appointment.endsAt === null || now < appointment.endsAt);
        const closed = appointment.endsAt !== null && appointment.endsAt <= now;
        return (
          <div key={appointment.label + appointment.startsAt} className="reg-line">
            <Icon name="schedule" />
            <span>
              <b>{appointment.label}</b> {isOpen ? "is open now" : closed ? "closed" : "opens"}{" "}
              {!isOpen && formatAppointmentTime(closed ? appointment.endsAt! : appointment.startsAt)}
              {isOpen && appointment.endsAt !== null && <>, until {formatAppointmentTime(appointment.endsAt)}</>}
            </span>
            {!closed && !isOpen && (
              <a className="link quiet" href={googleCalendarUrl(appointment)} target="_blank" rel="noopener noreferrer">
                Add to calendar
              </a>
            )}
          </div>
        );
      })}
      <p className="note-text">
        {!dates
          ? `No registration dates posted for ${termName} yet`
          : dates.appointments.length === 0
            ? "No registration appointment assigned yet"
            : `Checked ${timeAgo(saved.at)}`}
        {dates && dates.windows.length > 0 && (
          <>
            <Sep />
            <button className="link quiet" onClick={() => setOpen((v) => !v)}>{open ? "Hide dates" : "All dates"}</button>
          </>
        )}
        {live && (
          <>
            <Sep />
            {busy ? <Spin /> : <button className="link quiet" onClick={() => void refresh()}>Refresh</button>}
          </>
        )}
      </p>
      {error && <p className="note-text is-error">{error}</p>}
      {open && dates && (
        <ul className="reg-all">
          {dates.windows.map((line) => <li key={line}>{line}</li>)}
        </ul>
      )}
    </div>
  );
}
