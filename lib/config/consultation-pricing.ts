/**
 * Single source of truth for consultation pricing & session duration.
 * Set CONSULTATION_PRICE_INR and CONSULTATION_DURATION_MINUTES in env.
 * CONSULTATION_PRICE_PAISE is supported as override (must match INR × 100).
 */

function readPriceInr(): number {
  const fromInr = Number(process.env.CONSULTATION_PRICE_INR);
  if (Number.isFinite(fromInr) && fromInr > 0) return fromInr;

  const fromPublic = Number(process.env.NEXT_PUBLIC_CONSULTATION_PRICE_INR);
  if (Number.isFinite(fromPublic) && fromPublic > 0) return fromPublic;

  const fromPaise = Number(process.env.CONSULTATION_PRICE_PAISE);
  if (Number.isFinite(fromPaise) && fromPaise > 0) return fromPaise / 100;

  return 151;
}

function readSessionMinutes(): number {
  const fromEnv = Number(process.env.CONSULTATION_DURATION_MINUTES);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;

  const fromPublic = Number(
    process.env.NEXT_PUBLIC_CONSULTATION_DURATION_MINUTES,
  );
  if (Number.isFinite(fromPublic) && fromPublic > 0) return fromPublic;

  return 15;
}

export type ConsultationPricing = {
  priceInr: number;
  pricePaise: number;
  priceInrFormatted: string;
  sessionMinutes: number;
  /** e.g. "₹151 for 15 min WhatsApp session" */
  offerLineEn: string;
  /** e.g. "₹151 — 15 मिनट का WhatsApp परामर्श" */
  offerLineHi: string;
};

let cached: ConsultationPricing | null = null;

export function getConsultationPricing(): ConsultationPricing {
  if (cached) return cached;

  const priceInr = readPriceInr();
  const pricePaise =
    Number(process.env.CONSULTATION_PRICE_PAISE) > 0
      ? Number(process.env.CONSULTATION_PRICE_PAISE)
      : Math.round(priceInr * 100);
  const sessionMinutes = readSessionMinutes();
  const priceInrFormatted = `₹${priceInr}`;

  cached = {
    priceInr,
    pricePaise,
    priceInrFormatted,
    sessionMinutes,
    offerLineEn: `${priceInrFormatted} for ${sessionMinutes} min WhatsApp consultation`,
    offerLineHi: `${priceInrFormatted} — ${sessionMinutes} मिनट का WhatsApp परामर्श`,
  };

  return cached;
}

/** For client components — reads NEXT_PUBLIC_* (mirrored from server env in next.config). */
export function getPublicConsultationPricing(): Pick<
  ConsultationPricing,
  "priceInr" | "priceInrFormatted" | "sessionMinutes" | "offerLineEn" | "offerLineHi"
> {
  const priceInr =
    Number(process.env.NEXT_PUBLIC_CONSULTATION_PRICE_INR) > 0
      ? Number(process.env.NEXT_PUBLIC_CONSULTATION_PRICE_INR)
      : 151;
  const sessionMinutes =
    Number(process.env.NEXT_PUBLIC_CONSULTATION_DURATION_MINUTES) > 0
      ? Number(process.env.NEXT_PUBLIC_CONSULTATION_DURATION_MINUTES)
      : 15;
  const priceInrFormatted = `₹${priceInr}`;

  return {
    priceInr,
    priceInrFormatted,
    sessionMinutes,
    offerLineEn: `${priceInrFormatted} for ${sessionMinutes} min WhatsApp consultation`,
    offerLineHi: `${priceInrFormatted} — ${sessionMinutes} मिनट का WhatsApp परामर्श`,
  };
}
