'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLinkedInStats, getLinkedInHistory, deleteLinkedInPost, upsertLinkedInMonthlyTotals, getLinkedInPostDates } from '@/lib/queries'
import { formatNumber, formatPercent, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import { useMesParam } from '@/hooks/useMesParam'
import type { LinkedInStats } from '@/lib/types'
import { Trash2, ExternalLink, ChevronUp, ChevronDown, Upload, Plus, PencilLine, RefreshCw } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'
import Link from 'next/link'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'
import { clearCache } from '@/lib/queryCache'

// ISO-week Monday index (unique integer per week)
function isoWeekIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z')
  const day = d.getUTCDay() // 0=Sun
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1)) // rewind to Monday
  d.setUTCHours(0, 0, 0, 0)
  return Math.floor(d.getTime() / (7 * 24 * 60 * 60 * 1000))
}

function computeLinkedInStreak(dates: string[]): number {
  if (!dates.length) return 0
  const weeks = new Set(dates.map(isoWeekIndex))
  const sorted = Array.from(weeks).sort((a, b) => b - a)
  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] - 1) streak++
    else break
  }
  return streak
}

function LiFollowerDot(props: {
  cx?: number; cy?: number; value?: number
  payload?: { pctChange?: number | null }
  [k: string]: unknown
}) {
  const { cx, cy, value, payload } = props
  if (!value || !cx || !cy) return <g />
  const pct = payload?.pctChange ?? null
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="#0ea5e9" />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#374151">
        {formatNumber(value)}
      </text>
      {pct !== null && (
        <text x={cx} y={cy - 19} textAnchor="middle" fontSize={9} fill={pct >= 0 ? '#10b981' : '#ef4444'}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </text>
      )}
    </g>
  )
}

function logTickFmt(v: number): string {
  const n = Math.pow(10, v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { desc: string; rawX: number; y: number } }> }) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2 text-xs shadow-lg">
      <div className="font-medium text-gray-800 max-w-[160px] truncate">{pt.desc}</div>
      <div className="text-gray-500 mt-0.5">{formatNumber(pt.rawX)} impr. · {pt.y.toFixed(2)}% ER</div>
    </div>
  )
}

type SortKey = 'impressions' | 'interactions' | 'er'
type SortDir = 'asc' | 'desc'

type HistoryPoint = Awaited<ReturnType<typeof getLinkedInHistory>>[0]

