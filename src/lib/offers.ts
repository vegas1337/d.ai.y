import type { MATERIAL_CATEGORIES } from "./repair.schema";

type Category = (typeof MATERIAL_CATEGORIES)[number];

export type Offer = {
  id: string;
  title: string;
  category: Category;
  keywords: string[];
  condition: "new" | "used – like new" | "used – good" | "used – fair";
  price: number;
  seller: string;
  dimensions: string;
  material: string;
  url: string;
  updated: string;
};

/** Sample data only — no real retailer integration yet (FR-04). */
export const SAMPLE_OFFERS: Offer[] = [
  { id: "n1", title: "Ball-bearing drawer slides 450 mm (pair)", category: "hardware", keywords: ["slide", "runner", "drawer", "rail"], condition: "new", price: 14.9, seller: "DIY Store (sample)", dimensions: "450 mm, 35 kg load", material: "Zinc-plated steel", url: "https://example.com/new/slides", updated: "2026-10-20" },
  { id: "u1", title: "Drawer slides 450 mm, from dismantled kitchen", category: "hardware", keywords: ["slide", "runner", "drawer", "rail"], condition: "used – good", price: 5, seller: "Classifieds (sample)", dimensions: "450 mm (seller info)", material: "Steel", url: "https://example.com/used/slides", updated: "2026-10-12" },
  { id: "n2", title: "Wood screws assortment 3–5 mm (200 pcs)", category: "hardware", keywords: ["screw", "fastener", "bolt", "hinge", "handle"], condition: "new", price: 8.5, seller: "DIY Store (sample)", dimensions: "3×16 to 5×50 mm", material: "Steel", url: "https://example.com/new/screws", updated: "2026-10-21" },
  { id: "u2", title: "Mixed screws jar from repair café", category: "hardware", keywords: ["screw", "fastener", "bolt"], condition: "used – fair", price: 1, seller: "Repair Café (sample)", dimensions: "Mixed, unsorted", material: "Steel", url: "https://example.com/used/screws", updated: "2026-09-30" },
  { id: "n3", title: "Concealed cabinet hinge 35 mm (2 pcs)", category: "hardware", keywords: ["hinge", "door", "cabinet"], condition: "new", price: 9.9, seller: "DIY Store (sample)", dimensions: "35 mm cup, 110°", material: "Steel", url: "https://example.com/new/hinge", updated: "2026-10-19" },
  { id: "u3", title: "Cabinet hinges 35 mm, set of 4", category: "hardware", keywords: ["hinge", "door", "cabinet"], condition: "used – like new", price: 4, seller: "Classifieds (sample)", dimensions: "35 mm cup (seller info)", material: "Steel", url: "https://example.com/used/hinge", updated: "2026-10-08" },
  { id: "n4", title: "Wood glue D3, 250 g", category: "adhesive", keywords: ["glue", "adhesive", "wood glue"], condition: "new", price: 6.5, seller: "DIY Store (sample)", dimensions: "250 g", material: "PVAc", url: "https://example.com/new/glue", updated: "2026-10-21" },
  { id: "u4", title: "Wood glue, half-full bottle", category: "adhesive", keywords: ["glue", "adhesive"], condition: "used – good", price: 1.5, seller: "Neighbourhood swap (sample)", dimensions: "~120 g left", material: "PVAc", url: "https://example.com/used/glue", updated: "2026-10-15" },
  { id: "n5", title: "Paraffin wax / furniture lubricant stick", category: "lubricant", keywords: ["wax", "lubricant", "candle", "soap", "silicone"], condition: "new", price: 4.2, seller: "DIY Store (sample)", dimensions: "40 g", material: "Paraffin", url: "https://example.com/new/wax", updated: "2026-10-18" },
  { id: "n6", title: "Silicone spray 400 ml", category: "lubricant", keywords: ["spray", "silicone", "lubricant", "oil"], condition: "new", price: 7.9, seller: "DIY Store (sample)", dimensions: "400 ml", material: "Silicone", url: "https://example.com/new/spray", updated: "2026-10-18" },
  { id: "n7", title: "Pine strip 20×20 mm, 1 m", category: "wood", keywords: ["wood", "strip", "batten", "dowel", "board"], condition: "new", price: 3.1, seller: "DIY Store (sample)", dimensions: "20×20×1000 mm", material: "Pine", url: "https://example.com/new/wood", updated: "2026-10-17" },
  { id: "u7", title: "Offcuts box (pine & beech)", category: "wood", keywords: ["wood", "strip", "offcut", "board", "dowel"], condition: "used – good", price: 2, seller: "Carpentry workshop (sample)", dimensions: "Various, up to 60 cm", material: "Pine / beech", url: "https://example.com/used/wood", updated: "2026-10-05" },
  { id: "n8", title: "Tap washer & O-ring set", category: "plumbing", keywords: ["washer", "o-ring", "seal", "tap", "faucet", "gasket"], condition: "new", price: 5.9, seller: "DIY Store (sample)", dimensions: "12 sizes, 10–30 mm", material: "Rubber / nitrile", url: "https://example.com/new/washers", updated: "2026-10-20" },
  { id: "n9", title: "Iron-on repair patches (6 pcs)", category: "textile", keywords: ["patch", "fabric", "textile", "thread", "zip"], condition: "new", price: 4.5, seller: "Haberdashery (sample)", dimensions: "8×10 cm", material: "Cotton", url: "https://example.com/new/patch", updated: "2026-10-16" },
  { id: "u9", title: "Fabric remnants bag", category: "textile", keywords: ["fabric", "patch", "textile"], condition: "used – good", price: 2, seller: "Second-hand shop (sample)", dimensions: "Mixed pieces", material: "Mixed", url: "https://example.com/used/fabric", updated: "2026-10-02" },
];

export function matchOffers(name: string, category: Category): Offer[] {
  const n = name.toLowerCase();
  const byKeyword = SAMPLE_OFFERS.filter((o) => o.keywords.some((k) => n.includes(k)));
  const pool = byKeyword.length ? byKeyword : SAMPLE_OFFERS.filter((o) => o.category === category && category !== "other");
  return [...pool].sort((a, b) => Number(a.condition === "new") - Number(b.condition === "new")).slice(0, 3);
}
