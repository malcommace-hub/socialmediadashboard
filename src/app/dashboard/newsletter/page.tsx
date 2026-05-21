'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getNewsletterData, upsertNewsletterMonthly, addNewsletterEpisode, deleteNewsletterEpisode, getNewsletterHistory } from '@/lib/queries'
import { formatNumber, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import { useMesParam } from '@/hooks/useMesParam'
import type { NewsletterEpisode } from '@/lib/types'
import { Trash2, Plus, RefreshCw } from 'lucide-react'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area,
} from 'recharts'

type HistoryPoint = Awaited<ReturnType<typeof getNewsletterHistory>>[0]

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

export default function NewsletterPage() {
  const { year, month, setYear, setMonth } = useMesParam()
  const [episodes, setEpisodes] = useState<NewsletterEpisode[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [newSubs, setNewSubs] = useState('')
  const [savedNewSubs, setSavedNewSubs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newEp, setNewEp] = useState({ episode_number: '', title: '', views: '', lead_magnet_downloads: '', published_date: '' })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, hist] = await Promise.all([
        getNewsletterData({ year, month }),
        getNewsletterHistory(),
      ])
      setEpisodes(data.episodes)
      setHistory(hist)
      setNewSubs(String(data.monthly?.new_subscribers ?? ''))
      setSavedNewSubs(data.monthly?.new_subscribers ?? 0)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos del newsletter')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function saveMonthly() {
    setSaving(true)
    await upsertNewsletterMonthly({ year, month, new_subscribers: parseInt(newSubs) || 0 })
    await load()
    setSaving(false)
  }

  async function saveEpisode() {
    if (!newEp.title) return
    setSaving(true)
    await addNewsletterEpisode({
      year, month,
      episode_number: parseInt(newEp.episode_number) || null,
      title: newEp.title,
      views: parseInt(newEp.views) || 0,
      lead_magnet_downloads: parseInt(newEp.lead_magnet_downloads) || 0,
      published_date: newEp.published_date || null,
    })
    setNewEp({ episode_number: '', title: '', views: '', lead_magnet_downloads: '', published_date: '' })
    setShowForm(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este episodio?')) return
    await deleteNewsletterEpisode(id)
    await load()
  }

  const totalViews = episodes.reduce((a, e) => a + (e.views ?? 0), 0)

  const histLast = history.slice(-12)
  const prevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return history.find(d => d.year === pm.y && d.month === pm.m)
  })()
  const qPrevH = (() => {
    let m = month - 3, y = year
    if (m <= 0) { m += 12; y-- }
    return history.find(d => d.year === y && d.month === m)
  })()

  const viewsChart = useMemo(() => {
    const vals = histLast.map(d => d.views)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.views, ma: ma[i] }))
  }, [histLast])

  const subsChart = useMemo(() => {
    const vals = histLast.map(d => d.newSubscribers)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.newSubscribers, ma: ma[i] }))
  }, [histLast])

  const cumulativeSubsChart = useMemo(() => {
    const sorted = [...history].sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
    let running = 0
    return sorted.map(d => {
      running += d.newSubscribers ?? 0
      return { label: shortMonthLabel(d.year, d.month), total: running }
    }).slice(-12)
  }, [history])

  const topEpId = useMemo(() => {
    if (episodes.length < 2) return null
    return [...episodes].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0].id
  }, [episodes])

  const summaryText = useMemo(() => {
    const bestEp = [...episodes].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
    const parts: string[] = [monthLabel(year, month)]
    if (episodes.length > 0) parts.push(`${episodes.length} episodio${episodes.length !== 1 ? 's' : ''}`)
    if (totalViews > 0) parts.push(`${formatNumber(totalViews)} visualizaciones`)
    if (bestEp) {
      const title = bestEp.title || '(sin título)'
      const truncated = title.length > 40 ? title.slice(0, 40) + '…' : title
      parts.push(`Mejor episodio: "${truncated}"`)
    }
    return parts.join(' · ')
  }, [year, month, episodes, totalViews])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Seeds Business Radar</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
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
        </>
      ) : (
        <>
          {/* Month summary */}
          {summaryText && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500 mb-5">
              {summaryText}
            </div>
          )}

          {/* KPI trend cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Views totales', val: totalViews, prev: prevH?.views, qPrev: qPrevH?.views },
              { label: 'Nuevos suscriptores', val: savedNewSubs, prev: prevH?.newSubscribers, qPrev: qPrevH?.newSubscribers },
              { label: 'Episodios', val: episodes.length, prev: undefined, qPrev: undefined },
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

          {/* Historical charts */}
          {histLast.length >= 1 && (
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

              {/* Cumulative subscribers chart (5c) */}
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
                      <Area type="monotone" dataKey="total" stroke="#f97316" strokeWidth={2} fill="url(#nlSubsGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}

          {/* New subscribers */}
          <Card className="mb-6">
            <div className="text-sm font-semibold text-gray-700 mb-3">Nuevos suscriptores del mes</div>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Nuevos suscriptores</label>
                <input type="number" value={newSubs} onChange={e => setNewSubs(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <button onClick={saveMonthly} disabled={saving}
                className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </Card>

          {/* Episodes */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Episodios del mes</CardTitle>
              <button onClick={() => setShowForm(!showForm)}
                className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400">
                <Plus size={13} /> Agregar episodio
              </button>
            </div>

            {showForm && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Episodio #</label>
                    <input type="number" value={newEp.episode_number} onChange={e => setNewEp(v => ({ ...v, episode_number: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Título *</label>
                    <input type="text" value={newEp.title} onChange={e => setNewEp(v => ({ ...v, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Views</label>
                    <input type="number" value={newEp.views} onChange={e => setNewEp(v => ({ ...v, views: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Lead magnet downloads</label>
                    <input type="number" value={newEp.lead_magnet_downloads} onChange={e => setNewEp(v => ({ ...v, lead_magnet_downloads: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha de publicación</label>
                    <input type="date" value={newEp.published_date} onChange={e => setNewEp(v => ({ ...v, published_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveEpisode} disabled={saving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar episodio'}
                  </button>
                  <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">#</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                  <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Views</th>
                  <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Lead magnets</th>
                  <th className="py-2 px-2 w-8" />
                </tr>
              </thead>
              <tbody>
                {episodes.length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">
                    No hay episodios cargados para este mes.
                  </td></tr>
                )}
                {episodes.map(ep => (
                  <tr key={ep.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                    <td className="py-2 px-2 text-gray-400 font-mono text-xs">#{ep.episode_number ?? '—'}</td>
                    <td className="py-2 px-2 text-gray-700">
                      {ep.id === topEpId && <span className="mr-1">⭐</span>}
                      {ep.title}
                    </td>
                    <td className="py-2 px-2 text-gray-500">{ep.published_date ?? '—'}</td>
                    <td className="py-2 px-2 text-right font-medium">{formatNumber(ep.views)}</td>
                    <td className="py-2 px-2 text-right text-gray-600">{formatNumber(ep.lead_magnet_downloads)}</td>
                    <td className="py-2 px-2 text-right">
                      <button onClick={() => handleDelete(ep.id)} className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Episode comparison (5d) — only shown when multiple episodes */}
            {episodes.length > 1 && (() => {
              const maxViews = Math.max(...episodes.map(e => e.views ?? 0))
              const sorted = [...episodes].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
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
        </>
      )}
    </div>
  )
}
