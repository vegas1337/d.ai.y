import { z } from "zod";

export const SKILL_LEVELS = ["beginner", "some_experience", "experienced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const MATERIAL_CATEGORIES = [
  "hardware",
  "wood",
  "adhesive",
  "lubricant",
  "plumbing",
  "textile",
  "electrical",
  "other",
] as const;

export const repairResultSchema = z.object({
  outcome: z.enum(["follow_up", "guide", "escalate", "not_recommended"]),
  summary: z.string(),
  risk: z.object({
    level: z.enum(["low", "medium", "high", "critical"]),
    signals: z.array(z.string()),
    reason: z.string(),
  }),
  questions: z.array(z.string()),
  escalation: z
    .object({
      message: z.string(),
      immediateActions: z.array(z.string()),
      professional: z.string(),
    })
    .nullable(),
  guide: z
    .object({
      diagnosis: z.string(),
      difficulty: z.enum(["easy", "medium", "hard"]),
      timeMinutes: z.number(),
      confidence: z.enum(["high", "medium", "low"]),
      assumptions: z.array(z.string()),
      tools: z.array(z.object({ name: z.string(), inInventory: z.boolean() })),
      materials: z.array(
        z.object({
          name: z.string(),
          spec: z.string(),
          quantity: z.string(),
          category: z.enum(MATERIAL_CATEGORIES),
          inInventory: z.boolean(),
        }),
      ),
      steps: z.array(z.object({ title: z.string(), detail: z.string() })),
      warnings: z.array(z.string()),
      reuseTip: z.string(),
    })
    .nullable(),
});
export type RepairResult = z.infer<typeof repairResultSchema>;

export const caseInputSchema = z.object({
  problem: z.string().min(5).max(2000),
  skill: z.enum(SKILL_LEVELS),
  inventory: z.string().max(1500),
  photo: z.string().max(3_000_000).nullable(),
  answers: z.array(z.object({ q: z.string().max(500), a: z.string().max(1000) })).max(12),
});
export type CaseInput = z.infer<typeof caseInputSchema>;

/** Deterministic pre-check (SAF-01/02): obvious hazards are escalated before any AI call. */
const HAZARDS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(gas smell|smell(s)? (of )?gas|gas leak|gasgeruch)\b/i, label: "Possible gas leak" },
  { pattern: /\b(exposed|frayed|damaged|burnt|melted)\b.{0,25}\b(wire|wiring|cable|cord|socket|outlet)\b/i, label: "Damaged electrical wiring" },
  { pattern: /\b(sparks?|sparking|electric shock|shocked me)\b/i, label: "Sparks or electric shock" },
  { pattern: /\b(smoke|burning smell|on fire)\b/i, label: "Smoke or fire" },
  { pattern: /\b(carbon monoxide|co alarm)\b/i, label: "Carbon monoxide" },
  { pattern: /\b(fuse box|breaker panel|mains|load[- ]bearing|structural crack)\b/i, label: "Mains or structural work" },
];

export function detectHazards(text: string): string[] {
  return HAZARDS.filter((h) => h.pattern.test(text)).map((h) => h.label);
}

/** SAF-03: validate AI output and force a safe path when it is inconsistent. */
export function enforceSafety(r: RepairResult): RepairResult {
  if ((r.risk.level === "high" || r.risk.level === "critical") && r.outcome === "guide") {
    return {
      ...r,
      outcome: "escalate",
      guide: null,
      escalation: r.escalation ?? {
        message: "This repair carries a high risk. Please don't attempt it yourself.",
        immediateActions: ["Stop using the item", "Contact a qualified professional"],
        professional: "Qualified technician",
      },
    };
  }
  if (r.outcome === "guide" && (!r.guide || r.guide.steps.length === 0 || r.guide.diagnosis.trim() === "")) {
    throw new Error("incomplete_guide");
  }
  if (r.outcome === "follow_up" && r.questions.length === 0) throw new Error("missing_questions");
  if (r.outcome === "escalate" && !r.escalation) throw new Error("missing_escalation");
  return r;
}
