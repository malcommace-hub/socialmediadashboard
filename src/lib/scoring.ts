// Pure scoring utilities shared between MonthScoreCard and collaborator scoring

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
