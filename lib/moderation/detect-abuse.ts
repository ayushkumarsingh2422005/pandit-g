export type AbuseSeverity = "none" | "mild" | "severe";

const SEVERE_PATTERNS: RegExp[] = [
  /\bchutiy\w*/i,
  /\bbhenchod\b|\bbhench\w*/i,
  /\bmadarchod\b|\bmaderchod\b|\bmaadarchod\b/i,
  /\bgandu\b|\bgand\w*/i,
  /\blund\b|\bloda\b|\blund\w*/i,
  /\bbtich\b|\bbitch\b|\basshole\b|\bfuck\b|\bshit\b|\bdick\b|\bcunt\b/i,
  /चूत(?:िया|िय|े)|चूतिय/i,
  /भें?चो[दड]|बहन[\s-]?च[oो]द/i,
  /मादर[\s-]?च[oो]द|माँ[\s-]?च[oो]द/i,
  /गां?डू|लंड|लौड़/i,
  /(?:tum|तुम)\s+(?:chutiy|gandu|kutte|kamina|haram)/i,
  /(?:tum|तुम)\s+(?:चूत|गां?ड|हराम|कमीने?|कुत्त)/i,
];

const MILD_PATTERNS: RegExp[] = [
  /\bkutte?\b|\bkamina\b|\bharami\b|\bsala\b|\bsaale\b/i,
  /कुत्त[ेा]|कमीन[ेा]|हराम[ीi]|साल[ae]/i,
  /bot\s+hai|fake\s+hai|bakwas|बकवास|बेवकूफ|bewakoof/i,
  /nahi\s+batana|nahin\s+batana|नहीं?\s+बतान/i,
  /(?:^|\s)(?:fu+ck\s*off|get\s*lost|go\s*away)(?:\s|$)/i,
];

/** Repeated nonsense — very short or meme spam without substance. */
const NONSENSE_PATTERNS: RegExp[] = [
  /^[\s\W\d]{0,8}$/,
  /(?:hurr\s*){2,}|jhinga\s*lala|lorem\s*ipsum/i,
  /^(.)\1{4,}$/,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  return patterns.some((pattern) => pattern.test(normalized));
}

export function detectAbuseSeverity(text: string): AbuseSeverity {
  const normalized = text.trim();
  if (!normalized) return "none";

  if (matchesAny(normalized, SEVERE_PATTERNS)) return "severe";
  if (matchesAny(normalized, MILD_PATTERNS)) return "mild";
  if (normalized.length <= 30 && matchesAny(normalized, NONSENSE_PATTERNS)) {
    return "mild";
  }

  return "none";
}
