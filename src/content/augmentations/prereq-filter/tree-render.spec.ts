import { describe, expect, it } from "vitest";
import type { EligibilityHistoryEntry, PrereqNode, PrereqRecord } from "../../prereqs";
import { renderPrereqTree } from "./tree-render";

function emptyHistory(): ReadonlyMap<string, EligibilityHistoryEntry> {
  return new Map();
}

function takenWith(grade: string | null = null): EligibilityHistoryEntry {
  return { status: "Taken", grade };
}

const course = (subject: string, number: string, section = ""): PrereqNode => ({
  kind: "course",
  subject,
  number,
  section
});

function render(
  node: PrereqNode | null,
  history: ReadonlyMap<string, EligibilityHistoryEntry> = emptyHistory()
): HTMLElement {
  return renderPrereqTree(document, node, history).el;
}

function pills(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(".bc-prereq-tree__pill"));
}

function pillFor(root: HTMLElement, label: string): HTMLElement | undefined {
  return pills(root).find((p) => (p.textContent ?? "").includes(label));
}

function ops(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll(".bc-prereq-tree__op")).map((o) => o.textContent ?? "");
}

describe("renderPrereqTree", () => {
  it("renders a ready 'No prerequisites' pill for a null or none node", () => {
    for (const node of [null, { kind: "none" } as PrereqNode]) {
      const root = render(node);
      expect(root.className).toBe("bc-prereq-tree");
      const only = pills(root);
      expect(only).toHaveLength(1);
      expect(only[0].textContent).toMatch(/No prerequisites/);
      expect(only[0].className).toContain("--ok");
    }
  });

  it("colors a course by whether it has been taken", () => {
    const node = course("COMP_SCI", "211");
    expect(pillFor(render(node), "COMP_SCI 211")?.className).toContain("--lock");
    const history = new Map([["COMP_SCI 211", takenWith("A")]]);
    expect(pillFor(render(node, history), "COMP_SCI 211")?.className).toContain("--ok");
  });

  it("respects minGrade", () => {
    const node: PrereqNode = { ...course("MATH", "228", "1"), kind: "course", minGrade: "C-" } as PrereqNode;
    const pass = new Map([["MATH 228-1", takenWith("B")]]);
    const fail = new Map([["MATH 228-1", takenWith("D")]]);
    expect(pillFor(render(node, pass), "MATH 228-1 (≥ C-)")?.className).toContain("--ok");
    expect(pillFor(render(node, fail), "MATH 228-1 (≥ C-)")?.className).toContain("--lock");
  });

  it("paints in-progress courses warn and transferred courses ok", () => {
    const node = course("COMP_SCI", "211");
    const inProgress = new Map([["COMP_SCI 211", { status: "In Progress", grade: null }]]);
    const transferred = new Map([["COMP_SCI 211", { status: "Transferred", grade: null }]]);
    expect(pillFor(render(node, inProgress), "COMP_SCI 211")?.className).toContain("--warn");
    expect(pillFor(render(node, transferred), "COMP_SCI 211")?.className).toContain("--ok");
  });

  it("renders recommended courses as soft ok pills", () => {
    const node: PrereqNode = {
      kind: "course",
      subject: "COMP_SCI",
      number: "211",
      section: "",
      recommended: true
    };
    const pill = pillFor(render(node), "COMP_SCI 211 (rec.)");
    expect(pill?.className).toContain("--ok");
    expect(pill?.className).toContain("--soft");
  });

  it("labels an AND group 'all' with a solid bracket", () => {
    const root = render({ kind: "all", of: [course("COMP_SCI", "111"), course("COMP_SCI", "150")] });
    expect(ops(root)).toEqual(["all"]);
    expect(root.querySelector(".bc-prereq-tree__kids")?.className).not.toContain("--any");
    expect(pills(root)).toHaveLength(2);
  });

  it("labels an OR group 'one of' with a dashed bracket", () => {
    const history = new Map([["COMP_SCI 111", takenWith("A")]]);
    const root = render(
      { kind: "any", of: [course("COMP_SCI", "111"), course("COMP_SCI", "150")] },
      history
    );
    expect(ops(root)).toEqual(["one of"]);
    expect(root.querySelector(".bc-prereq-tree__kids")?.className).toContain("--any");
    expect(pillFor(root, "COMP_SCI 111")?.className).toContain("--ok");
    expect(pillFor(root, "COMP_SCI 150")?.className).toContain("--lock");
  });

  it("nests groups", () => {
    const root = render({
      kind: "all",
      of: [
        course("COMP_SCI", "211"),
        { kind: "any", of: [course("COMP_SCI", "213"), course("COMP_ENG", "205")] }
      ]
    });
    expect(ops(root)).toEqual(["all", "one of"]);
    expect(root.querySelectorAll(".bc-prereq-tree__kids .bc-prereq-tree__kids")).toHaveLength(1);
  });

  it("collapses single-child and empty groups", () => {
    const single = render({ kind: "all", of: [course("COMP_SCI", "211")] });
    expect(ops(single)).toEqual([]);
    expect(pills(single)).toHaveLength(1);
    expect(pills(render({ kind: "all", of: [] }))[0].textContent).toMatch(/Trivially satisfied/);
  });

  it("renders consent as warn and free-text requirements as soft neutral pills", () => {
    expect(pills(render({ kind: "consent", source: "instructor" }))[0].className).toContain(
      "--warn"
    );
    for (const node of [
      { kind: "topic", topic: "linear algebra" },
      { kind: "standing", level: "junior" }
    ] as PrereqNode[]) {
      const pill = pills(render(node))[0];
      expect(pill.className).toContain("--neutral");
      expect(pill.className).toContain("--soft");
    }
  });

  it("leads with the target course when one is given", () => {
    const root = renderPrereqTree(document, course("COMP_SCI", "211"), emptyHistory(), {
      target: { subject: "COMP_SCI", number: "214-0", state: "blocked" }
    }).el;
    const all = pills(root);
    expect(all[0].textContent).toBe("COMP_SCI 214");
    expect(all[0].className).toContain("--target");
    expect(all[1].textContent).toBe("COMP_SCI 211");
  });
});

