'use client'
import { useMemo } from 'react'
import { getOverviewHistory } from '@/lib/queries'
import { formatNumber, monthLabel } from '@/lib/utils'

type HP = Awaited<ReturnType<typeof getOverviewHistory>>[0]

interface MonthScoreCardProps {
  current: HP
  history: HP[]
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

function ratioToScore(ratio: number): number {
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

function dimSubScore(current: number, avg: number): number {
  if (avg <= 0) return 55  // elevated neutral: no usable history to compare against
  return ratioToScore(current / avg)
}

function prior3Avg(history: HP[], current: HP, getValue: (h: HP) => number): number | null {
  const idx = history.findIndex(h => h.year === current.year && h.month === current.month)
  if (idx <= 0) return null
  const slice = history.slice(Math.max(0, idx - 3), idx)
  const vals = slice.map(getValue).filter(v => v > 0)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function engVal(h: HP): number {
  const vals = [h.igER, h.liER].filter(v => v > 0)
  return vals.length ? vals.reduce((a, b) => a + b) / vals.length : 0
}

export function MonthScoreCard({ current, history }: MonthScoreCardProps) {
  const result = useMemo(() => {
    const reach = current.igImpressions + current.liImpressions + current.ttViews
    const engagement = engVal(current)
    const followers = current.igNewFollowers + current.liNewFollowers + current.ttNewFollowers
    const nl = current.newsletterViews
    const posts = (current.igPostCount ?? 0) + (current.liPostCount ?? 0)

    const avgReach = prior3Avg(history, current, h => h.igImpressions + h.liImpressions + h.ttViews)
    const avgEng = prior3Avg(history, current, engVal)
    const avgFoll = prior3Avg(history, current, h => h.igNewFollowers + h.liNewFollowers + h.ttNewFollowers)
    const avgNl = prior3Avg(history, current, h => h.newsletterViews)
    const avgPosts = prior3Avg(history, current, h => (h.igPostCount ?? 0) + (h.liPostCount ?? 0))

    const nlActive = nl > 0 || (avgNl !== null && avgNl > 0)

    const wReach = nlActive ? 0.25 : 0.325
    const wEng = nlActive ? 0.20 : 0.275
    const wFoll = 0.20
    const wNl = nlActive ? 0.15 : 0
    const wPosts = 0.10
    const wTend = 0.10

    const sReach = dimSubScore(reach, avgReach ?? 0)
    const sEng = dimSubScore(engagement, avgEng ?? 0)
    const sFoll = dimSubScore(followers, avgFoll ?? 0)
    const sNl = nlActive ? dimSubScore(nl, avgNl ?? 0) : 55
    const sPosts = dimSubScore(posts, avgPosts ?? 0)

    const tendencyChecks = [
      avgReach !== null ? reach >= avgReach : null,
      avgEng !== null ? engagement >= avgEng : null,
      avgFoll !== null ? followers >= avgFoll : null,
      nlActive && avgNl !== null ? nl >= avgNl : null,
      avgPosts !== null ? posts >= avgPosts : null,
    ].filter((v): v is boolean => v !== null)
    const beating = tendencyChecks.filter(Boolean).length
    const sTend = tendencyChecks.length === 0 ? 55
      : beating === tendencyChecks.length ? 95
      : beating >= 3 ? 75
      : beating === 2 ? 55
      : beating === 1 ? 30
      : 10

    const raw =
      sReach * wReach + sEng * wEng + sFoll * wFoll +
      (nlActive ? sNl * wNl : 0) + sPosts * wPosts + sTend * wTend
    const score = isNaN(raw) ? 0 : Math.round(raw)
    const isOnlyMonth = history.length <= 1

    type Factor = { label: string; pct: number | null }
    const factors: Factor[] = []
    if (avgReach !== null) factors.push({ label: 'Alcance total', pct: avgReach > 0 ? (reach - avgReach) / avgReach * 100 : null })
    if (avgEng !== null) factors.push({ label: 'Engagement', pct: avgEng > 0 ? (engagement - avgEng) / avgEng * 100 : null })
    if (avgFoll !== null) factors.push({ label: 'Nuevos seguidores', pct: avgFoll > 0 ? (followers - avgFoll) / avgFoll * 100 : null })
    if (nlActive && avgNl !== null) factors.push({ label: 'Newsletter', pct: avgNl > 0 ? (nl - avgNl) / avgNl * 100 : null })
    if (avgPosts !== null) factors.push({ label: 'Contenido', pct: avgPosts > 0 ? (posts - avgPosts) / avgPosts * 100 : null })
    if (!nlActive) factors.push({ label: 'Newsletter', pct: null })
    factors.sort((a, b) => (b.pct !== null ? Math.abs(b.pct) : -1) - (a.pct !== null ? Math.abs(a.pct) : -1))

    const dims = [
      { label: 'Alcance total', weight: Math.round(wReach * 100), score: Math.round(sReach), curr: reach, avg: avgReach, pct: false },
      { label: 'Engagement', weight: Math.round(wEng * 100), score: Math.round(sEng), curr: +engagement.toFixed(2), avg: avgEng !== null ? +avgEng.toFixed(2) : null, pct: true },
      { label: 'Audiencia', weight: Math.round(wFoll * 100), score: Math.round(sFoll), curr: followers, avg: avgFoll, pct: false },
      { label: 'Newsletter', weight: Math.round(wNl * 100), score: nlActive ? Math.round(sNl) : null, curr: nl, avg: avgNl, pct: false },
      { label: 'Contenido', weight: Math.round(wPosts * 100), score: Math.round(sPosts), curr: posts, avg: avgPosts, pct: false },
      { label: 'Tendencia', weight: Math.round(wTend * 100), score: Math.round(sTend), curr: null, avg: null, pct: false },
    ]

    const idx = history.findIndex(h => h.year === current.year && h.month === current.month)
    const priorSlice = idx > 0 ? history.slice(Math.max(0, idx - 3), idx) : []
    const histMonths = priorSlice.filter(h => (h.igImpressions + h.liImpressions + h.ttViews) > 0).length

    return { score, isOnlyMonth, factors: factors.slice(0, 4), dims, histMonths }
  }, [current, history])

  const { score, isOnlyMonth, factors, dims, histMonths } = result

  const radius = 40
  const circ = 2 * Math.PI * radius
  const dashOffset = circ - (score / 100) * circ
  const strokeColor = score >= 80 ? '#10b981' : score >= 60 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const textColor = score >= 80 ? 'text-emerald-500' : score >= 60 ? 'text-green-500' : score >= 40 ? 'text-amber-500' : 'text-red-500'

  function fmtVal(v: number | null, pct: boolean) {
    if (v === null) return '—'
    return pct ? v.toFixed(2) + '%' : formatNumber(Math.round(v))
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
      <div className="flex items-center gap-6">
        {/* Circle with hover tooltip */}
        <div className="relative group shrink-0" style={{ width: 100, height: 100 }}>
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
            <circle
              cx="50" cy="50" r={radius} fill="none"
              stroke={strokeColor} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={`text-2xl font-bold leading-none ${textColor}`}>{score}</span>
            <span className="text-[10px] text-gray-400 mt-0.5">score</span>
          </div>
          {/* Hover tooltip */}
          <div className="absolute left-full ml-3 top-0 z-50 hidden group-hover:block w-80 bg-gray-900 text-white text-xs rounded-xl shadow-2xl p-3 pointer-events-none">
            <div className="font-semibold text-gray-200 mb-2">Desglose del score</div>
            {dims.map(d => (
              <div key={d.label} className="flex items-start justify-between mb-1.5">
                <span className="text-gray-400 shrink-0">{d.label} <span className="text-gray-600">({d.weight}%)</span></span>
                <span className="ml-3 text-right whitespace-nowrap">
                  {d.curr !== null && d.avg !== null ? (
                    <>
                      <span className="text-gray-200">{fmtVal(d.curr, d.pct)}</span>
                      <span className="text-gray-500"> (prom: {fmtVal(d.avg, d.pct)})</span>
                      <span className="text-gray-600"> · </span>
                      <span className="font-semibold text-white">{d.score ?? '—'}/100</span>
                    </>
                  ) : (
                    <span className="font-semibold text-white">{d.score ?? '—'}/100</span>
                  )}
                </span>
              </div>
            ))}
            {histMonths < 3 && (
              <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] text-gray-500">
                {histMonths === 0 ? '⚠ Sin historial — score base' : histMonths === 1 ? '↻ Estimado — 1 mes de historial' : '↻ Aproximado — 2 meses de historial'}
              </div>
            )}
          </div>
        </div>

        {/* Factor lines */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {monthLabel(current.year, current.month)} · Score del mes
          </div>
          <div className="space-y-1">
            {factors.map(f => (
              <div key={f.label} className="text-sm">
                {f.pct === null
                  ? <span className="text-gray-400">→ {f.label}: sin datos suficientes</span>
                  : <span className={f.pct >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                      {f.pct >= 0 ? '↑' : '↓'} {f.label} {f.pct >= 0 ? '+' : ''}{f.pct.toFixed(0)}% vs promedio
                    </span>
                }
              </div>
            ))}
          </div>
          {isOnlyMonth && (
            <p className="text-[11px] text-gray-400 mt-2 italic">Score estimado — mejora con más meses cargados</p>
          )}
        </div>
      </div>
    </div>
  )
}