function TrendBadge({ value, prev }: { value: number; prev: number | undefined }) {
  if (!prev) return <span className="text-gray-400 text-xs">—</span>
  const pct = pctChange(value, prev)
  if (pct === null) return <span className="text-gray-400 text-xs">—</span>
  const pos = pct >= 0
  return (
    <span className={`text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

export default function LinkedInPage() {
  const { year, month, setYear, setMonth } = useMesParam()
  const [stats, setStats] = useState<LinkedInStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('impressions')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editMonthly, setEditMonthly] = useState(false)
  const [followers, setFollowers] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [totalImpressions, setTotalImpressions] = useState('')
  const [totalInteractions, setTotalInteractions] = useState('')
  const [avgER, setAvgER] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [postDates, setPostDates] = useState<string[]>([])

  useEffect(() => {
    getLinkedInPostDates().then(setPostDates).catch(() => {})
  }, [])

  const streak = useMemo(() => computeLinkedInStreak(postDates), [postDates])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, hist] = await Promise.all([
        getLinkedInStats({ year, month }),
        getLinkedInHistory(),
      ])
      setStats(data)
      setHistory(hist)
      setFollowers(String(data.monthly?.total_followers ?? ''))
      setNewFollowers(String(data.monthly?.new_followers ?? ''))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = data.monthly as any
      setTotalImpressions(String(m?.total_impressions ?? ''))
      setTotalInteractions(String(m?.total_interactions ?? ''))
      setAvgER(String(m?.avg_er ?? ''))
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos de LinkedIn')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(new Set()) }, [year, month])

  async function saveMonthly() {
    setSaving(true)
    await upsertLinkedInMonthlyTotals({
      year, month,
      total_followers: parseInt(followers) || 0,
      new_followers: parseInt(newFollowers) || 0,
      total_impressions: parseInt(totalImpressions) || undefined,
      total_interactions: parseInt(totalInteractions) || undefined,
      avg_er: avgER !== '' ? parseFloat(avgER) : null,
    })
    await load()
    setEditMonthly(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este post?')) return
    await deleteLinkedInPost(id)
    await load()
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll(items: { id: string }[]) {
    setSelected(s => s.size === items.length && items.length > 0 ? new Set() : new Set(items.map(x => x.id)))
  }
  async function handleDeleteSelected() {
    if (!confirm(`¿Eliminar ${selected.size} elemento(s)? Esta acción no se puede deshacer.`)) return
    const { deleteLinkedInPost: del } = await import('@/lib/queries')
    await Promise.all([...selected].map(id => del(id)))
    setSelected(new Set())
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const posts = stats?.posts ?? []
  const sorted = [...posts].sort((a, b) => {
    let av = 0, bv = 0
    if (sortKey === 'impressions') { av = a.impressions; bv = b.impressions }
    else if (sortKey === 'interactions') { av = a.interactions; bv = b.interactions }
    else if (sortKey === 'er') { av = a.er_decimal; bv = b.er_decimal }
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  const histLast = history.slice(-12)
  const curH = history.find(d => d.year === year && d.month === month)
  const prevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return history.find(d => d.year === pm.y && d.month === pm.m)
  })()
  const qPrevH = (() => {
    let m = month - 3, y = year
    if (m <= 0) { m += 12; y-- }
    return history.find(d => d.year === y && d.month === m)
  })()

  const impChart = useMemo(() => {
    const vals = histLast.map(d => d.impressions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.impressions, ma: ma[i] }))
  }, [histLast])
  const intChart = useMemo(() => {
    const vals = histLast.map(d => d.interactions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.interactions, ma: ma[i] }))
  }, [histLast])
  const liScatterData = useMemo(() => {
    type Pt = { x: number; rawX: number; y: number; desc: string }
    const pts: Pt[] = posts.map(p => ({
      rawX: p.impressions,
      x: Math.log10(Math.max(p.impressions, 1)),
      y: +(p.er_decimal * 100).toFixed(2),
      desc: (p.title || '(sin título)').slice(0, 40),
    }))
    const avgLogX = pts.length ? pts.reduce((a, p) => a + p.x, 0) / pts.length : 0
    const avgY = pts.length ? pts.reduce((a, p) => a + p.y, 0) / pts.length : 0
    const xTicks: number[] = []
    const xDomain: [number, number] = [0, 6]
    if (pts.length) {
      const minLog = Math.floor(Math.min(...pts.map(p => p.x)) - 0.3)
      const maxLog = Math.ceil(Math.max(...pts.map(p => p.x)) + 0.3)
      for (let t = Math.max(0, minLog); t <= maxLog; t++) xTicks.push(t)
      xDomain[0] = Math.max(0, minLog)
      xDomain[1] = maxLog
    }
    return { pts, avgLogX, avgY, xTicks, xDomain }
  }, [posts])
  const erChart = useMemo(() => {
    const vals = histLast.map(d => d.er)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: +d.er.toFixed(2), ma: ma[i] ? +ma[i]!.toFixed(2) : null }))
  }, [histLast])

  const liFollowerChart = useMemo(() => {
    const real = histLast.filter(d => d.totalFollowers > 0)
    return real.map((d, i) => ({
      label: shortMonthLabel(d.year, d.month),
      followers: d.totalFollowers,
      pctChange: i > 0 ? ((d.totalFollowers - real[i - 1].totalFollowers) / real[i - 1].totalFollowers) * 100 : null,
    }))
  }, [histLast])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  // For KPI cards, prefer history-derived value for the selected month
  const kpiImpressions = curH?.impressions ?? stats?.totalImpressions ?? 0
  const kpiInteractions = curH?.interactions ?? stats?.totalInteractions ?? 0
  const kpiER = curH?.er ?? stats?.avgER ?? 0

  const summaryText = useMemo(() => {
    const bestPost = [...posts].sort((a, b) => b.impressions - a.impressions)[0]
    const parts: string[] = [monthLabel(year, month)]
    if (kpiImpressions > 0) parts.push(`${formatNumber(kpiImpressions)} impresiones`)
    if (kpiER > 0) parts.push(`ER ${formatPercent(kpiER)}`)
    if (bestPost) {
      const title = bestPost.title || '(sin título)'
      const truncated = title.length > 40 ? title.slice(0, 40) + '…' : title
      parts.push(`Mejor post: "${truncated}" (${formatNumber(bestPost.impressions)} impr.)`)
    }
    return parts.join(' · ')
  }, [year, month, posts, kpiImpressions, kpiER])

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn — Seeds</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · weareseeders</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { clearCache(); load() }}
            className="presentation-hide p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw size={15} />
          </button>
          <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠ {error}
        </div>
      )}
      {loading ? (
        <>
          <SkeletonCard kpi count={4} />
          <SkeletonCard chart />
          <SkeletonCard chart />
          <SkeletonCard lines={5} />
        </>
      ) : (
        <>
          {/* Month summary */}
          {summaryText && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500 mb-3">
              {summaryText}
            </div>
          )}

          {/* Publication streak badge */}
          {streak >= 2 && (
            <div className="presentation-hide mb-5">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                streak >= 4 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {streak >= 4 ? '🔥' : '📅'} {streak} semanas consecutivas publicando
              </span>
            </div>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Impresiones', val: kpiImpressions, prev: prevH?.impressions, qPrev: qPrevH?.impressions, fmt: formatNumber },
              { label: 'Interacciones', val: kpiInteractions, prev: prevH?.interactions, qPrev: qPrevH?.interactions, fmt: formatNumber },
              { label: 'Engagement %', val: kpiER, prev: prevH?.er, qPrev: qPrevH?.er, fmt: (v: number) => formatPercent(v) },
              { label: 'Nuevos seguidores', val: stats?.monthly?.new_followers ?? 0, prev: prevH?.newFollowers, qPrev: qPrevH?.newFollowers, fmt: formatNumber },
            ].map(({ label, val, prev, qPrev, fmt }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(val)}</div>
                <div className="flex gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={prev} />
                    <span className="ml-1">vs mes ant.</span>
                  </span>
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={qPrev} />
                    <span className="ml-1">vs Q ant.</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Follower evolution */}
          {liFollowerChart.length >= 2 && (
            <div className={chartCardCls + ' mb-4'}>
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Evolución de seguidores</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={liFollowerChart} margin={{ top: 36, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="followers" name="Seguidores" stroke="#0ea5e9" strokeWidth={2}
                    dot={<LiFollowerDot /> as unknown as boolean} activeDot={{ r: 5 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Historical charts — 2×2 grid */}
          {histLast.length >= 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Impresiones */}
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Impresiones</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={impChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Impresiones" fill="#bfdbfe" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#3b82f6" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Interacciones */}
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Interacciones</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={intChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Interacciones" fill="#93c5fd" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#2563eb" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement % */}
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Engagement %</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={erChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="liErGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                    <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" name="ER%" stroke="#3b82f6" fill="url(#liErGrad)" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#3b82f6" strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Scatter: Alcance vs Engagement (replaces Nuevos seguidores) */}
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Alcance vs Engagement</div>
                {liScatterData.pts.length >= 5 ? (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={180}>
                      <ScatterChart margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" dataKey="x" name="Impr." tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={logTickFmt} ticks={liScatterData.xTicks} domain={liScatterData.xDomain} axisLine={false} tickLine={false} />
                        <YAxis type="number" dataKey="y" name="ER%" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                        <ZAxis range={[40, 40]} />
                        <Tooltip content={<ScatterTooltip />} />
                        <ReferenceLine x={liScatterData.avgLogX} stroke="#d1d5db" strokeDasharray="4 2" strokeWidth={1} />
                        <ReferenceLine y={liScatterData.avgY} stroke="#d1d5db" strokeDasharray="4 2" strokeWidth={1} />
                        <Scatter name="Posts" data={liScatterData.pts} fill="#0ea5e9" opacity={0.85} />
                      </ScatterChart>
                    </ResponsiveContainer>
                    <span className="absolute top-5 right-2 text-[9px] font-medium text-gray-400 pointer-events-none">Ideal</span>
                    <span className="absolute top-5 left-10 text-[9px] font-medium text-gray-400 pointer-events-none">Nicho</span>
                    <span className="absolute bottom-1 right-2 text-[9px] font-medium text-gray-400 pointer-events-none">Viral superficial</span>
                    <span className="absolute bottom-1 left-10 text-[9px] font-medium text-gray-400 pointer-events-none">A mejorar</span>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-gray-400 text-center px-4">
                    Cargá al menos 5 posts para ver este análisis
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Monthly data card */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Totales del mes</CardTitle>
              <button onClick={() => setEditMonthly(!editMonthly)} className="presentation-hide flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <PencilLine size={12} /> {editMonthly ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            {editMonthly ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Impresiones totales</label>
                  <input type="number" value={totalImpressions} onChange={e => setTotalImpressions(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Interacciones totales</label>
                  <input type="number" value={totalInteractions} onChange={e => setTotalInteractions(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Engagement % (promedio)</label>
                  <input type="number" step="0.01" value={avgER} onChange={e => setAvgER(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Seguidores totales</label>
                  <input type="number" value={followers} onChange={e => setFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nuevos seguidores</label>
                  <input type="number" value={newFollowers} onChange={e => setNewFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-end">
                  <button onClick={saveMonthly} disabled={saving}
                    className="w-full bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-8">
                <div>
                  <div className="text-2xl font-bold">{formatNumber(kpiImpressions)}</div>
                  <div className="text-xs text-gray-400">Impresiones</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{formatNumber(kpiInteractions)}</div>
                  <div className="text-xs text-gray-400">Interacciones</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{kpiER > 0 ? formatPercent(kpiER) : '—'}</div>
                  <div className="text-xs text-gray-400">Engagement %</div>
                </div>
                <div className="border-l border-gray-100 pl-8">
                  <div className="text-2xl font-bold">{formatNumber(stats?.monthly?.total_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Seguidores totales</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">+{formatNumber(stats?.monthly?.new_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Nuevos este mes</div>
                </div>
              </div>
            )}
          </Card>

          {/* Posts table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Contenidos del mes ({posts.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="flex gap-1">
                  {(['impressions', 'er', 'interactions'] as SortKey[]).map(k => (
                    <button key={k} onClick={() => { setSortKey(k); setSortDir('desc') }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${sortKey === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {k === 'impressions' ? 'Por impresiones' : k === 'er' ? 'Por ER' : 'Por interacciones'}
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <button onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400">
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
                <Link href="/dashboard/upload"
                  className="presentation-hide flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-blue-500">
                  <Upload size={13} /> Subir CSV LinkedIn
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400 w-8">#</th>
                    <th className="w-8 py-2 px-2">
                      <input type="checkbox" className="rounded"
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sorted.length }}
                        checked={sorted.length > 0 && selected.size === sorted.length}
                        onChange={() => toggleSelectAll(sorted)} />
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('impressions')}>
                      <span className="flex items-center justify-end gap-1">Impresiones <SortIcon k="impressions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('interactions')}>
                      <span className="flex items-center justify-end gap-1">Interacc. <SortIcon k="interactions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('er')}>
                      <span className="flex items-center justify-end gap-1">ER <SortIcon k="er" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Enlace</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                      No hay posts. <Link href="/dashboard/upload" className="text-blue-500 underline">Subí el CSV de LinkedIn</Link>.
                    </td></tr>
                  )}
                  {sorted.map((post, idx) => (
                    <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2 text-xs text-gray-400 font-medium">#{idx + 1}</td>
                      <td className="py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        <div className="flex items-center gap-1">
                          {idx === 0 && sorted.length > 3 && (
                            <span className="text-xs font-semibold text-amber-500 whitespace-nowrap">⭐ Top</span>
                          )}
                          {post.permalink
                            ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600 truncate">{post.title || '(sin título)'}</a>
                            : <span className="text-gray-700 truncate">{post.title || '(sin título)'}</span>
                          }
                        </div>
                        {post.is_manual && <Badge variant="manual">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatNumber(post.impressions)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.interactions)}</td>
                      <td className="py-2 px-2 text-right font-medium text-blue-600">{formatPercent(post.er_decimal * 100)}</td>
                      <td className="py-2 px-2 text-right">
                        {post.permalink
                          ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex items-center gap-0.5 text-xs font-medium">Ver <ExternalLink size={11} /></a>
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDelete(post.id)} className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
