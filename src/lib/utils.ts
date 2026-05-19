import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export function currentYearMonth(): { year: number; month: number } {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function getQuarter(month: number): number {
  return Math.ceil(month / 3)
}

const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function shortMonthLabel(year: number, month: number): string {
  return `${SHORT_MONTHS[month - 1]} ${year}`
}

export function movingAvg(values: number[], window: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < window - 1) return null
    const slice = values.slice(i - window + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / window
  })
}

export function pctChange(current: number, prev: number): number | null {
  if (!prev) return null
  return ((current - prev) / prev) * 100
}

// Computes ER from a list of posts where each has impressions and interactions.
// Uses average of individual ER values (not aggregate), matching LinkedIn's methodology.
export function computeAvgER(posts: { impressions: number; interactions: number }[]): number {
  const valid = posts.filter(p => p.impressions > 0)
  if (!valid.length) return 0
  const sum = valid.reduce((acc, p) => acc + (p.interactions / p.impressions) * 100, 0)
  return sum / valid.length
}

export function computeAvgERFromDecimal(posts: { er_decimal: number }[]): number {
  if (!posts.length) return 0
  const sum = posts.reduce((acc, p) => acc + p.er_decimal * 100, 0)
  return sum / posts.length
}
