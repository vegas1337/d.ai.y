import { DEFAULT_SKILLS, SKILL_AREAS, SKILL_LEVELS, findStock, type InventoryItem, type Skills } from "./repair.schema";

export type RepairProfile = {
  id: string;
  name: string;
  skills: Skills;
  tools: string;
  materials: InventoryItem[];
  createdAt: number;
};

const PROFILES_KEY = "daiy.profiles";
const LAST_KEY = "daiy.lastProfile";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

const isLevel = (v: unknown) => typeof v === "string" && (SKILL_LEVELS as readonly string[]).includes(v);

/** Reads a stored profile, migrating the older shape (single skill + free-text inventory). */
function toProfile(x: unknown): RepairProfile | null {
  if (typeof x !== "object" || x === null) return null;
  const p = x as Record<string, unknown>;
  if (typeof p["id"] !== "string" || typeof p["name"] !== "string") return null;
  let skills: Skills = { ...DEFAULT_SKILLS };
  if (typeof p["skills"] === "object" && p["skills"] !== null) {
    const s = p["skills"] as Record<string, unknown>;
    for (const a of SKILL_AREAS) if (isLevel(s[a])) skills[a] = s[a] as Skills[typeof a];
  } else if (isLevel(p["skill"])) {
    const lvl = p["skill"] as Skills["woodwork"];
    skills = { woodwork: lvl, plumbing: lvl, electrical: lvl, network: lvl, heating: lvl };
  }
  const materials = Array.isArray(p["materials"])
    ? (p["materials"] as unknown[]).filter(
        (m): m is InventoryItem =>
          typeof m === "object" && m !== null && typeof (m as InventoryItem).name === "string" && typeof (m as InventoryItem).quantity === "number",
      ).map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit ?? "", location: m.location ?? "" }))
    : [];
  return {
    id: p["id"],
    name: p["name"],
    skills,
    tools: typeof p["tools"] === "string" ? p["tools"] : typeof p["inventory"] === "string" ? p["inventory"] : "",
    materials,
    createdAt: typeof p["createdAt"] === "number" ? p["createdAt"] : Date.now(),
  };
}

export function readProfiles(): RepairProfile[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(PROFILES_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.map(toProfile).filter((p): p is RepairProfile => p !== null) : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles: RepairProfile[]) {
  storage()?.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/** Create a new profile, or update the existing one when `id` is given. Returns the saved profile. */
export function saveProfile(input: { id?: string; name: string; skills: Skills; tools: string; materials: InventoryItem[] }): RepairProfile {
  const profiles = readProfiles();
  const existing = input.id ? profiles.find((p) => p.id === input.id) : undefined;
  const data = { name: input.name, skills: input.skills, tools: input.tools, materials: input.materials };
  const profile: RepairProfile = existing ? { ...existing, ...data } : { id: crypto.randomUUID(), createdAt: Date.now(), ...data };
  writeProfiles(existing ? profiles.map((p) => (p.id === profile.id ? profile : p)) : [...profiles, profile]);
  setLastProfileId(profile.id);
  return profile;
}

/** Subtract used material amounts from a stock list; items reaching 0 are removed. */
export function deductFromStock(stock: InventoryItem[], used: { name: string; amount: number }[]): InventoryItem[] {
  const next = stock.map((s) => ({ ...s }));
  for (const u of used) {
    const hit = findStock(u.name, next);
    if (hit) hit.quantity = Math.max(0, Math.round((hit.quantity - u.amount) * 1000) / 1000);
  }
  return next.filter((s) => s.quantity > 0);
}

/** FR-11: deduct consumed materials after a project. */
export function deductMaterials(profileId: string, used: { name: string; amount: number }[]): RepairProfile | null {
  const p = readProfiles().find((x) => x.id === profileId);
  if (!p) return null;
  return saveProfile({ ...p, materials: deductFromStock(p.materials, used) });
}

export function deleteProfile(id: string) {
  writeProfiles(readProfiles().filter((p) => p.id !== id));
  if (getLastProfileId() === id) setLastProfileId(null);
}

export function getLastProfileId(): string | null {
  return storage()?.getItem(LAST_KEY) ?? null;
}

export function setLastProfileId(id: string | null) {
  const s = storage();
  if (!s) return;
  if (id) s.setItem(LAST_KEY, id);
  else s.removeItem(LAST_KEY);
}
