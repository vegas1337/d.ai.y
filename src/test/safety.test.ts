import { describe, expect, it } from "vitest";
import { detectHazards, enforceSafety, type RepairResult } from "@/lib/repair.schema";

const base: RepairResult = {
  outcome: "guide",
  summary: "s",
  risk: { level: "low", signals: [], reason: "r" },
  questions: [],
  escalation: null,
  guide: {
    diagnosis: "d", difficulty: "easy", timeMinutes: 10, confidence: "high", assumptions: [],
    tools: [], materials: [], steps: [{ title: "t", detail: "x" }], warnings: ["w"], reuseTip: "",
  },
};

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
