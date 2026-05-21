'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getTikTokStats, getTikTokHistory, deleteTikTokVideo, upsertTikTokMonthly,
  addTikTokVideoManual, getYouTubeMonthly, upsertYouTubeMonthly, getYouTubeHistory,
} from '@/lib/queries'
import { formatNumber, monthLabel, shortMonthLabel, movingAvg, pctChange, formatPercent } from '@/lib/utils'
import { useMesParam } from '@/hooks/useMesParam'
import type { TikTokStats } from '@/lib/types'
import { Trash2, ExternalLink, Plus, ChevronUp, ChevronDown, Upload } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area,
} from 'recharts'
import Link from 'next/link'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'

type HistoryPoint = Awaited<ReturnType<typeof getTikTokHistory>>[0]
type YTHistoryPoint = Awaited<ReturnType<typeof getYouTubeHistory>>[0]

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

function TtFollowerDot(props: {
  cx?: number; cy?: number; value?: number
  payload?: { pctChange?: number | null }
  [k: string]: unknown
}) {
  const { cx, cy, value, payload } = props
  if (!value || !cx || !cy) return <g />
  const pct = payload?.pctChange ?? null
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="#374151" />
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

type SortKey = 'views' | 'likes' | 'comments' | 'shares'
type SortDir = 'asc' | 'desc'

export default function TikTokPage() {
  const { year, month, setYear, setMonth } = useMesParam()
  const [stats, setStats] = useState<TikTokStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [ytHistory, setYtHistory] = useState<YTHistoryPoint[]>([])
  const [ytViews, setYtViews] = useState('')
  const [ytSaved, setYtSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newVideo, setNewVideo] = useState({ title: '', video_date: '', views: '', likes: '', comments: '', shares: '', permalink: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, hist, ytHist, ytMonthly] = await Promise.all([
        getTikTokStats({ year, month }),
        getTikTokHistory(),
        getYouTubeHistory(),
        getYouTubeMonthly({ year, month }),
      ])
      setStats(data)
      setHistory(hist)
      setYtHistory(ytHist)
      setYtViews(String(ytMonthly.data?.shorts_views ?? ''))
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos de TikTok')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(new Set()) }, [year, month])

  async function saveYouTube() {
    setSaving(true)
    await upsertYouTubeMonthly({ year, month, shorts_views: parseInt(ytViews) || 0 })
    await load()
    setYtSaved(true)
    setTimeout(() => setYtSaved(false), 2000)
    setSaving(false)
  }

  async function saveVideo() {
    if (!newVideo.title && !newVideo.permalink) return
    setSaving(true)
    await addTikTokVideoManual({
      year, month,
      title: newVideo.title || null,
      video_date: newVideo.video_date || null,
      views: parseInt(newVideo.views) || 0,
      likes: parseInt(newVideo.likes) || 0,
      comments: parseInt(newVideo.comments) || 0,
      shares: parseInt(newVideo.shares) || 0,
      permalink: newVideo.permalink || null,
      is_manual: true,
    })
    setNewVideo({ title: '', video_date: '', views: '', likes: '', comments: '', shares: '', permalink: '' })
    setShowAddForm(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este video?')) return
    await deleteTikTokVideo(id)
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
    await Promise.all([...selected].map(id => deleteTikTokVideo(id)))
    setSelected(new Set())
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const histLast = history.slice(-12)
  const ytHistLast = ytHistory.slice(-12)

  const curH = history.find(d => d.year === year && d.month === month)
  const prevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return history.find(d => d.year === pm.y && d.month === pm.m)
  })()
  const ytCurH = ytHistory.find(d => d.year === year && d.month === month)
  const ytPrevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return ytHistory.find(d => d.year === pm.y && d.month === pm.m)
  })()

  const viewsChart = useMemo(() => {
    const vals = histLast.map(d => d.views)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.views, ma: ma[i] }))
  }, [histLast])
  const intChart = useMemo(() => {
    const vals = histLast.map(d => d.interactions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.interactions, ma: ma[i] }))
  }, [histLast])
  const follChart = useMemo(() => {
    const vals = histLast.map(d => d.newFollowers)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.newFollowers, ma: ma[i] }))
  }, [histLast])
  const erChart = useMemo(() => {
    const vals = histLast.map(d => d.er)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: +d.er.toFixed(2), ma: ma[i] ? +ma[i]!.toFixed(2) : null }))
  }, [histLast])
  const ytChart = useMemo(() => {
    const vals = ytHistLast.map(d => d.views)
    const ma = movingAvg(vals, 3)
    return ytHistLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.views, ma: ma[i] }))
  }, [ytHistLast])

  const summaryText = useMemo(() => {
    const total = stats?.totalViews ?? 0
    const bestVideo = [...(stats?.videos ?? [])].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
    const parts: string[] = [monthLabel(year, month)]
    if (total > 0) {
      parts.push(`${formatNumber(total)} views`)
      if (prevH?.views) {
        const pct = pctChange(total, prevH.views)
        if (pct !== null) parts.push(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs mes ant.`)
      }
    }
    if (bestVideo) {
      const title = bestVideo.title || '(sin título)'
      const truncated = title.length > 40 ? title.slice(0, 40) + '…' : title
      parts.push(`Top video: "${truncated}" (${formatNumber(bestVideo.views ?? 0)} views)`)
    }
    return parts.join(' · ')
  }, [year, month, stats, prevH])

  const videos = stats?.videos ?? []
  const sorted = [...videos].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  const ttFollowerChart = useMemo(() => {
    const real = histLast.filter(d => d.totalFollowers > 0)
    return real.map((d, i) => ({
      label: shortMonthLabel(d.year, d.month),
      followers: d.totalFollowers,
      pctChange: i > 0 ? ((d.totalFollowers - real[i - 1].totalFollowers) / real[i - 1].totalFollowers) * 100 : null,
    }))
  }, [histLast])

  const originBreakdown = useMemo(() => {
    const csv = videos.filter(v => !v.is_manual)
    const manual = videos.filter(v => v.is_manual)
    if (!csv.length || !manual.length) return null
    const avgViews = (vs: typeof videos) => vs.length ? vs.reduce((a, v) => a + (v.views ?? 0), 0) / vs.length : 0
    const avgInt = (vs: typeof videos) => vs.length ? vs.reduce((a, v) => a + (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0), 0) / vs.length : 0
    return [
      { origen: 'CSV (exportado)', count: csv.length, avgViews: avgViews(csv), avgInt: avgInt(csv) },
      { origen: 'Manual', count: manual.length, avgViews: avgViews(manual), avgInt: avgInt(manual) },
    ]
  }, [videos])

  const freqBadge = useMemo(() => {
    const withDate = videos.filter(v => v.video_date)
    if (withDate.length >= 3) {
      const weekCounts: Record<number, number> = {}
      for (const v of withDate) {
        const day = new Date(v.video_date! + 'T12:00:00Z').getUTCDate()
        const wk = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5
        weekCounts[wk] = (weekCounts[wk] ?? 0) + 1
      }
      const counts = Object.values(weekCounts)
      return counts.reduce((a, b) => a + b, 0) / counts.length
    }
    if (!videos.length) return null
    return videos.length / 4.33
  }, [videos])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  const ytCurrentViews = ytCurH?.views ?? 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TikTok & Shorts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · @weareseeds_</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠ {error}
        </div>
      )}
      {loading ? (
        <>
          <SkeletonCard kpi count={3} />
          <SkeletonCard chart />
          <SkeletonCard chart />
          <SkeletonCard lines={5} />
        </>
      ) : (
        <>
          {/* ── TikTok ─────────────────────────────── */}
          <div className="flex items-center gap-2 mb-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">TikTok</div>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Month summary */}
          {summaryText && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500 mb-3">
              {summaryText}
            </div>
          )}
          {freqBadge !== null && (
            <div className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold mb-5 presentation-hide ${
              freqBadge >= 3 ? 'bg-emerald-100 text-emerald-700' :
              freqBadge >= 1 ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              🎵 ~{freqBadge.toFixed(1)} videos/sem
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Impresiones', val: stats?.totalViews ?? 0, prev: prevH?.views },
              { label: 'Interacciones', val: stats?.totalInteractions ?? 0, prev: prevH?.interactions },
              { label: 'Nuevos seguidores', val: stats?.monthly?.new_followers ?? 0, prev: prevH?.newFollowers },
            ].map(({ label, val, prev }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{formatNumber(val)}</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={prev} />
                    <span className="ml-1">vs mes ant.</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Follower evolution */}
          {ttFollowerChart.length >= 2 && (
            <div className={chartCardCls + ' mb-4'}>
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Evolución de seguidores</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={ttFollowerChart} margin={{ top: 36, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="followers" name="Seguidores" stroke="#374151" strokeWidth={2}
                    dot={<TtFollowerDot /> as unknown as boolean} activeDot={{ r: 5 }} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {histLast.length >= 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Impresiones / Views</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={viewsChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Views" fill="#d1d5db" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#6b7280" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Interacciones</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={intChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Interacciones" fill="#e5e7eb" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#4b5563" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Engagement %</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={erChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ttErGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#374151" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#374151" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                    <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" name="ER%" stroke="#374151" fill="url(#ttErGrad)" strokeWidth={2} dot={{ r: 3, fill: '#374151', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#374151" strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Nuevos seguidores</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={follChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Nuevos seguidores" fill="#d1d5db" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#6b7280" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* CSV vs Manual breakdown */}
          {originBreakdown && (
            <Card className="mb-6">
              <CardHeader><CardTitle>Rendimiento por origen</CardTitle></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Origen</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Videos</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views promedio</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Interacciones promedio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {originBreakdown.map(row => (
                      <tr key={row.origen} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-700">{row.origen}</td>
                        <td className="py-2 px-3 text-right text-gray-700">{row.count}</td>
                        <td className="py-2 px-3 text-right font-medium">{formatNumber(Math.round(row.avgViews))}</td>
                        <td className="py-2 px-3 text-right text-gray-600">{formatNumber(Math.round(row.avgInt))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Videos del mes ({videos.length})</CardTitle>
              <div className="flex gap-2">
                {selected.size > 0 && (
                  <button onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400">
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
                <Link href="/dashboard/upload"
                  className="presentation-hide flex items-center gap-1 text-xs bg-gray-700 text-white px-3 py-1 rounded-lg font-medium hover:bg-gray-600">
                  <Upload size={13} /> Subir CSV TikTok
                </Link>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="presentation-hide flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400">
                  <Plus size={13} /> Agregar manual
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="presentation-hide bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Nuevo video manual</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Título del video</label>
                    <input type="text" value={newVideo.title} onChange={e => setNewVideo(v => ({ ...v, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                    <input type="date" value={newVideo.video_date} onChange={e => setNewVideo(v => ({ ...v, video_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {['views', 'likes', 'comments', 'shares'].map(f => (
                    <div key={f}>
                      <label className="text-xs text-gray-500 block mb-1 capitalize">{f}</label>
                      <input type="number" value={newVideo[f as keyof typeof newVideo]} onChange={e => setNewVideo(v => ({ ...v, [f]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Link del video</label>
                    <input type="text" placeholder="https://tiktok.com/@..." value={newVideo.permalink} onChange={e => setNewVideo(v => ({ ...v, permalink: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveVideo} disabled={saving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar video'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-8 py-2 px-2">
                      <input type="checkbox" className="rounded"
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sorted.length }}
                        checked={sorted.length > 0 && selected.size === sorted.length}
                        onChange={() => toggleSelectAll(sorted)} />
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('views')}>
                      <span className="flex items-center justify-end gap-1">Views <SortIcon k="views" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('likes')}>
                      <span className="flex items-center justify-end gap-1">Likes <SortIcon k="likes" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('comments')}>
                      <span className="flex items-center justify-end gap-1">Comments <SortIcon k="comments" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('shares')}>
                      <span className="flex items-center justify-end gap-1">Shares <SortIcon k="shares" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-sm">No hay videos. Subí el CSV de TikTok Studio o agregá uno manual.</td></tr>
                  )}
                  {sorted.map(v => (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} />
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        {v.permalink ? (
                          <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600 truncate block">{v.title || '(sin título)'}</a>
                        ) : (
                          <div className="text-gray-700 truncate">{v.title || '(sin título)'}</div>
                        )}
                        {v.is_manual && <Badge variant="manual">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{v.video_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatNumber(v.views)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(v.likes)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(v.comments)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(v.shares)}</td>
                      <td className="py-2 px-2 text-right">
                        {v.permalink ? <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={14} /></a> : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDelete(v.id)} className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ── YouTube Shorts ─────────────────────── */}
          <div className="flex items-center gap-2 mb-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">YouTube Shorts</div>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Views Shorts</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(ytCurrentViews)}</div>
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-gray-400">
                  <TrendBadge value={ytCurrentViews} prev={ytPrevH?.views} />
                  <span className="ml-1">vs mes ant.</span>
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm lg:col-span-2 flex items-end gap-3">
              <div className="flex-1">
                <div className="text-xs font-medium text-gray-500 mb-1">Actualizar views del mes</div>
                <input type="number" value={ytViews} onChange={e => setYtViews(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              <button onClick={saveYouTube} disabled={saving}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-400 disabled:opacity-50 shrink-0">
                {saving ? '...' : ytSaved ? '✓' : 'Guardar'}
              </button>
            </div>
          </div>

          {ytHistLast.length >= 1 && (
            <div className={chartCardCls}>
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">YouTube Shorts — Evolución de views</div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={ytChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="value" name="Views Shorts" fill="#fca5a5" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                  </Bar>
                  <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#ef4444" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}
