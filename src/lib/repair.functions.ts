import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ModelMessage } from "ai";
import {
  caseInputSchema,
  detectHazards,
  enforceSafety,
  groundInventory,
  SKILL_AREAS,
  repairResultSchema,
  type RepairResult,
} from "./repair.schema";

const PROMPT_VERSION = "repair-v2";

const INSTRUCTIONS = `You are a careful, friendly home-repair assistant for people of any skill level. Prompt version ${PROMPT_VERSION}.

Decide ONE outcome:
- "follow_up": key information is missing (what exactly happens, material, size, brand, when it started). Ask 1-3 short questions in everyday words. Never present assumptions as facts. Ask follow-ups at most twice; after that, give a guide with clearly listed assumptions if safe.
- "guide": the problem is clear and safe for a layperson.
- "escalate": any hazard (gas, damaged wiring, mains electricity, water near electrics, structural, fire, CO, sharp/pressurised parts, legal or certification requirements like gas appliances or fixed electrical installation). Give immediate safety actions and which professional to call. NO repair steps.
- "not_recommended": repair is not sensible (too costly, unsafe part, warranty). Explain why in "summary" and put alternatives in escalation.

Scope: household repairs, small home/garden projects, low-voltage and digital projects (router, smart home, heat-pump data interface). Out of scope (inform and escalate, no instructions): fixed 230/400 V installations, grid connection, gas installations, refrigerant circuits, load-bearing structures, chimneys, energy-renovation planning or funding.

Work packages: if the request involves several tasks or any professional part, split it into "workPackages" and label each: "diy", "diy_prep" (DIY preparation for a professional), "professional", or "not_recommended", with a short reason. If unsure, set uncertain=true and say in "wouldChangeIf" which information would change the label. Guide steps cover ONLY diy and diy_prep packages. Simple single-task repairs may use one package or an empty array.

Skill (per area) changes ONLY detail and language, NEVER which work is professional-only or not recommended, and never removes warnings: safety content is identical for every skill level.

Location-dependent rules (permitted fence height, building permits, landlord permission, disposal rules): put them in "localRules" phrased as "Check locally: ...". Never state them as fact.

Always fill "summary" with a 1-2 sentence plain-language restatement of the problem. Always classify risk conservatively; if unclear, choose the higher level. Never use "guide" when risk is high or critical.

For guides: adapt to the skill level (beginner = more explanation, explain every technical term in brackets, extra safety notes). Short sentences, numbered actionable steps (3-10). Mark tools/materials as inInventory=true only if they appear in the user's lists with enough quantity. Prefer using the user's own stock before anything new. Each material needs a numeric "amount" and a "unit" (pcs, m, g, ml, ...). Material "spec" must contain concrete requirements (dimensions, material, function) or "measure first: ..." if unknown. Prefer repair and reuse over replacement; "reuseTip" explains a reuse or second-hand option without claiming CO2 numbers. Warnings: concrete, at least one.
Set unused fields to null / empty arrays.`;

function buildMessages(input: z.infer<typeof caseInputSchema>): ModelMessage[] {
  const label = { beginner: "beginner", some_experience: "some experience", experienced: "experienced" };
  const skillLabel = SKILL_AREAS.map((a) => `${a}: ${label[input.skills[a]]}`).join(", ");
  const stock = input.materials.length
    ? input.materials.map((m) => `${m.name}: ${m.quantity} ${m.unit}${m.location ? ` (${m.location})` : ""}`).join("; ")
    : "none listed";
  const qa = input.answers.length
    ? `\n\nFollow-up answers so far (${input.answers.length}):\n` +
      input.answers.map((x, i) => `${i + 1}. Q: ${x.q}\n   A: ${x.a || "(no answer)"}`).join("\n")
    : "";
  const text = `Problem: ${input.problem}\nSkill by area: ${skillLabel}\nTools I own: ${input.tools || "none listed"}\nMaterials in stock: ${stock}${qa}`;
  const content: Exclude<ModelMessage, { role: "system" }>["content"] = [{ type: "text", text }];
  if (input.photo) {
    const m = input.photo.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (m) (content as unknown[]).push({ type: "file", mediaType: m[1], data: m[2] });
  }
  return [{ role: "user", content } as ModelMessage];
}

export type AssessResponse = { ok: true; result: RepairResult; source: "ai" | "safety_rule" } | { ok: false; error: string };

export const assessCase = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => caseInputSchema.parse(d))
  .handler(async ({ data }): Promise<AssessResponse> => {
    const hazards = detectHazards(`${data.problem} ${data.answers.map((a) => a.a).join(" ")}`);
    if (hazards.length) {
      return {
        ok: true,
        source: "safety_rule",
        result: {
          outcome: "escalate",
          summary: "Your description contains warning signs that make a DIY repair unsafe.",
          risk: { level: "critical", signals: hazards, reason: "Immediate danger to people or property is possible." },
          questions: [],
          workPackages: [],
          localRules: [],
          guide: null,
          escalation: {
            message: "Please do not try to repair this yourself. Your safety comes first.",
            immediateActions: hazards.some((h) => h.includes("gas"))
              ? ["Do not use switches, flames or phones inside", "Open windows and leave the building", "Call the gas emergency line from outside"]
              : ["Switch off power at the fuse box if safe to reach", "Unplug the device and stop using it", "Keep children and pets away"],
            professional: hazards.some((h) => h.includes("gas")) ? "Gas emergency service / licensed gas fitter" : "Licensed electrician",
          },
        },
      };
    }
    const { runStructured, AiError } = await import("./ai.server");
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await runStructured({ instructions: INSTRUCTIONS, messages: buildMessages(data), schema: repairResultSchema });
        return { ok: true, source: "ai", result: groundInventory(enforceSafety(raw), data.tools, data.materials) };
      } catch (e) {
        const retryable = !(e instanceof AiError) || e.code === "invalid";
        if (attempt === 1 || !retryable) {
          return { ok: false, error: e instanceof AiError && e.code !== "invalid" ? e.message : "We couldn't produce a reliable answer for this case. Please add a few more details and try again." };
        }
      }
    }
    return { ok: false, error: "Something went wrong." };
  });

const explainInput = z.object({
  problem: z.string().max(2000),
  skill: z.string().max(40),
  stepTitle: z.string().max(300),
  stepDetail: z.string().max(2000),
  question: z.string().max(1000).nullable(),
});

export const explainStep = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => explainInput.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; text: string; escalate: boolean } | { ok: false; error: string }> => {
    if (data.question && detectHazards(data.question).length) {
      return { ok: true, escalate: true, text: "That sounds dangerous. Stop now, make the area safe and contact a professional." };
    }
    const { runStructured, AiError } = await import("./ai.server");
    try {
      const r = await runStructured({
        instructions:
          "You help someone during a home repair. Answer in short, simple sentences (max 6), explain any technical term. If the situation sounds unsafe, set escalate=true and tell them to stop. If you don't know, say so honestly.",
        messages: [
          {
            role: "user",
            content: `Repair: ${data.problem}\nSkill: ${data.skill}\nStep: ${data.stepTitle} — ${data.stepDetail}\n${data.question ? `My problem/question: ${data.question}` : "Please explain this step again more simply."}`,
          },
        ],
        schema: z.object({ text: z.string(), escalate: z.boolean() }),
      });
      return { ok: true, ...r };
    } catch (e) {
      return { ok: false, error: e instanceof AiError ? e.message : "Couldn't get an explanation." };
    }
  });
