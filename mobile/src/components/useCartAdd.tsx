import { IonActionSheet, useIonToast } from "@ionic/react";
import { useState, type ReactNode } from "react";
import { addToCart, resolveLiveSection, type AddToCartOutcome, type RelatedSectionOption } from "../data/caesar";
import type { PaperSection } from "../data/catalog";
import { describeError } from "../platform/sign-in";
import { courseCode } from "./bits";

const NOT_LISTED = "CAESAR doesn’t list this section for the term.";

// Adding a section to the CAESAR cart, wherever the button sits: the add
// itself, the "pick a discussion to go with it" step, and the result message.
// Render `picker` once on the screen that uses it.
export function useCartAdd(course: { termId: string; subject: string; catalog: string }): {
  busy: string | null;
  add: (section: PaperSection, classNumber: string | null) => Promise<void>;
  picker: ReactNode;
} {
  const { termId, subject, catalog } = course;
  const [toast] = useIonToast();
  // The section being added, by id.
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Extract<AddToCartOutcome, { kind: "pick" }> | null>(null);

  const say = (message: string) => void toast({ message, duration: 3500, position: "top" });

  function settle(outcome: AddToCartOutcome): void {
    if (outcome.kind === "pick") setPending(outcome);
    else if (outcome.kind === "added") say(`Added ${courseCode(subject, catalog)} to your CAESAR cart.`);
    else if (outcome.kind === "already") say("That section is already in your CAESAR cart.");
    else say(outcome.error);
  }

  async function run(id: string, job: () => Promise<AddToCartOutcome>): Promise<void> {
    setBusy(id);
    try {
      settle(await job());
    } catch (error) {
      say(describeError(error));
    } finally {
      setBusy(null);
    }
  }

  const add = (section: PaperSection, classNumber: string | null) =>
    run(section.section_id, async () => {
      const number = classNumber ?? (await resolveLiveSection(termId, subject, catalog, section))?.classNumber;
      if (!number) throw new Error(NOT_LISTED);
      return addToCart({ termId, subject, catalog, section, classNumber: number });
    });

  const pick = (option: RelatedSectionOption) => {
    const resume = pending?.resume;
    if (resume) void run("related", () => resume(option.rowIndex));
  };

  const picker = (
    <IonActionSheet
      isOpen={pending !== null}
      header="Pick a section to go with it"
      onDidDismiss={() => setPending(null)}
      buttons={[
        ...(pending?.options ?? []).map((option) => ({
          text: `${option.section} · ${option.schedule} · ${option.status}`,
          handler: () => pick(option)
        })),
        { text: "Cancel", role: "cancel" }
      ]}
    />
  );

  return { busy, add, picker };
}
