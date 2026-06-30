/** Sidereal (Lahiri) Surya Rashi from month/day — when only DOB is available. */
const RASHI_BY_MD: { from: number; name: string }[] = [
  { from: 114, name: "मकर" },
  { from: 213, name: "कुंभ" },
  { from: 314, name: "मीन" },
  { from: 414, name: "मेष" },
  { from: 515, name: "वृषभ" },
  { from: 615, name: "मिथुन" },
  { from: 716, name: "कर्क" },
  { from: 817, name: "सिंह" },
  { from: 917, name: "कन्या" },
  { from: 1018, name: "तुला" },
  { from: 1116, name: "वृश्चिक" },
  { from: 1216, name: "धनु" },
];

function monthDayKey(month: number, day: number): number {
  return month * 100 + day;
}

export function getSuryaRashiFromDate(date: Date): string {
  const key = monthDayKey(date.getMonth() + 1, date.getDate());

  let rashi = "धनु";
  for (const entry of RASHI_BY_MD) {
    if (key >= entry.from) rashi = entry.name;
  }
  return rashi;
}

export function formatRashiLine(rashi: string): string {
  return `आपकी राशि ${rashi} है।`;
}
