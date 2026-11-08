import type { Partner } from "./types";

export const UNKNOWN_ID = "unknown";

export const UNKNOWN_PARTNER: Partner = {
  id: UNKNOWN_ID,
  name: "Unknown Partner",
  code: "???",
  aliases: ["needs review"],
  patterns: [],
  colors: { solid: "#8a8271", tint: "#f2ecdd", deep: "#5f5845" },
};

/**
 * Indian delivery partners seen on Meesho shipping labels.
 * Patterns are tested in order, so more specific names come first.
 */
export const PARTNERS: Partner[] = [
  {
    id: "xpressbees",
    name: "XpressBees",
    code: "XBE",
    aliases: ["XBEES", "Xpress Bees", "XB Express"],
    patterns: [/xpress\s*bees/i, /\bxbees\b/i, /\bxpressbees\b/i],
    colors: { solid: "#c96a00", tint: "#f9edda", deep: "#7d4302" },
  },
  {
    id: "shadowfax",
    name: "Shadowfax",
    code: "SFX",
    aliases: ["Shadow Fax", "SFX"],
    patterns: [/shadow\s*fax/i, /\bsfx\b/i, /\bshdfx\b/i],
    colors: { solid: "#d9480f", tint: "#fbe8de", deep: "#8a2f08" },
  },
  {
    id: "ecomexpress",
    name: "Ecom Express",
    code: "EEX",
    aliases: ["EcomExpress", "EDEX", "Ecom"],
    patterns: [/ecom\s*express/i, /\becomx\b/i, /\bedex\b/i],
    colors: { solid: "#0d8f83", tint: "#e0f2ef", deep: "#0a5a52" },
  },
  {
    id: "delhivery",
    name: "Delhivery",
    code: "DEL",
    aliases: ["Delhivery Direct", "DLVY"],
    patterns: [/delhivery/i, /\bdlvy\b/i],
    colors: { solid: "#c92a2a", tint: "#f9e3e1", deep: "#7d1a17" },
  },
  {
    id: "bluedart",
    name: "Blue Dart",
    code: "BDA",
    aliases: ["BlueDart", "Blue Dart Express"],
    patterns: [/blue\s*dart/i],
    colors: { solid: "#1e56c8", tint: "#e3eafa", deep: "#163f92" },
  },
  {
    id: "dtdc",
    name: "DTDC",
    code: "DTD",
    aliases: ["DTDC Express", "DTDC Lite"],
    patterns: [/\bdtdc\b/i],
    colors: { solid: "#b02467", tint: "#f8e3ee", deep: "#731843" },
  },
  {
    id: "ekart",
    name: "Ekart",
    code: "EKT",
    aliases: ["Ekart Logistics", "Flipkart Ekart"],
    patterns: [/\bekart\b/i],
    colors: { solid: "#5f8f0e", tint: "#ebf3dc", deep: "#3f610a" },
  },
  {
    id: "indiapost",
    name: "India Post",
    code: "INP",
    aliases: ["Speed Post", "IndiaPost", "Dak"],
    patterns: [/india\s*post/i, /speed\s*post/i, /\bindiapost\b/i],
    colors: { solid: "#9a3d12", tint: "#f5e7dd", deep: "#63280c" },
  },
  {
    id: "gati",
    name: "Gati",
    code: "GTI",
    aliases: ["Gati Kintetsu", "GKE"],
    patterns: [/\bgati\b/i, /\bgke\b/i],
    colors: { solid: "#6d3bd4", tint: "#ece5fa", deep: "#47268a" },
  },
  {
    id: "mahindra",
    name: "Mahindra Logistics",
    code: "MHL",
    aliases: ["Mahindra", "MLL"],
    patterns: [/mahindra(\s*logistics)?/i],
    colors: { solid: "#0e7db5", tint: "#e0eff7", deep: "#0a5075" },
  },
  {
    id: "safexpress",
    name: "Safexpress",
    code: "SFE",
    aliases: ["Safe Express"],
    patterns: [/safe\s*express/i],
    colors: { solid: "#4a5568", tint: "#e9ecf1", deep: "#2f3846" },
  },
  {
    id: "pidge",
    name: "Pidge",
    code: "PDG",
    aliases: ["Pidge Logistics"],
    patterns: [/\bpidge\b/i],
    colors: { solid: "#c2255c", tint: "#f9e3ea", deep: "#7d173b" },
  },
  {
    id: "wowexpress",
    name: "Wow Express",
    code: "WOW",
    aliases: ["WOW Express"],
    patterns: [/wow\s*express/i],
    colors: { solid: "#0b8a5d", tint: "#dff1e9", deep: "#075c3e" },
  },
  {
    id: "shiprocket",
    name: "Shiprocket",
    code: "SRT",
    aliases: ["Shiprocket X"],
    patterns: [/ship\s*rocket/i],
    colors: { solid: "#4149c9", tint: "#e6e7f9", deep: "#2b3088" },
  },
  {
    id: "amazon",
    name: "Amazon",
    code: "AMZ",
    aliases: ["Amazon Shipping", "ATS"],
    patterns: [/\bamazon\b/i],
    colors: { solid: "#232f3e", tint: "#e5e8ec", deep: "#232f3e" },
  },
  {
    id: "mgajjar",
    name: "M Gajjar",
    code: "MGJ",
    aliases: ["Gajjar Parcel"],
    patterns: [/\bm\s*gajjar\b/i, /\bgajjar\b/i],
    colors: { solid: "#177a3d", tint: "#e2f0e7", deep: "#0f5129" },
  },
  {
    // "Valmo" and "ValmoPlus" are the same courier — both names bin together.
    id: "valmo",
    name: "Valmo",
    code: "VLM",
    aliases: ["ValmoPlus", "Valmo Plus", "Valmo+"],
    patterns: [/valmo\s*plus/i, /\bvalmo\b/i],
    colors: { solid: "#8a2fc9", tint: "#f1e6fa", deep: "#5a1e85" },
  },
];

