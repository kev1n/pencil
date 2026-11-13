// A window wide enough for side-by-side layout: the Mac app, a tablet, a
// phone on its side. theme.css switches on the same width.
import { useEffect, useState } from "react";

const query = window.matchMedia("(min-width: 900px)");

export function useWide(): boolean {
  const [wide, setWide] = useState(query.matches);
  useEffect(() => {
    const sync = () => setWide(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return wide;
}
