import { SeasonIcon, termShort } from "./bits";
import { selectedTerm, selectTerm, type Terms } from "../data/catalog";
import { useStore } from "../data/store";

// The sheet's term switch: season icon and name, the chosen one ink-filled.
export function TermPills({ terms, count = 5 }: { terms: Terms | null; count?: number }) {
  const termId = useStore(selectedTerm);
  if (!terms) return <div className="pills" style={{ height: 30 }} />;
  return (
    <div className="pills">
      {terms.terms.slice(0, count).map((term) => (
        <button key={term.id} className={`pill${term.id === termId ? " is-on" : ""}`} onClick={() => selectTerm(term.id)}>
          <SeasonIcon term={term.name} />
          {termShort(term.name)}
        </button>
      ))}
    </div>
  );
}