export function getPartner(id: string | null | undefined): Partner {
  if (!id || id === UNKNOWN_ID) return UNKNOWN_PARTNER;
  return PARTNERS.find((p) => p.id === id) ?? UNKNOWN_PARTNER;
}

/** Detect partner from the label's text; fall back to the file name. */
export function detectPartner(text: string, fileName = ""): string | null {
  const fromText = matchIn(text);
  if (fromText) return fromText;
  return matchIn(fileName);
}

function matchIn(hay: string): string | null {
  if (!hay) return null;
  const flat = hay.replace(/\s+/g, " ");
  for (const p of PARTNERS) {
    for (const re of p.patterns) {
      if (re.test(flat)) return p.id;
    }
  }
  return null;
}

/** Pull an AWB / waybill number out of raw label text (best effort). */
export function extractAwb(text: string): string {
  const t = text.replace(/\s+/g, " ");
  const labeled = t.match(
    /(?:AWB|Airway\s*Bill|Waybill|Docket|Tracking|Consignment|LR\s*No)\s*(?:No|Number|Num|#)?\s*[:.\-#]?\s*([A-Z]{0,4}[- ]?\d{8,16})/i
  );
  if (labeled) return labeled[1].trim().replace(/\s+/g, "");
  const bare = t.match(/\b(\d{10,14})\b/);
  return bare ? bare[1] : "";
}

/** Pull a Meesho order number out of raw label text (best effort). */
export function extractOrderId(text: string): string {
  const t = text.replace(/\s+/g, " ");
  const m = t.match(
    /Order\s*(?:No|Number|ID|#)?\s*[:.\-#]?\s*#?\s*([A-Z0-9][A-Z0-9\-]{5,23})/i
  );
  return m ? m[1] : "";
}
