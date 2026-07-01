// Pure scoring utilities shared between MonthScoreCard and collaborator scoring

// ─── Relative (trend) scoring ─────────────────────────────────────────────
// Grades a value against a reference average (recent trend / full history).
// Rewards growth, penalises decline.
export function ratioToScore(ratio: number): number {
  if (ratio <= 0) return 5
  if (ratio >= 1) {
    // ratio 1.0 → 50, 1.5 → 70, 2.0 → 84, 3.0 → 97, 5.0 → 100
    // tanh S-curve anchored at ratio=1 (score 50) and ratio=1.5 (score 70)
    return Math.min(100, Math.round(50 + 50 * Math.tanh(Math.log(7 / 3) * (ratio - 1))))
  } else {
    // ratio 0.9 → 46, 0.7 → 37, 0.5 → 28, 0.3 → 18, 0.1 → 7
    // power curve with soft floor — k=0.84 amortises the penalty vs linear
    return Math.max(5, Math.round(50 * Math.pow(ratio, 0.84)))
  }
}

export function blendedScore(ratio: number): number {
  if (ratio >= 1.12) return ratioToScore(ratio)
  if (ratio >= 0.88) return 68
  return ratioToScore(ratio)
}

// ─── Absolute (quality) scoring ────────────────────────────────────────────
// Grades a value against the account's historical best (benchmark) for that
// metric, independent of trend. A month that matches your best-ever month
// scores ABS_TOP; weaker months scale down. This rewards objectively strong
// months even when they don't beat the previous month (e.g. two back-to-back
// record months should BOTH score high, not just the first one).
//
// ABS_TOP / ABS_WEIGHT are the calibration knobs: they're tuned so the
// historical-best month lands around ~89 overall. Raise ABS_TOP/ABS_WEIGHT to
// make strong months score higher; lower them to compress the top.
export const ABS_TOP = 99
export const ABS_WEIGHT = 0.74

export function absoluteScore(value: number, benchmark: number | null): number {
  if (benchmark == null || benchmark <= 0) return 55
  const r = value / benchmark
  if (r <= 0) return 5
  // r=1 → ABS_TOP; near-linear falloff below, small headroom above for records.
  return Math.max(5, Math.min(100, Math.round(ABS_TOP * Math.pow(Math.min(r, 1.1), 1.05))))
}
