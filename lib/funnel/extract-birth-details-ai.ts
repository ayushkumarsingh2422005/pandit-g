import { createXai } from "@ai-sdk/xai";
import { generateText } from "ai";
import { getXaiConfig } from "@/lib/ai/config";

export type UniversalBirthDetails = {
  date?: string;
  time?: string;
  place?: string;
};

function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cleanField(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned || cleaned.toLowerCase() === "null") return undefined;
  return cleaned.slice(0, 160);
}

/**
 * Semantic fallback for the countless ways people send birth details.
 * It reads user messages across turns, resolves labels/order, and returns
 * only fields explicitly present—never guesses missing details.
 */
export async function extractBirthDetailsUniversally(
  history: { role: string; content: string }[],
  currentText: string,
): Promise<UniversalBirthDetails | null> {
  const userMessages = history
    .filter((entry) => entry.role === "user")
    .map((entry) => entry.content.trim())
    .filter(Boolean)
    .slice(-20);

  if (currentText.trim()) userMessages.push(currentText.trim());
  if (userMessages.length === 0) return null;

  const transcript = userMessages
    .map((content, index) => `USER ${index + 1}: ${content}`)
    .join("\n---\n");

  const { apiKey, model } = getXaiConfig();
  const provider = createXai({ apiKey });

  const { text } = await generateText({
    model: provider.responses(model),
    temperature: 0,
    maxRetries: 1,
    system: `Extract Indian birth details from a WhatsApp transcript.

Users may send fields:
- in any order or across many messages
- with no labels, wrong labels, spelling mistakes, Hindi/Hinglish
- using any reasonable date/time format or Hindi digits
- as city, village, district, state, or combinations

Rules:
- Return JSON only: {"date": string|null, "time": string|null, "place": string|null}
- Normalize date to YYYY-MM-DD only when the actual date is clear.
- Normalize time to HH:MM (24-hour) when clear; preserve AM/PM meaning.
- Keep place as a concise readable place string.
- A value with THREE numeric date parts, such as 12:02:1996, is a DATE—not a time.
- A value with TWO clock parts, such as 12:15, is a TIME.
- Short replies like "G", "hmm", "bolo", "haanji", greetings, or concerns are NEVER places.
- Do not infer or invent any missing field.
- If date is ambiguous between DD/MM and MM/DD, use Indian DD/MM convention.
- If a user corrects a field later, use the latest correction.`,
    prompt: transcript,
  });

  const parsed = parseJsonObject(text);
  if (!parsed) return null;

  const details: UniversalBirthDetails = {
    date: cleanField(parsed.date),
    time: cleanField(parsed.time),
    place: cleanField(parsed.place),
  };

  return details.date || details.time || details.place ? details : null;
}

export function universalMissingFields(
  details: UniversalBirthDetails,
): string[] {
  const missing: string[] = [];
  if (!details.date) missing.push("जन्म तिथि");
  if (!details.time) missing.push("जन्म समय");
  if (!details.place) missing.push("जन्म स्थान");
  return missing;
}

export function universalBirthContext(
  details: UniversalBirthDetails,
): string {
  return [
    details.date ? `DOB: ${details.date}` : "",
    details.time ? `Birth time: ${details.time}` : "",
    details.place ? `Birth place: ${details.place}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
