// ── Helpers to group dates into weeks (by their Monday) ───────────────

/** Returns the ISO date (YYYY-MM-DD) of the Monday of the week containing `date`. */
export function mondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing a YYYY-MM-DD string. */
export function mondayOfISO(iso: string): string {
  const [y, m, dd] = iso.split("-").map(Number);
  return mondayOf(new Date(Date.UTC(y, m - 1, dd)));
}

/** Adds `n` days to a YYYY-MM-DD string and returns YYYY-MM-DD. */
function addDaysISO(iso: string, n: number): string {
  const [y, m, dd] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, dd));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function fmtDay(iso: string): string {
  const [, m, dd] = iso.split("-").map(Number);
  return `${dd} ${MONTHS_ES[m - 1]}`;
}

/** "5–11 may" style label for the week starting on `mondayISO`. */
export function weekRangeLabel(mondayISO: string): string {
  const sunday = addDaysISO(mondayISO, 6);
  const [, m1] = mondayISO.split("-").map(Number);
  const [, m2, d2] = sunday.split("-").map(Number);
  const startDay = Number(mondayISO.split("-")[2]);
  if (m1 === m2) return `${startDay}–${d2} ${MONTHS_ES[m1 - 1]}`;
  return `${fmtDay(mondayISO)} – ${fmtDay(sunday)}`;
}

/** Compact label for chart axis, e.g. "5 may". */
export function weekShortLabel(mondayISO: string): string {
  return fmtDay(mondayISO);
}

/** Today as YYYY-MM-DD (local, no timezone shift). */
export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
