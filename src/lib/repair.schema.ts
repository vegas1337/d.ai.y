import { z } from "zod";

export const SKILL_LEVELS = ["beginner", "some_experience", "experienced"] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const SKILL_AREAS = ["woodwork", "plumbing", "electrical", "network", "heating"] as const;
export type SkillArea = (typeof SKILL_AREAS)[number];
export type Skills = Record<SkillArea, SkillLevel>;
export const DEFAULT_SKILLS: Skills = { woodwork: "beginner", plumbing: "beginner", electrical: "beginner", network: "beginner", heating: "beginner" };

export const WORK_CATEGORIES = ["diy", "diy_prep", "professional", "not_recommended"] as const;
export type WorkCategory = (typeof WORK_CATEGORIES)[number];

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
  workPackages: z.array(
    z.object({
      title: z.string(),
      category: z.enum(WORK_CATEGORIES),
      reason: z.string(),
      uncertain: z.boolean(),
      wouldChangeIf: z.string(),
    }),
  ),
  localRules: z.array(z.string()),
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
          amount: z.number(),
          unit: z.string(),
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

export const inventoryItemSchema = z.object({
  name: z.string().min(1).max(100),
  quantity: z.number().min(0).max(100000),
  unit: z.string().max(20),
  location: z.string().max(60),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const caseInputSchema = z.object({
  problem: z.string().min(5).max(2000),
  skills: z.object({
    woodwork: z.enum(SKILL_LEVELS),
    plumbing: z.enum(SKILL_LEVELS),
    electrical: z.enum(SKILL_LEVELS),
    network: z.enum(SKILL_LEVELS),
    heating: z.enum(SKILL_LEVELS),
  }),
  tools: z.string().max(1500),
  materials: z.array(inventoryItemSchema).max(100),
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
  r = { ...r, workPackages: classifyPackages(r.workPackages) };
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

/** Work that is legally/technically restricted regardless of skill (SAF-07). */
const RESTRICTED = /\b(230|400)\s?v\b|\bmains\b|fixed (electrical )?(installation|wiring)|consumer unit|fuse ?box|grid connection|gas (line|pipe|installation|boiler|appliance|heater)|refrigerant|load[- ]bearing|chimney|\bflue\b/i;
const ORDER: WorkCategory[] = ["diy", "diy_prep", "professional", "not_recommended"];

/** SAF-06/07: uncertain packages move one level more restrictive; restricted work is never DIY. Skill is deliberately not an input. */
export function classifyPackages(pkgs: RepairResult["workPackages"]): RepairResult["workPackages"] {
  return pkgs.map((p) => {
    let idx = ORDER.indexOf(p.category);
    if (p.uncertain && idx < ORDER.length - 1) idx += 1;
    if (RESTRICTED.test(`${p.title} ${p.reason}`) && idx < 2) idx = 2;
    return { ...p, category: ORDER[idx]! };
  });
}

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .split(/[^a-z0-9äöüß]+/)
    .filter((t) => t.length >= 3)
    .map((t) => t.replace(/(es|s)$/, ""));
}

function namesMatch(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  return ta.every((t) => tb.includes(t)) || tb.every((t) => ta.includes(t));
}

const unitNorm = (u: string) => u.trim().toLowerCase().replace(/^(pieces?|pcs?\.?|stk\.?|x)$/, "pcs");

export function findStock(name: string, stock: InventoryItem[]): InventoryItem | undefined {
  return stock.find((s) => namesMatch(s.name, name));
}

/** AIR-09: an item only counts as "available" when it is really in the inventory with enough quantity. */
export function groundInventory(r: RepairResult, tools: string, stock: InventoryItem[]): RepairResult {
  if (!r.guide) return r;
  const toolList = tools.split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);
  return {
    ...r,
    guide: {
      ...r.guide,
      tools: r.guide.tools.map((t) => ({ ...t, inInventory: toolList.some((x) => namesMatch(x, t.name)) })),
      materials: r.guide.materials.map((m) => {
        const s = findStock(m.name, stock);
        const unitOk = !!s && (!s.unit.trim() || !m.unit.trim() || unitNorm(s.unit) === unitNorm(m.unit));
        return { ...m, inInventory: !!s && unitOk && s.quantity >= m.amount };
      }),
    },
  };
}
