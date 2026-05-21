'use client'
import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { getOverviewHistory, getInstagramTopPosts, getLinkedInTopPosts } from '@/lib/queries'
import { formatNumber, formatPercent, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { MonthScoreCard } from '@/components/dashboard/MonthScoreCard'

type HistoryPoint = Awaited<ReturnType<typeof getOverviewHistory>>[0]

const WINDOWS = [6, 9, 12, 18]
const MA_OPTS = [3, 6]

// ─── Sub-components ────────────────────────────

function KpiCard({
  label, value, trend, dotColor,
}: { label: string; value: string; trend: number | null; dotColor: string }) {
  const pos = trend !== null && trend >= 0
  const trendColor = trend === null ? 'text-gray-300' : pos ? 'text-emerald-600' : 'text-red-500'
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-1.5 mb-2">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</div>
      </div>
      <div className="text-2xl font-bold text-gray-900 leading-tight">{value}</div>
      <div className={`text-xs mt-1 font-medium ${trendColor}`}>
        {trend !== null ? `${pos ? '+' : ''}${trend.toFixed(1)}%` : '—'}
        <span className="text-gray-400 font-normal ml-1">vs mes anterior</span>
      </div>
    </div>
  )
}

interface ChartSeries { key: string; label: string; color: string }

function NavButtons({
  canPrev, canNext, onPrev, onNext,
}: { canPrev: boolean; canNext: boolean; onPrev: () => void; onNext: () => void }) {
  const cls = 'w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors'
  return (
    <div className="flex gap-1">
      <button className={cls} onClick={onPrev} disabled={!canPrev}><ChevronLeft size={13} /></button>
      <button className={cls} onClick={onNext} disabled={!canNext}><ChevronRight size={13} /></button>
    </div>
  )
}

function StackedBarChart({
  title, data, series, maLabel, canPrev, canNext, onPrev, onNext, height = 260,
}: {
  title: string
  data: Record<string, string | number | null>[]
  series: ChartSeries[]
  maLabel: string
  canPrev: boolean; canNext: boolean
  onPrev: () => void; onNext: () => void
  height?: number
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">{title}</span>
        <NavButtons canPrev={canPrev} canNext={canNext} onPrev={onPrev} onNext={onNext} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} barCategoryGap="22%" margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={46} />
          <Tooltip
            formatter={(v, name) => [formatNumber(Number(v)), name as string]}
            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="a"
              fill={s.color}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            >
              {i === series.length - 1 && (
                <LabelList
                  dataKey="total"
                  position="top"
                  style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
                  formatter={(v: unknown) => formatNumber(Number(v))}
                />
              )}
            </Bar>
          ))}
          <Line
            type="monotone"
            dataKey="ma"
            name={maLabel}
            stroke="#6ee7b7"
            strokeDasharray="6 3"
            dot={{ r: 3, fill: '#6ee7b7', strokeWidth: 0 }}
            strokeWidth={2}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  )
}

