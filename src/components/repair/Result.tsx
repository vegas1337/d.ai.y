import { useState } from "react";
import { AlertTriangle, Check, Clock, HelpCircle, Leaf, MessageCircle, Package, Phone, RotateCcw, ShieldAlert, Wrench, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { RepairResult } from "@/lib/repair.schema";
import { matchOffers } from "@/lib/offers";
import { explainStep } from "@/lib/repair.functions";

const RISK_STYLE: Record<RepairResult["risk"]["level"], string> = {
  low: "bg-success text-success-foreground",
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
  critical: "bg-destructive text-destructive-foreground",
};

export function RiskBadge({ risk }: { risk: RepairResult["risk"] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${RISK_STYLE[risk.level]}`}>
      <ShieldAlert className="size-4" /> Risk: {risk.level}
    </span>
  );
}

export function FollowUp({ questions, onAnswer, busy }: { questions: string[]; onAnswer: (a: { q: string; a: string }[]) => void; busy: boolean }) {
  const [answers, setAnswers] = useState<string[]>(questions.map(() => ""));
  return (
    <form
      className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft"
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(questions.map((q, i) => ({ q, a: (answers[i] ?? "").trim() })));
      }}
    >
      <h2 className="flex items-center gap-2 text-2xl"><HelpCircle className="text-primary" /> A few quick questions</h2>
      <p className="text-muted-foreground">So we don't guess — your answers make the advice safer and more accurate.</p>
      {questions.map((q, i) => (
        <div key={q} className="space-y-2">
          <label htmlFor={`q${i}`} className="font-medium">{q}</label>
          <Input id={`q${i}`} value={answers[i]} onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder="Your answer (or “not sure”)" className="bg-background" />
        </div>
      ))}
      <Button type="submit" disabled={busy || answers.every((a) => !a.trim())}>{busy ? "Thinking…" : "Continue"}</Button>
    </form>
  );
}

export function Escalation({ result }: { result: RepairResult }) {
  const e = result.escalation!;
  return (
    <div className="space-y-4 rounded-2xl border-2 border-destructive bg-card p-6 shadow-soft" role="alert">
      <h2 className="flex items-center gap-2 text-2xl text-destructive"><AlertTriangle /> {result.outcome === "escalate" ? "Please don't repair this yourself" : "We don't recommend this repair"}</h2>
      <p className="text-lg">{e.message}</p>
      {result.risk.signals.length > 0 && (
        <p className="text-sm text-muted-foreground">Warning signs found: {result.risk.signals.join(", ")}</p>
      )}
      <div>
        <h3 className="mb-2 font-sans font-semibold">What to do now</h3>
        <ol className="list-decimal space-y-1 pl-5">{e.immediateActions.map((a) => <li key={a}>{a}</li>)}</ol>
      </div>
      <p className="flex items-center gap-2 rounded-lg bg-muted p-3 font-medium"><Phone className="size-4" /> Who to contact: {e.professional}</p>
    </div>
  );
}

export function Guide({ result, problem, skill }: { result: RepairResult; problem: string; skill: string }) {
  const g = result.guide!;
  const [done, setDone] = useState<boolean[]>(g.steps.map(() => false));
  const progress = done.filter(Boolean).length;
  const toBuy = g.materials.filter((m) => !m.inInventory);
  const toolsToGet = g.tools.filter((t) => !t.inInventory);

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Diagnosis</p>
        <p className="mt-2 text-lg">{g.diagnosis}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary"><Clock className="size-3.5" /> ~{g.timeMinutes} min</Badge>
          <Badge variant="secondary">Difficulty: {g.difficulty}</Badge>
          <Badge variant="outline">AI confidence: {g.confidence}</Badge>
        </div>
        {g.assumptions.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground"><strong>Assumed (please check):</strong> {g.assumptions.join(" · ")}</p>
        )}
      </section>

      {g.warnings.length > 0 && (
        <section className="rounded-2xl border border-warning-foreground/30 bg-warning p-5 text-warning-foreground">
          <h3 className="mb-2 flex items-center gap-2 font-sans font-bold"><AlertTriangle className="size-5" /> Before you start</h3>
          <ul className="list-disc space-y-1 pl-5">{g.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-sans font-bold"><Wrench className="size-5 text-primary" /> Tools</h3>
          <ul className="space-y-2">{g.tools.map((t) => <InvRow key={t.name} name={t.name} have={t.inInventory} />)}</ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-sans font-bold"><Package className="size-5 text-primary" /> Materials</h3>
          {g.materials.length === 0 && <p className="text-sm text-muted-foreground">Nothing to buy for this repair.</p>}
          <ul className="space-y-2">{g.materials.map((m) => <InvRow key={m.name} name={`${m.quantity} × ${m.name}`} sub={m.spec} have={m.inInventory} />)}</ul>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl">Step by step</h2>
          <span className="text-sm font-medium text-muted-foreground">{progress} of {g.steps.length} done</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemax={g.steps.length}>
          <div className="h-full bg-primary transition-all" style={{ width: `${(progress / g.steps.length) * 100}%` }} />
        </div>
        <ol className="space-y-3">
          {g.steps.map((s, i) => (
            <Step key={i} index={i} step={s} done={done[i] ?? false} toggle={() => setDone((d) => d.map((x, j) => (j === i ? !x : x)))} problem={problem} skill={skill} />
          ))}
        </ol>
        {progress === g.steps.length && <p className="rounded-xl bg-success p-4 font-semibold text-success-foreground">🎉 All steps done — nice work keeping it out of the bin!</p>}
      </section>

      {(toBuy.length > 0 || toolsToGet.length > 0) && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-2xl"><Leaf className="text-primary" /> Where to get what's missing</h2>
          {g.reuseTip && <p className="rounded-xl bg-secondary p-4">{g.reuseTip}</p>}
          <p className="text-sm text-muted-foreground">Sample offers for demonstration — not live prices. Second-hand items are listed first. Check dimensions yourself: seller info is not verified compatibility.</p>
          {toolsToGet.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 font-sans text-lg font-bold"><Wrench className="size-5 text-primary" /> Tools you don't have yet</h3>
              <p className="text-sm text-muted-foreground">Tip: borrow before you buy — ask neighbours, a tool library or a repair café.</p>
              {toolsToGet.map((t) => (
                <div key={t.name} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-semibold">{t.name}</p>
                  <ShopLinks query={t.name} />
                </div>
              ))}
            </div>
          )}
          {toBuy.length > 0 && <h3 className="flex items-center gap-2 font-sans text-lg font-bold"><Package className="size-5 text-primary" /> Parts & materials</h3>}
          {toBuy.map((m) => <OfferCompare key={m.name} name={m.name} spec={m.spec} category={m.category} />)}
        </section>
      )}
    </div>
  );
}

function InvRow({ name, sub, have }: { name: string; sub?: string; have: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`mt-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold ${have ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>{have ? "✓ You have" : "Needed"}</span>
      <span>
        <span className="block">{name}</span>
        {sub && <span className="block text-sm text-muted-foreground">{sub} <em className="not-italic opacity-70">(AI estimate)</em></span>}
      </span>
    </li>
  );
}

function Step({ index, step, done, toggle, problem, skill }: { index: number; step: { title: string; detail: string }; done: boolean; toggle: () => void; problem: string; skill: string }) {
  const [help, setHelp] = useState<{ text: string; escalate: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function ask(question: string | null) {
    setBusy(true);
    setErr(null);
    const r = await explainStep({ data: { problem, skill, stepTitle: step.title, stepDetail: step.detail, question } }).catch(() => ({ ok: false as const, error: "Connection problem. Please try again." }));
    setBusy(false);
    if (r.ok) setHelp({ text: r.text, escalate: r.escalate });
    else setErr(r.error);
  }

  return (
    <li className={`rounded-2xl border bg-card p-5 transition ${done ? "border-primary/40 opacity-75" : "border-border"}`}>
      <div className="flex gap-4">
        <button type="button" onClick={toggle} aria-pressed={done} aria-label={`Mark step ${index + 1} as ${done ? "not done" : "done"}`} className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 font-bold transition ${done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary"}`}>
          {done ? <Check className="size-5" /> : index + 1}
        </button>
        <div className="flex-1 space-y-2">
          <h3 className={`font-sans text-lg font-semibold ${done ? "line-through" : ""}`}>{step.title.replace(/^\s*(step\s*)?\d+[.):]\s*/i, "")}</h3>
          <p className="leading-relaxed">{step.detail}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => ask(null)}><RotateCcw /> Explain simpler</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking((a) => !a)}><MessageCircle /> I'm stuck</Button>
          </div>
          {asking && (
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (q.trim()) ask(q.trim()); }}>
              <Textarea value={q} onChange={(e) => setQ(e.target.value)} placeholder="What's happening? e.g. the screw won't turn" className="bg-background" aria-label="Describe your problem with this step" />
              <Button size="sm" type="submit" disabled={busy || !q.trim()}>Ask</Button>
            </form>
          )}
          {busy && <p className="text-sm text-muted-foreground">Thinking…</p>}
          {err && <p className="text-sm text-destructive">{err}</p>}
          {help && (
            <div className={`rounded-xl p-4 text-sm ${help.escalate ? "border-2 border-destructive bg-card" : "bg-secondary"}`}>
              {help.escalate && <p className="mb-1 flex items-center gap-1 font-bold text-destructive"><AlertTriangle className="size-4" /> Stop here</p>}
              <p className="whitespace-pre-line">{help.text}</p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function OfferCompare({ name, spec, category }: { name: string; spec: string; category: Parameters<typeof matchOffers>[1] }) {
  const offers = matchOffers(name, category);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <p className="font-semibold">{name}</p>
        <p className="text-sm text-muted-foreground">Needs: {spec}</p>
        <ShopLinks query={name} />
      </div>
      {offers.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No matching sample offers. Try a local repair café or second-hand shop.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr><th className="p-3 font-medium">Offer</th><th className="p-3 font-medium">Condition</th><th className="p-3 font-medium">Price</th><th className="p-3 font-medium">Size / material</th><th className="p-3 font-medium">Data from</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="p-3"><span className="font-medium">{o.title}</span><span className="block text-xs text-muted-foreground">{o.seller}</span></td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${o.condition === "new" ? "bg-muted text-foreground" : "bg-success text-success-foreground"}`}>
                      {o.condition !== "new" && <Leaf className="size-3" />}{o.condition}
                    </span>
                  </td>
                  <td className="p-3 font-semibold">€{o.price.toFixed(2)}</td>
                  <td className="p-3">{o.dimensions}<span className="block text-xs text-muted-foreground">{o.material}</span></td>
                  <td className="p-3 text-xs text-muted-foreground">Sample data<br />{o.updated}</td>
                  <td className="p-3"><a href={o.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">View <ExternalLink className="size-3" /></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ShopLinks({ query }: { query: string }) {
  const q = query.replace(/\(.*?\)/g, "").trim();
  const used = `https://www.kleinanzeigen.de/s-${encodeURIComponent(q.toLowerCase().replace(/\s+/g, "-"))}/k0`;
  const fresh = `https://www.obi.de/search/${encodeURIComponent(q)}/`;
  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <a href={used} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-sm font-semibold text-success-foreground hover:opacity-90">
          <Leaf className="size-4" /> Used on Kleinanzeigen <ExternalLink className="size-3" />
        </a>
        <a href={fresh} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-semibold hover:border-primary">
          New at OBI <ExternalLink className="size-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">Opens a live search. We can't check availability yet — if Kleinanzeigen shows nothing, the new option is the fallback.</p>
    </div>
  );
}
