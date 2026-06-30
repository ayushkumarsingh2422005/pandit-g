import { hasBirthDetailsInText } from "./detect-birth-details";

const GREETING_ONLY =
  /^(hi|hello|hey|hii|hlw|namaste|namaskar|नमस्ते|नमस्कार|सुप्रभात|शुभ\s*रात्रि)[\s!.?]*$/i;

const NOT_A_NAME =
  /(?:क्या|कैसे|क्यों|क्यू|why|how|what|shadi|shaadi|विवाह|career|करियर|problem|समस्या|परेशान|नहीं|nahi|बताओ|बताइए|help|पैस|money|upay|उपाय)/i;

const NAME_PREFIX =
  /(?:मेरा\s+नाम|my\s+name\s+is|i\s+am|i'?m|name\s+is|naam\s+hai|नाम\s+है)\s+(.+)/i;

function cleanName(raw: string): string {
  return raw
    .replace(/[।.!,?]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
}

/** True when the message looks like the user sharing their name. */
export function parseClientName(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return null;
  if (GREETING_ONLY.test(trimmed)) return null;
  if (hasBirthDetailsInText(trimmed)) return null;
  if (NOT_A_NAME.test(trimmed)) return null;
  if (/\d{2,}/.test(trimmed)) return null;

  const prefixed = trimmed.match(NAME_PREFIX);
  if (prefixed?.[1]) {
    const name = cleanName(prefixed[1]);
    return name.length >= 2 ? name : null;
  }

  const words = trimmed.split(/\s+/);
  if (words.length > 5) return null;
  if (!/^[\w\u0900-\u097F\s.-]+$/i.test(trimmed)) return null;

  const name = cleanName(trimmed);
  return name.length >= 2 ? name : null;
}
