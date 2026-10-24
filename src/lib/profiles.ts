import { SKILL_LEVELS, type SkillLevel } from "./repair.schema";

export type RepairProfile = {
  id: string;
  name: string;
  skill: SkillLevel;
  inventory: string;
  createdAt: number;
};

const PROFILES_KEY = "daiy.profiles";
const LAST_KEY = "daiy.lastProfile";

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isProfile(x: unknown): x is RepairProfile {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p["id"] === "string" &&
    typeof p["name"] === "string" &&
    typeof p["inventory"] === "string" &&
    typeof p["createdAt"] === "number" &&
    typeof p["skill"] === "string" &&
    (SKILL_LEVELS as readonly string[]).includes(p["skill"])
  );
}

export function readProfiles(): RepairProfile[] {
  const s = storage();
  if (!s) return [];
  try {
    const raw = JSON.parse(s.getItem(PROFILES_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter(isProfile) : [];
  } catch {
    return [];
  }
}

function writeProfiles(profiles: RepairProfile[]) {
  storage()?.setItem(PROFILES_KEY, JSON.stringify(profiles));
}

/** Create a new profile, or update the existing one when `id` is given. Returns the saved profile. */
export function saveProfile(input: { id?: string; name: string; skill: SkillLevel; inventory: string }): RepairProfile {
  const profiles = readProfiles();
  const existing = input.id ? profiles.find((p) => p.id === input.id) : undefined;
  const profile: RepairProfile = existing
    ? { ...existing, name: input.name, skill: input.skill, inventory: input.inventory }
    : { id: crypto.randomUUID(), name: input.name, skill: input.skill, inventory: input.inventory, createdAt: Date.now() };
  writeProfiles(existing ? profiles.map((p) => (p.id === profile.id ? profile : p)) : [...profiles, profile]);
  setLastProfileId(profile.id);
  return profile;
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
