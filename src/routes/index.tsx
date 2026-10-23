import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Leaf, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Intake, type IntakeValues } from "@/components/repair/Intake";
import { Escalation, FollowUp, Guide, RiskBadge } from "@/components/repair/Result";
import { assessCase } from "@/lib/repair.functions";
import type { RepairResult } from "@/lib/repair.schema";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mendly — Safe AI help to repair it yourself" },
      { name: "description", content: "Describe what's broken in plain words. Get a safety check, simple step-by-step repair help and second-hand material options." },
      { property: "og:title", content: "Mendly — Safe AI help to repair it yourself" },
      { property: "og:description", content: "Plain-language repair guides with safety checks and sustainable sourcing." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Answer = { q: string; a: string };

function Index() {
  const [intake, setIntake] = useState<IntakeValues | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<RepairResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(values: IntakeValues, ans: Answer[]) {
    setBusy(true);
    setError(null);
    try {
      const r = await assessCase({ data: { ...values, answers: ans } });
      if (r.ok) setResult(r.result);
      else setError(r.error);
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setIntake(null);
    setAnswers([]);
    setResult(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-background bg-hero">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-6">
        <button onClick={reset} className="flex items-center gap-2 font-display text-2xl font-semibold"><Sprout className="text-primary" /> Mendly</button>
        <span className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex"><Leaf className="size-4 text-primary" /> Repair first. Reuse second.</span>
      </header>

      <main className="mx-auto max-w-4xl px-5 pb-24">
        {!intake ? (
          <>
            <div className="py-8 md:py-12">
              <h1 className="max-w-2xl text-4xl leading-tight md:text-6xl">Fix it yourself — <em className="text-primary">safely.</em></h1>
              <p className="mt-4 max-w-xl text-lg text-muted-foreground">Tell us what's broken in your own words. We check for risks, ask what's missing, and guide you step by step — using what you already own.</p>
            </div>
            <div className="rounded-3xl border border-border bg-card/70 p-6 shadow-soft backdrop-blur md:p-8">
              <Intake busy={busy} onSubmit={(v) => { setIntake(v); setAnswers([]); setResult(null); run(v, []); }} />
            </div>
          </>
        ) : (
          <div className="space-y-6 pt-4">
            <Button variant="ghost" size="sm" onClick={reset}><ArrowLeft /> Start over</Button>
            <div className="rounded-2xl bg-secondary p-5">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your problem</p>
              <p className="mt-1 text-lg">{result?.summary ?? intake.problem}</p>
              {result && <div className="mt-3"><RiskBadge risk={result.risk} /> <span className="ml-2 text-sm text-muted-foreground">{result.risk.reason}</span></div>}
            </div>

            {busy && <Loading />}
            {error && !busy && (
              <div className="space-y-3 rounded-2xl border border-destructive bg-card p-5" role="alert">
                <p className="font-semibold text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground">We'd rather show nothing than a guess that might be wrong.</p>
                <Button variant="outline" onClick={() => run(intake, answers)}>Try again</Button>
              </div>
            )}
            {result && !busy && result.outcome === "follow_up" && (
              <FollowUp key={result.questions.join("|")} questions={result.questions} busy={busy} onAnswer={(a) => { const next = [...answers, ...a]; setAnswers(next); run(intake, next); }} />
            )}
            {result && !busy && (result.outcome === "escalate" || result.outcome === "not_recommended") && result.escalation && <Escalation result={result} />}
            {result && !busy && result.outcome === "guide" && result.guide && <Guide result={result} problem={intake.problem} skill={intake.skill} />}
          </div>
        )}
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-6" aria-live="polite">
      <p className="font-medium">Checking for safety risks and working out your repair…</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>
    </div>
  );
}
