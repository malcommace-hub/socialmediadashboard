'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getWebData, upsertWebMonthly, upsertWebUtmSource, getWebHistory } from '@/lib/queries'
import { formatNumber, currentYearMonth, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import type { WebMonthly, WebUtmSource } from '@/lib/types'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts'

type HistoryPoint = Awaited<ReturnType<typeof getWebHistory>>[0]

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

const UTM_SOURCES = ['instagram', 'linkedin', 'tiktok', 'linktree', 'other']

const UTM_COLORS: Record<string, string> = {
  instagram: '#f43f5e',
  linkedin: '#3b82f6',
  tiktok: '#374151',
  linktree: '#10b981',
  other: '#d1d5db',
}

export default function WebPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [monthly, setMonthly] = useState<WebMonthly | null>(null)
  const [utmSources, setUtmSources] = useState<WebUtmSource[]>([])
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalSessions, setTotalSessions] = useState('')
  const [utmValues, setUtmValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, hist] = await Promise.all([
        getWebData({ year, month }),
        getWebHistory(),
      ])
      setMonthly(data.monthly)
      setUtmSources(data.utmSources)
      setHistory(hist)
      setTotalSessions(String(data.monthly?.total_sessions ?? ''))
      const vals: Record<string, string> = {}
      UTM_SOURCES.forEach(s => {
        const found = data.utmSources.find(u => u.source === s)
        vals[s] = String(found?.sessions ?? '')
      })
      setUtmValues(vals)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos web')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await upsertWebMonthly({ year, month, total_sessions: parseInt(totalSessions) || 0 })
    await Promise.all(UTM_SOURCES.map(s =>
      upsertWebUtmSource({ year, month, source: s, sessions: parseInt(utmValues[s] || '0') || 0 })
    ))
    await load()
    setSaving(false)
  }

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

  const curTotalSessions = monthly?.total_sessions ?? 0

  const sessionsChart = useMemo(() => {
    const vals = histLast.map(d => d.totalSessions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.totalSessions, ma: ma[i] }))
  }, [histLast])

  const utmChart = useMemo(() => {
    return histLast.map(d => ({
      label: shortMonthLabel(d.year, d.month),
      instagram: d.instagram,
      linkedin: d.linkedin,
      tiktok: d.tiktok,
      linktree: d.linktree,
      other: d.other,
    }))
  }, [histLast])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  const currentMonthChartData = UTM_SOURCES.map(s => ({
    source: s.charAt(0).toUpperCase() + s.slice(1),
    sessions: parseInt(utmValues[s] || '0') || 0,
    color: UTM_COLORS[s],
  })).filter(d => d.sessions > 0)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Web / Webflow</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Tráfico orgánico social</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠ {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* KPI trend card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Sesiones totales</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(curTotalSessions)}</div>
              <div className="flex gap-3 mt-1 flex-wrap">
                <span className="text-xs text-gray-400">
                  <TrendBadge value={curTotalSessions} prev={prevH?.totalSessions} />
                  <span className="ml-1">vs mes ant.</span>
                </span>
                <span className="text-xs text-gray-400">
                  <TrendBadge value={curTotalSessions} prev={qPrevH?.totalSessions} />
                  <span className="ml-1">vs Q ant.</span>
                </span>
              </div>
            </div>
          </div>

          {/* Historical charts */}
          {histLast.length >= 1 && (
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

          {/* Current month data */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Sesiones por fuente — {monthLabel(year, month)}</CardTitle></CardHeader>
              {currentMonthChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={currentMonthChartData} barCategoryGap="30%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="source" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="sessions" name="Sesiones" fill="#10b981" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="sessions" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
                  Ingresá los datos para ver el gráfico
                </div>
              )}
            </Card>

            <Card>
              <CardHeader><CardTitle>Actualizar datos del mes</CardTitle></CardHeader>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Sesiones totales</label>
                  <input type="number" value={totalSessions} onChange={e => setTotalSessions(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Sesiones por UTM source</div>
                  {UTM_SOURCES.map(s => (
                    <div key={s} className="flex items-center gap-3 mb-2">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: UTM_COLORS[s] }} />
                      <label className="text-sm text-gray-600 w-20 capitalize">{s}</label>
                      <input type="number" value={utmValues[s] ?? ''} onChange={e => setUtmValues(v => ({ ...v, [s]: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  ))}
                </div>
                <button onClick={save} disabled={saving}
                  className="w-full bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50 mt-2">
                  {saving ? 'Guardando...' : 'Guardar todo'}
                </button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
