import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, type ModelMessage } from "ai";
import type { z } from "zod";

const BASE_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(
    public code: "config" | "credits" | "rate_limit" | "denied" | "invalid" | "unknown",
    message: string,
  ) {
    super(message);
  }
}

function mapError(e: unknown): AiError {
  const status = (e as { statusCode?: number })?.statusCode ?? (e as { cause?: { statusCode?: number } })?.cause?.statusCode;
  if (status === 401) return new AiError("config", "The AI service is not configured correctly.");
  if (status === 402) return new AiError("credits", "AI credits are used up. Please add credits to continue.");
  if (status === 403) return new AiError("denied", "The AI service declined this request.");
  if (status === 429) return new AiError("rate_limit", "Too many requests right now. Please wait a moment and try again.");
  return new AiError("unknown", "The AI could not answer right now. Please try again.");
}

export async function runStructured<T>(opts: {
  instructions: string;
  messages: ModelMessage[];
  schema: z.ZodType<T>;
  effort?: "low" | "medium";
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("config", "The AI service is not configured.");
  const provider = createOpenAI({
    baseURL: BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions: opts.instructions,
      messages: opts.messages,
      output: Output.object({ schema: opts.schema }),
      providerOptions: {
        openai: {
          forceReasoning: true,
          reasoningEffort: opts.effort ?? "low",
          reasoningSummary: "auto",
          store: false,
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const text = await result.text;
    const parsed = opts.schema.safeParse(JSON.parse(text));
    if (!parsed.success) throw new AiError("invalid", "The AI answer was incomplete.");
    return parsed.data;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof SyntaxError) throw new AiError("invalid", "The AI answer was incomplete.");
    console.error("AI call failed", e);
    throw mapError(e);
  }
}
