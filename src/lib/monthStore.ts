// Shared "selected month" across pages. The network tabs and the Overview
// read/write this so switching tabs keeps the same month instead of resetting
// to the current calendar month. Persisted in localStorage (single-user
// internal dashboard).
const KEY = 'seeds_selected_month'

export function getStoredMonth(): { year: number; month: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { year?: number; month?: number }
    if (typeof o?.year === 'number' && typeof o?.month === 'number' && o.month >= 1 && o.month <= 12) {
      return { year: o.year, month: o.month }
    }
  } catch { /* ignore */ }
  return null
}

export function setStoredMonth(year: number, month: number): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify({ year, month })) } catch { /* ignore */ }
}