describe("renderPrereqTree expansion", () => {
  const c = (number: string): PrereqNode => course("MATH", number, "0");
  const record = (id: string, parsed: PrereqNode): [string, PrereqRecord] => [
    `MATH ${id}-0`,
    { id: `MATH ${id}-0`, raw: "", parsed, warnings: [] }
  ];
  // 300 and 310 both need 200, which needs 100.
  const parsedMap = new Map([
    record("300", c("200")),
    record("310", c("200")),
    record("200", c("100")),
    record("100", c("300"))
  ]);
  const labels = (node: PrereqNode, history = emptyHistory()): string[] =>
    pills(renderPrereqTree(document, node, history, { parsedMap }).el).map((p) =>
      (p.textContent ?? "").replace(/^✓ /, "")
    );

  it("draws the prereqs of only one OR alternative", () => {
    expect(labels({ kind: "any", of: [c("300"), c("310")] })).toEqual([
      "MATH 300",
      "MATH 200",
      "MATH 100",
      "MATH 310"
    ]);
  });

  it("draws a repeated course's prereqs once", () => {
    expect(labels({ kind: "all", of: [c("300"), c("310")] })).toEqual([
      "MATH 300",
      "MATH 200",
      "MATH 100",
      "MATH 310",
      "MATH 200"
    ]);
  });

  it("draws nothing under a course already taken", () => {
    const history = new Map([["MATH 300", takenWith("A")]]);
    expect(labels({ kind: "all", of: [c("300"), c("310")] }, history)).toEqual([
      "MATH 300",
      "MATH 310",
      "MATH 200",
      "MATH 100"
    ]);
  });

  it("stops at the depth cap and never loops back to an ancestor", () => {
    // 300 → 200 → 100 is two levels down; 100's own prereq (300) is not drawn.
    expect(labels(c("300"))).toEqual(["MATH 300", "MATH 200", "MATH 100"]);
  });
});
