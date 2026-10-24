import { useEffect, useRef, useState } from "react";
import { Camera, Trash2, User, X, Leaf, ShieldCheck } from "lucide-react";
import { useHydrated } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SkillLevel } from "@/lib/repair.schema";
import { deleteProfile, getLastProfileId, readProfiles, saveProfile, setLastProfileId, type RepairProfile } from "@/lib/profiles";

const EXAMPLES = [
  "My drawer is sticking and no longer closes properly.",
  "The kitchen tap keeps dripping even when closed tight.",
  "A cabinet door hangs crooked and rubs against the frame.",
];

const SKILLS: { value: SkillLevel; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "I rarely use tools" },
  { value: "some_experience", label: "Some experience", hint: "I've done small fixes" },
  { value: "experienced", label: "Experienced", hint: "I'm comfortable with tools" },
];

async function downscale(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

export type IntakeValues = { problem: string; skill: SkillLevel; inventory: string; photo: string | null };

export function Intake({ onSubmit, busy }: { onSubmit: (v: IntakeValues) => void; busy: boolean }) {
  const [problem, setProblem] = useState("");
  const [skill, setSkill] = useState<SkillLevel>("beginner");
  const [inventory, setInventory] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const hydrated = useHydrated();
  const [profiles, setProfiles] = useState<RepairProfile[]>([]);
  const [activeId, setActiveId] = useState<string>("none");
  const [newName, setNewName] = useState("");

  // Load saved profiles after hydration (they live in localStorage) and pre-select the last used one.
  useEffect(() => {
    const all = readProfiles();
    setProfiles(all);
    const last = all.find((p) => p.id === getLastProfileId());
    if (last) {
      setActiveId(last.id);
      setSkill(last.skill);
      setInventory(last.inventory);
    }
  }, []);

  function selectProfile(id: string) {
    setActiveId(id);
    if (id === "none") {
      setLastProfileId(null);
      return;
    }
    if (id === "new") return;
    const p = profiles.find((x) => x.id === id);
    if (p) {
      setSkill(p.skill);
      setInventory(p.inventory);
      setLastProfileId(p.id);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (problem.trim().length < 5) return;
    if (activeId === "new") {
      const saved = saveProfile({ name: newName.trim() || "My profile", skill, inventory: inventory.trim() });
      setProfiles(readProfiles());
      setActiveId(saved.id);
      setNewName("");
    } else if (activeId !== "none") {
      const p = profiles.find((x) => x.id === activeId);
      if (p) {
        saveProfile({ id: p.id, name: p.name, skill, inventory: inventory.trim() });
        setProfiles(readProfiles());
      }
    }
    onSubmit({ problem: problem.trim(), skill, inventory: inventory.trim(), photo });
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      {hydrated && (
        <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-secondary/60 p-4">
          <Label htmlFor="profile" className="flex items-center gap-2 text-sm font-semibold">
            <User className="size-4 text-primary" /> Profile
          </Label>
          <select
            id="profile"
            value={activeId}
            onChange={(e) => selectProfile(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm"
          >
            <option value="none">No profile</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="new">+ New profile…</option>
          </select>
          {activeId === "new" && (
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Profile name, e.g. Marvin"
              className="h-9 w-48 bg-card"
              maxLength={40}
              aria-label="Profile name"
            />
          )}
          {activeId !== "none" && activeId !== "new" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                deleteProfile(activeId);
                setProfiles(readProfiles());
                setActiveId("none");
              }}
            >
              <Trash2 /> Delete
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            A profile saves your skill level and tools on this device, so they're pre-filled next time. Any changes you make below are saved when you submit.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <Label htmlFor="problem" className="text-base font-semibold">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
          What's broken? Describe it like you'd tell a friend.
        </Label>
        <Textarea
          id="problem"
          value={problem}
          onChange={(e) => setProblem(e.target.value)}
          placeholder="e.g. My drawer is sticking and no longer closes properly."
          className="min-h-28 bg-card text-base"
          maxLength={2000}
          required
        />
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setProblem(ex)} className="rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground transition hover:border-primary hover:text-foreground">
              {ex}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload a photo"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setPhoto(await downscale(f));
            }}
          />
          {photo ? (
            <div className="relative">
              <img src={photo} alt="Your uploaded photo" className="h-20 w-20 rounded-lg object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background">
                <X className="size-3" />
              </button>
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Camera /> Add a photo (optional)
            </Button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-base font-semibold">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
          How handy are you?
        </p>
        <RadioGroup value={skill} onValueChange={(v) => setSkill(v as SkillLevel)} className="grid gap-3 sm:grid-cols-3">
          {SKILLS.map((s) => (
            <Label key={s.value} htmlFor={s.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-ring/40">
              <RadioGroupItem id={s.value} value={s.value} className="mt-0.5" />
              <span>
                <span className="block font-semibold">{s.label}</span>
                <span className="block text-sm font-normal text-muted-foreground">{s.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </section>

      <section className="space-y-3">
        <Label htmlFor="inventory" className="text-base font-semibold">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">3</span>
          Tools & materials you already have <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id="inventory" value={inventory} onChange={(e) => setInventory(e.target.value)} placeholder="e.g. screwdriver set, drill, wood glue, a candle" className="bg-card" maxLength={1500} />
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Leaf className="size-4 text-primary" /> We'll use what you own first, so you buy less.</p>
      </section>

      <div className="space-y-3">
        <Button type="submit" size="lg" disabled={busy || problem.trim().length < 5} className="w-full sm:w-auto">
          {busy ? "Checking safety & thinking…" : "Find my repair"}
        </Button>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Your text and photo are sent to an AI service only to analyse this repair. No account is needed; profiles stay on this device. Please don't include names or addresses.
        </p>
      </div>
    </form>
  );
}