function SimpleBarChart({
  title, data, maLabel, barColor = '#6ee7b7', canPrev, canNext, onPrev, onNext, height = 260,
}: {
  title: string
  data: Record<string, string | number | null>[]
  maLabel: string
  barColor?: string
  canPrev: boolean; canNext: boolean
  onPrev: () => void; onNext: () => void
  height?: number
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold tracking-wider text-gray-500 uppercase">{title}</span>
        <NavButtons canPrev={canPrev} canNext={canNext} onPrev={onPrev} onNext={onNext} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} barCategoryGap="22%" margin={{ top: 20, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={46} />
          <Tooltip
            formatter={(v, name) => [formatNumber(Number(v)), name as string]}
            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
          <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
          <Bar dataKey="total" name="Total" fill={barColor} radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="total"
              position="top"
              style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
              formatter={(v: unknown) => formatNumber(Number(v))}
            />
          </Bar>
          <Line
            type="monotone"
            dataKey="ma"
            name={maLabel}
            stroke="#10b981"
            strokeDasharray="6 3"
            dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
            strokeWidth={2}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  )
}

// ─── Main page ─────────────────────────────────

export default function OverviewPage() {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [windowSize, setWindowSize] = useState(6)
  const [maWindow, setMaWindow] = useState(3)
  const [offset, setOffset] = useState(0)

  type IgTop = Awaited<ReturnType<typeof getInstagramTopPosts>>[0]
  type LiTop = Awaited<ReturnType<typeof getLinkedInTopPosts>>[0]
  const [igTop, setIgTop] = useState<IgTop[]>([])
  const [liTop, setLiTop] = useState<LiTop[]>([])
  const [topOpen, setTopOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    getOverviewHistory().then(data => {
      setHistory(data)
      setLoading(false)
    })
  }, [])

  const visible = useMemo(() => {
    if (!history.length) return []
    const end = Math.max(0, history.length - offset)
    const start = Math.max(0, end - windowSize)
    return history.slice(start, end)
  }, [history, windowSize, offset])

  const current = visible[visible.length - 1]
  const prev = visible[visible.length - 2]

  const selectedYear = current?.year
  const selectedMonth = current?.month

  useEffect(() => {
    if (!selectedYear) return
    Promise.all([getInstagramTopPosts(selectedYear), getLinkedInTopPosts(selectedYear)])
      .then(([ig, li]) => { setIgTop(ig); setLiTop(li) })
      .catch(() => {})
  }, [selectedYear])

  const impData = useMemo(() => {
    const totals = visible.map(d => d.igImpressions + d.liImpressions + d.ttViews + d.ytViews)
    const ma = movingAvg(totals, maWindow)
    return visible.map((d, i) => ({
      label: shortMonthLabel(d.year, d.month),
      li: d.liImpressions, ig: d.igImpressions, tt: d.ttViews, yt: d.ytViews,
      total: totals[i], ma: ma[i],
    }))
  }, [visible, maWindow])

  const follData = useMemo(() => {
    const totals = visible.map(d => d.igNewFollowers + d.liNewFollowers + d.ttNewFollowers)
    const ma = movingAvg(totals, maWindow)
    return visible.map((d, i) => ({
      label: shortMonthLabel(d.year, d.month),
      li: d.liNewFollowers, ig: d.igNewFollowers, tt: d.ttNewFollowers,
      total: totals[i], ma: ma[i],
    }))
  }, [visible, maWindow])

  const intData = useMemo(() => {
    const totals = visible.map(d => d.igInteractions + d.liInteractions + d.ttInteractions)
    const ma = movingAvg(totals, maWindow)
    return visible.map((d, i) => ({
      label: shortMonthLabel(d.year, d.month),
      total: totals[i], ma: ma[i],
    }))
  }, [visible, maWindow])

  const canPrev = offset < history.length - windowSize
  const canNext = offset > 0

  const curImp = current ? current.igImpressions + current.liImpressions + current.ttViews + current.ytViews : 0
  const prevImp = prev ? prev.igImpressions + prev.liImpressions + prev.ttViews + prev.ytViews : 0
  const curFoll = current ? current.igNewFollowers + current.liNewFollowers + current.ttNewFollowers : 0
  const prevFoll = prev ? prev.igNewFollowers + prev.liNewFollowers + prev.ttNewFollowers : 0
  const curInt = current ? current.igInteractions + current.liInteractions + current.ttInteractions : 0
  const prevInt = prev ? prev.igInteractions + prev.liInteractions + prev.ttInteractions : 0

  const maLabel = `Media ${maWindow}m`

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Overview general{current ? ` — ${shortMonthLabel(current.year, current.month)}` : ''}
        </h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando historial...</div>
      ) : (
        <>
          {/* Window + MA selectors */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 tracking-wider mr-1">VENTANA</span>
            {WINDOWS.map(w => (
              <button
                key={w}
                onClick={() => { setWindowSize(w); setOffset(0) }}
                className={`text-sm px-3 py-1 rounded-lg font-medium transition-colors ${windowSize === w ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {w}m
              </button>
            ))}
            <div className="w-px h-5 bg-gray-200 mx-2" />
            <span className="text-xs font-semibold text-gray-400 tracking-wider mr-1">MEDIA MÓVIL</span>
            {MA_OPTS.map(w => (
              <button
                key={w}
                onClick={() => setMaWindow(w)}
                className={`text-sm px-3 py-1 rounded-lg font-medium transition-colors ${maWindow === w ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {w} per.
              </button>
            ))}
          </div>

          {/* Score del mes */}
          {current && <MonthScoreCard current={current} history={history} />}

          {/* Top 12 posts del año (collapsible) */}
          {(igTop.length > 0 || liTop.length > 0) && (
            <Card className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setTopOpen(o => !o)}
              >
                <span className="text-sm font-semibold text-gray-700">Top 12 del año {selectedYear ?? '—'}</span>
                <span className="text-gray-400">{topOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
              {topOpen && (
                <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Instagram top 12 */}
                  {igTop.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Top Instagram {selectedYear}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Mes</th>
                              <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Descripción</th>
                              <th className="text-right py-1.5 px-2 text-xs font-medium text-gray-400">Views</th>
                              <th className="text-right py-1.5 px-2 text-xs font-medium text-gray-400">ER%</th>
                              <th className="py-1.5 px-2 w-6" />
                            </tr>
                          </thead>
                          <tbody>
                            {igTop.map((p, i) => {
                              const isCurrent = p.year === selectedYear && p.month === selectedMonth
                              return (
                                <tr key={i} className={`border-b border-gray-50 ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                  <td className="py-1.5 px-2 text-xs text-gray-500 whitespace-nowrap">
                                    {isCurrent && <span className="text-xs font-semibold text-blue-500 mr-1">Este mes</span>}
                                    {shortMonthLabel(p.year, p.month)}
                                  </td>
                                  <td className="py-1.5 px-2 text-gray-700 max-w-[160px] truncate text-xs">{p.description || '—'}</td>
                                  <td className="py-1.5 px-2 text-right font-medium text-xs">{formatNumber(p.views)}</td>
                                  <td className="py-1.5 px-2 text-right text-xs text-gray-600">{p.er.toFixed(2)}%</td>
                                  <td className="py-1.5 px-2 text-right">
                                    {p.permalink && !p.permalink.startsWith('manual:')
                                      ? <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={12} /></a>
                                      : null}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {/* LinkedIn top 12 */}
                  {liTop.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">Top LinkedIn {selectedYear}</div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100">
                              <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Mes</th>
                              <th className="text-left py-1.5 px-2 text-xs font-medium text-gray-400">Título</th>
                              <th className="text-right py-1.5 px-2 text-xs font-medium text-gray-400">Impr.</th>
                              <th className="text-right py-1.5 px-2 text-xs font-medium text-gray-400">ER%</th>
                              <th className="py-1.5 px-2 w-6" />
                            </tr>
                          </thead>
                          <tbody>
                            {liTop.map((p, i) => {
                              const isCurrent = p.year === selectedYear && p.month === selectedMonth
                              return (
                                <tr key={i} className={`border-b border-gray-50 ${isCurrent ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                  <td className="py-1.5 px-2 text-xs text-gray-500 whitespace-nowrap">
                                    {isCurrent && <span className="text-xs font-semibold text-blue-500 mr-1">Este mes</span>}
                                    {shortMonthLabel(p.year, p.month)}
                                  </td>
                                  <td className="py-1.5 px-2 text-gray-700 max-w-[160px] truncate text-xs">{p.title || '—'}</td>
                                  <td className="py-1.5 px-2 text-right font-medium text-xs">{formatNumber(p.impressions)}</td>
                                  <td className="py-1.5 px-2 text-right text-xs text-gray-600">{p.er.toFixed(2)}%</td>
                                  <td className="py-1.5 px-2 text-right">
                                    {p.permalink
                                      ? <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={12} /></a>
                                      : null}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <KpiCard label="Impresiones totales" value={formatNumber(curImp)} trend={pctChange(curImp, prevImp)} dotColor="bg-emerald-500" />
            <KpiCard label="Nuevos seguidores" value={formatNumber(curFoll)} trend={pctChange(curFoll, prevFoll)} dotColor="bg-purple-500" />
            <KpiCard label="Interacciones" value={formatNumber(curInt)} trend={pctChange(curInt, prevInt)} dotColor="bg-violet-500" />
            <KpiCard
              label="LinkedIn ER"
              value={current?.liER ? formatPercent(current.liER) : '—'}
              trend={current?.liER && prev?.liER ? pctChange(current.liER, prev.liER) : null}
              dotColor="bg-blue-500"
            />
            <KpiCard
              label="Instagram ER"
              value={current?.igER ? formatPercent(current.igER) : '—'}
              trend={current?.igER && prev?.igER ? pctChange(current.igER, prev.igER) : null}
              dotColor="bg-rose-500"
            />
            <KpiCard
              label="Newsletter views"
              value={current?.newsletterViews ? formatNumber(current.newsletterViews) : '—'}
              trend={current?.newsletterViews && prev?.newsletterViews ? pctChange(current.newsletterViews, prev.newsletterViews) : null}
              dotColor="bg-amber-500"
            />
          </div>

          {/* Impressions — full width */}
          <div className="mb-4">
            <StackedBarChart
              title="Impresiones totales por mes"
              data={impData}
              series={[
                { key: 'li', label: 'LinkedIn', color: '#3b82f6' },
                { key: 'ig', label: 'Instagram', color: '#f43f5e' },
                { key: 'tt', label: 'TikTok', color: '#374151' },
                { key: 'yt', label: 'YT Shorts', color: '#fca5a5' },
              ]}
              maLabel={maLabel}
              canPrev={canPrev} canNext={canNext}
              onPrev={() => setOffset(o => o + 1)}
              onNext={() => setOffset(o => Math.max(0, o - 1))}
            />
          </div>

          {/* Followers + Interactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <StackedBarChart
              title="Nuevos seguidores (todos los canales)"
              data={follData}
              series={[
                { key: 'li', label: 'LI', color: '#3b82f6' },
                { key: 'ig', label: 'IG', color: '#f43f5e' },
                { key: 'tt', label: 'TK', color: '#374151' },
              ]}
              maLabel={maLabel}
              canPrev={canPrev} canNext={canNext}
              onPrev={() => setOffset(o => o + 1)}
              onNext={() => setOffset(o => Math.max(0, o - 1))}
              height={240}
            />
            <SimpleBarChart
              title="Interacciones totales"
              data={intData}
              maLabel={maLabel}
              barColor="#6ee7b7"
              canPrev={canPrev} canNext={canNext}
              onPrev={() => setOffset(o => o + 1)}
              onNext={() => setOffset(o => Math.max(0, o - 1))}
              height={240}
            />
          </div>
        </>
      )}
    </div>
  )
}
