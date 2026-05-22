'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  getNewsletterData, getNewsletterHistory,
  getWebData, getWebHistory,
} from '@/lib/queries'
import { formatNumber, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import { useMesParam } from '@/hooks/useMesParam'
import type { NewsletterEpisode, WebMonthly, WebUtmSource } from '@/lib/types'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'
import { clearCache } from '@/lib/queryCache'
import { FollowerDot } from '@/components/dashboard/FollowerDot'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area, Legend,
} from 'recharts'

type NLHistoryPoint = Awaited<ReturnType<typeof getNewsletterHistory>>[0]
type WebHistoryPoint = Awaited<ReturnType<typeof getWebHistory>>[0]

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

const NLFollowerDot = (props: Record<string, unknown>) => <FollowerDot color="#f97316" {...props} />

const UTM_SOURCES = ['instagram', 'linkedin', 'tiktok', 'linktree', 'other']
const UTM_COLORS: Record<string, string> = {
  instagram: '#f43f5e',
  linkedin: '#3b82f6',
  tiktok: '#374151',
  linktree: '#10b981',
  other: '#d1d5db',
}

export default function MediosPage() {
  const { year, month, setYear, setMonth } = useMesParam()

  const [nlEpisodes, setNlEpisodes] = useState<NewsletterEpisode[]>([])
  const [nlHistory, setNlHistory] = useState<NLHistoryPoint[]>([])
  const [nlNewSubsSaved, setNlNewSubsSaved] = useState(0)

  const [webMonthly, setWebMonthly] = useState<WebMonthly | null>(null)
  const [webUtmSources, setWebUtmSources] = useState<WebUtmSource[]>([])
  const [webHistory, setWebHistory] = useState<WebHistoryPoint[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nlData, nlHist, webData, webHist] = await Promise.all([
        getNewsletterData({ year, month }),
        getNewsletterHistory(),
        getWebData({ year, month }),
        getWebHistory(),
      ])
      setNlEpisodes(nlData.episodes)
      setNlHistory(nlHist)
      setNlNewSubsSaved(nlData.monthly?.new_subscribers ?? 0)
      setWebMonthly(webData.monthly)
      setWebUtmSources(webData.utmSources)
      setWebHistory(webHist)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  // ── Newsletter computed ──────────────────────────
  const nlTotalViews = nlEpisodes.reduce((a, e) => a + (e.views ?? 0), 0)
  const nlHistLast = nlHistory.slice(-12)
  const nlPrevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return nlHistory.find(d => d.year === pm.y && d.month === pm.m)
  })()
  const nlQPrevH = (() => {
    let m = month - 3, y = year
    if (m <= 0) { m += 12; y-- }
    return nlHistory.find(d => d.year === y && d.month === m)
  })()

  const viewsChart = useMemo(() => {
    const vals = nlHistLast.map(d => d.views)
    const ma = movingAvg(vals, 3)
    return nlHistLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.views, ma: ma[i] }))
  }, [nlHistLast])

  const subsChart = useMemo(() => {
    const vals = nlHistLast.map(d => d.newSubscribers)
    const ma = movingAvg(vals, 3)
    return nlHistLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.newSubscribers, ma: ma[i] }))
  }, [nlHistLast])

  const cumulativeSubsChart = useMemo(() => {
    const sorted = [...nlHistory].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    let running = 0
    const pts = sorted.map(d => {
      const prev = running
      running += d.newSubscribers ?? 0
      const pctC = prev > 0 ? ((running - prev) / prev) * 100 : null
      return { label: shortMonthLabel(d.year, d.month), total: running, pctChange: pctC }
    })
    return pts.slice(-12)
  }, [nlHistory])

  const topEpId = useMemo(() => {
    if (nlEpisodes.length < 2) return null
    return [...nlEpisodes].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0].id
  }, [nlEpisodes])

  // ── Web computed ─────────────────────────────────
  const webHistLast = webHistory.slice(-12)
  const webPrevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return webHistory.find(d => d.year === pm.y && d.month === pm.m)
  })()
  const webQPrevH = (() => {
    let m = month - 3, y = year
    if (m <= 0) { m += 12; y-- }
    return webHistory.find(d => d.year === y && d.month === m)
  })()

  const sessionsChart = useMemo(() => {
    const vals = webHistLast.map(d => d.totalSessions)
    const ma = movingAvg(vals, 3)
    return webHistLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.totalSessions, ma: ma[i] }))
  }, [webHistLast])

  const utmChart = useMemo(() => {
    return webHistLast.map(d => ({
      label: shortMonthLabel(d.year, d.month),
      instagram: d.instagram,
      linkedin: d.linkedin,
      tiktok: d.tiktok,
      linktree: d.linktree,
      other: d.other,
    }))
  }, [webHistLast])

  const curTotalSessions = webMonthly?.total_sessions ?? 0

  const currentMonthUtmData = UTM_SOURCES.map(s => ({
    source: s.charAt(0).toUpperCase() + s.slice(1),
    sessions: webUtmSources.find(u => u.source === s)?.sessions ?? 0,
    color: UTM_COLORS[s],
  })).filter(d => d.sessions > 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter & Web</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Seeds Business Radar</p>
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
          <SkeletonCard kpi count={3} />
          <SkeletonCard chart />
          <SkeletonCard lines={5} />
          <SkeletonCard kpi count={1} />
          <SkeletonCard chart />
        </>
      ) : (
        <>
          {/* ══ NEWSLETTER ═══════════════════════════ */}
          <div className="flex items-center gap-2 mb-5">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Newsletter</div>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Views totales', val: nlTotalViews, prev: nlPrevH?.views, qPrev: nlQPrevH?.views },
              { label: 'Nuevos suscriptores', val: nlNewSubsSaved, prev: nlPrevH?.newSubscribers, qPrev: nlQPrevH?.newSubscribers },
              { label: 'Episodios', val: nlEpisodes.length, prev: undefined, qPrev: undefined },
            ].map(({ label, val, prev, qPrev }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{formatNumber(val)}</div>
                <div className="flex gap-3 mt-1 flex-wrap">
                  {prev !== undefined && (
                    <span className="text-xs text-gray-400">
                      <TrendBadge value={val} prev={prev} />
                      <span className="ml-1">vs mes ant.</span>
                    </span>
                  )}
                  {qPrev !== undefined && (
                    <span className="text-xs text-gray-400">
                      <TrendBadge value={val} prev={qPrev} />
                      <span className="ml-1">vs Q ant.</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {nlHistLast.length >= 1 && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <div className={chartCardCls}>
                  <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Visualizaciones artículos</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={viewsChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" name="Views" fill="#fed7aa" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                      </Bar>
                      <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#f97316" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className={chartCardCls}>
                  <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Nuevos suscriptores</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={subsChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" name="Nuevos subs" fill="#fdba74" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                      </Bar>
                      <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#ea580c" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {cumulativeSubsChart.length >= 2 && (
                <div className={`${chartCardCls} mb-6`}>
                  <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Suscriptores acumulados</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={cumulativeSubsChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="nlSubsGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                      <Tooltip formatter={(v) => [formatNumber(Number(v)), 'Total suscriptores']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#nlSubsGrad)" dot={<NLFollowerDot /> as unknown as boolean} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          <Card className="mb-8">
            <div className="font-semibold text-gray-900 mb-4">Episodios del mes</div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">#</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Views</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Lead magnets</th>
                  <th className="text-center py-2 px-2 text-xs font-medium text-gray-400">Enlace</th>
                </tr>
              </thead>
              <tbody>
                {nlEpisodes.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    No hay episodios cargados para este mes.
                  </td></tr>
                )}
                {nlEpisodes.map(ep => (
                  <tr key={ep.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-400 font-mono text-xs">#{ep.episode_number ?? '—'}</td>
                    <td className="py-2 px-2 text-gray-700">
                      {ep.id === topEpId && <span className="mr-1">⭐</span>}
                      {ep.title}
                    </td>
                    <td className="py-2 px-2 text-gray-500">{ep.published_date ?? '—'}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatNumber(ep.views)}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{formatNumber(ep.lead_magnet_downloads)}</td>
                    <td className="py-2 px-2 text-center">
                      {ep.url && (
                        <a href={ep.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-emerald-500 transition-colors inline-flex">
                          <ExternalLink size={13} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {nlEpisodes.length > 1 && (() => {
              const maxViews = Math.max(...nlEpisodes.map(e => e.views ?? 0))
              const sorted = [...nlEpisodes].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
              return (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Comparativa de episodios</div>
                  {sorted.map(ep => {
                    const pct = maxViews > 0 ? ((ep.views ?? 0) / maxViews) * 100 : 0
                    return (
                      <div key={ep.id} className="mb-2.5">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600 truncate max-w-[70%]">
                            {ep.id === topEpId && <span className="mr-1">⭐</span>}
                            {ep.episode_number ? `#${ep.episode_number} ` : ''}{ep.title}
                          </span>
                          <span className="text-gray-500 font-medium shrink-0 ml-2">{formatNumber(ep.views ?? 0)} views</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </Card>

          {/* ══ DIVIDER ══════════════════════════════ */}
          <div className="flex items-center gap-3 my-8">
            <div className="flex-1 h-px bg-gray-200" />
            <div className="text-xs font-bold tracking-widest text-gray-300 uppercase px-2">Tráfico Web</div>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Web KPI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sesiones totales</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(curTotalSessions)}</div>
              <div className="flex gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">
                  <TrendBadge value={curTotalSessions} prev={webPrevH?.totalSessions} />
                  <span className="ml-1">vs mes ant.</span>
                </span>
                <span className="text-xs text-gray-400">
                  <TrendBadge value={curTotalSessions} prev={webQPrevH?.totalSessions} />
                  <span className="ml-1">vs Q ant.</span>
                </span>
              </div>
            </div>
          </div>

          {webHistLast.length >= 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Sesiones totales</div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={sessionsChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Sesiones" fill="#6ee7b7" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#10b981" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Sesiones por fuente UTM</div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={utmChart} barCategoryGap="15%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                    <Bar dataKey="instagram" name="Instagram" fill={UTM_COLORS.instagram} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="linkedin" name="LinkedIn" fill={UTM_COLORS.linkedin} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="tiktok" name="TikTok" fill={UTM_COLORS.tiktok} radius={[2, 2, 0, 0]} />
                    <Bar dataKey="linktree" name="Linktree" fill={UTM_COLORS.linktree} radius={[2, 2, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {currentMonthUtmData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Sesiones por fuente — {monthLabel(year, month)}</CardTitle></CardHeader>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={currentMonthUtmData} barCategoryGap="30%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="sessions" name="Sesiones" fill="#10b981" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="sessions" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
