import { describe, expect, it } from "vitest";
import { classifyPackages, detectHazards, enforceSafety, groundInventory, type RepairResult } from "@/lib/repair.schema";
import { deductFromStock } from "@/lib/profiles";

const base: RepairResult = {
  outcome: "guide",
  summary: "s",
  risk: { level: "low", signals: [], reason: "r" },
  questions: [],
  workPackages: [],
  localRules: [],
  escalation: null,
  guide: {
    diagnosis: "d", difficulty: "easy", timeMinutes: 10, confidence: "high", assumptions: [],
    tools: [{ name: "Phillips screwdriver", inInventory: true }],
    materials: [{ name: "Wood screws 4x30", spec: "4x30 mm", amount: 8, unit: "pcs", category: "hardware", inInventory: true }],
    steps: [{ title: "t", detail: "x" }], warnings: ["w"], reuseTip: "",
  },
};

const pkg = (p: Partial<RepairResult["workPackages"][number]>) => ({ title: "Paint fence", category: "diy" as const, reason: "easy", uncertain: false, wouldChangeIf: "", ...p });

describe("safety rules", () => {
  it("escalates a gas smell", () => expect(detectHazards("I smell gas near the stove")).toContain("Possible gas leak"));
  it("escalates damaged wiring", () => expect(detectHazards("the lamp has a frayed cable")).toContain("Damaged electrical wiring"));
  it("does not flag a sticking drawer", () => expect(detectHazards("My drawer is sticking")).toEqual([]));
  it("never shows a guide for high risk", () => {
    const r = enforceSafety({ ...base, risk: { ...base.risk, level: "high" } });
    expect(r.outcome).toBe("escalate");
    expect(r.guide).toBeNull();
  });
  it("rejects a guide without steps", () => {
    expect(() => enforceSafety({ ...base, guide: { ...base.guide!, steps: [] } })).toThrow();
  });
});

describe("work packages (SAF-06/07)", () => {
  it("moves an uncertain DIY package to DIY preparation", () => expect(classifyPackages([pkg({ uncertain: true })])[0]!.category).toBe("diy_prep"));
  it("moves an uncertain professional package to not recommended", () =>
    expect(classifyPackages([pkg({ category: "professional", uncertain: true })])[0]!.category).toBe("not_recommended"));
  it("forces 230 V work to professional even if labelled DIY", () =>
    expect(classifyPackages([pkg({ title: "Connect outdoor light to 230 V supply" })])[0]!.category).toBe("professional"));
  it("forces refrigerant work to professional", () =>
    expect(classifyPackages([pkg({ title: "Refill refrigerant circuit", category: "diy_prep" })])[0]!.category).toBe("professional"));
  it("leaves certain DIY work as DIY", () => expect(classifyPackages([pkg({})])[0]!.category).toBe("diy"));
});

describe("inventory grounding (AIR-09)", () => {
  it("marks a material available only with enough quantity", () => {
    const r = groundInventory(base, "", [{ name: "wood screws", quantity: 5, unit: "pcs", location: "" }]);
    expect(r.guide!.materials[0]!.inInventory).toBe(false);
    const ok = groundInventory(base, "", [{ name: "wood screws", quantity: 20, unit: "pcs", location: "garage" }]);
    expect(ok.guide!.materials[0]!.inInventory).toBe(true);
  });
  it("does not mark a tool available that the user never listed", () => {
    expect(groundInventory(base, "hammer, drill", []).guide!.tools[0]!.inInventory).toBe(false);
    expect(groundInventory(base, "hammer, screwdriver", []).guide!.tools[0]!.inInventory).toBe(true);
  });
  it("deducts used material and removes empty items", () => {
    const left = deductFromStock([{ name: "wood screws", quantity: 20, unit: "pcs", location: "" }, { name: "wood glue", quantity: 50, unit: "g", location: "" }], [{ name: "Wood screws 4x30", amount: 8 }, { name: "Wood glue", amount: 50 }]);
    expect(left).toEqual([{ name: "wood screws", quantity: 12, unit: "pcs", location: "" }]);
  });
});
