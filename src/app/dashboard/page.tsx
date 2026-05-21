'use client'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { getOverviewHistory, getInstagramTopPosts, getLinkedInTopPosts, getMonthlyNote, upsertMonthlyNote } from '@/lib/queries'
import { formatNumber, formatPercent, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'
import { clearCache } from '@/lib/queryCache'
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
  const [qOpen, setQOpen] = useState(true)

  const [note, setNote] = useState('')
  const [saveStatus, setSaveStatus] = useState<'' | 'saving' | 'saved'>('')
  const [copied, setCopied] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadHistory = useCallback(() => {
    setLoading(true)
    getOverviewHistory().then(data => {
      setHistory(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory, reloadKey])

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

  useEffect(() => {
    if (!selectedYear || !selectedMonth) return
    setNote('')
    setSaveStatus('')
    getMonthlyNote(selectedYear, selectedMonth)
      .then(data => setNote(data?.content ?? ''))
      .catch(() => {})
  }, [selectedYear, selectedMonth])

  function handleNoteChange(value: string) {
    setNote(value)
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!selectedYear || !selectedMonth) return
      await upsertMonthlyNote(selectedYear, selectedMonth, value).catch(() => {})
      setSaveStatus('saved')
      if (clearTimer.current) clearTimeout(clearTimer.current)
      clearTimer.current = setTimeout(() => setSaveStatus(''), 2000)
    }, 1500)
  }

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

  const qBanner = useMemo(() => {
    if (!current || !history.length) return null
    const curQ = Math.ceil(current.month / 3)
    const prevQNum = curQ === 1 ? 4 : curQ - 1
    const prevQYear = curQ === 1 ? current.year - 1 : current.year
    const inQ = (d: HistoryPoint, q: number, y: number) => d.year === y && Math.ceil(d.month / 3) === q
    const curQData = history.filter(d => inQ(d, curQ, current.year))
    const prevQData = history.filter(d => inQ(d, prevQNum, prevQYear))
    if (!prevQData.length) return null
    const sumQ = (rows: HistoryPoint[], fn: (d: HistoryPoint) => number) => rows.reduce((a, d) => a + fn(d), 0)
    const curImpQ = sumQ(curQData, d => d.igImpressions + d.liImpressions + d.ttViews + d.ytViews)
    const prevImpQ = sumQ(prevQData, d => d.igImpressions + d.liImpressions + d.ttViews + d.ytViews)
    const curFollQ = sumQ(curQData, d => d.igNewFollowers + d.liNewFollowers + d.ttNewFollowers)
    const prevFollQ = sumQ(prevQData, d => d.igNewFollowers + d.liNewFollowers + d.ttNewFollowers)
    const curIntQ = sumQ(curQData, d => d.igInteractions + d.liInteractions + d.ttInteractions)
    const curImpER = sumQ(curQData, d => d.igImpressions + d.liImpressions)
    const prevIntQ = sumQ(prevQData, d => d.igInteractions + d.liInteractions + d.ttInteractions)
    const prevImpER = sumQ(prevQData, d => d.igImpressions + d.liImpressions)
    const curERQ = curImpER > 0 ? (curIntQ / curImpER) * 100 : null
    const prevERQ = prevImpER > 0 ? (prevIntQ / prevImpER) * 100 : null
    return { curQ, year: current.year, prevQNum, curImpQ, prevImpQ, curFollQ, prevFollQ, curERQ, prevERQ }
  }, [current, history])

  type AlertLevel = 'positive' | 'warning' | 'critical' | 'nodata'
  const anomalyAlerts = useMemo(() => {
    if (!current) return null
    const idx = history.findIndex(h => h.year === current.year && h.month === current.month)
    if (idx < 2) return null // need at least 2 prior months
    const prior = history.slice(Math.max(0, idx - 3), idx)
    if (prior.length < 2) return null

    function priorAvg(vals: number[]): number {
      const nonZero = vals.filter(v => v > 0)
      return nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0
    }

    const alerts: { label: string; level: AlertLevel; pct: number | null; magnitude: number }[] = []

    function check(label: string, curr: number, priorVals: number[], positiveOnly = false) {
      const avg = priorAvg(priorVals)
      if (curr === 0 && avg > 0) {
        if (!positiveOnly) alerts.push({ label, level: 'nodata', pct: null, magnitude: 100 })
        return
      }
      if (avg === 0) return
      const pct = ((curr - avg) / avg) * 100
      if (pct > 30) {
        alerts.push({ label, level: 'positive', pct, magnitude: pct })
      } else if (!positiveOnly && pct < -50) {
        alerts.push({ label, level: 'critical', pct, magnitude: Math.abs(pct) })
      } else if (!positiveOnly && pct < -20) {
        alerts.push({ label, level: 'warning', pct, magnitude: Math.abs(pct) })
      }
    }

    check('Instagram views', current.igImpressions, prior.map(h => h.igImpressions))
    check('LinkedIn impresiones', current.liImpressions, prior.map(h => h.liImpressions))
    check('TikTok views', current.ttViews, prior.map(h => h.ttViews))
    check(
      'Nuevos seguidores',
      current.igNewFollowers + current.liNewFollowers + current.ttNewFollowers,
      prior.map(h => h.igNewFollowers + h.liNewFollowers + h.ttNewFollowers)
    )
    const currER = (() => {
      const vals = [current.igER, current.liER].filter(v => v > 0)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    })()
    check('ER promedio', currER, prior.map(h => {
      const vals = [h.igER, h.liER].filter(v => v > 0)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }), true)

    return alerts.sort((a, b) => b.magnitude - a.magnitude).slice(0, 4)
  }, [current, history])

  function handleCopy() {
    if (!current) return
    const impPct = pctChange(curImp, prevImp)
    const follPct = pctChange(curFoll, prevFoll)
    const lines: string[] = [
      `Seeds — Resumen ${shortMonthLabel(current.year, current.month)}`,
      '',
      'OVERVIEW',
      `Impresiones: ${formatNumber(curImp)}${impPct !== null ? ` (${impPct >= 0 ? '+' : ''}${impPct.toFixed(1)}% vs mes ant.)` : ''}`,
      `Seguidores: +${formatNumber(curFoll)}${follPct !== null ? ` (${follPct >= 0 ? '+' : ''}${follPct.toFixed(1)}% vs mes ant.)` : ''}`,
      `Interacciones: ${formatNumber(curInt)}`,
    ]
    if (current.liER) lines.push(`LinkedIn ER: ${formatPercent(current.liER)}`)
    if (current.igER) lines.push(`Instagram ER: ${formatPercent(current.igER)}`)
    if (igTop.length > 0) {
      lines.push('', 'TOP INSTAGRAM')
      igTop.slice(0, 5).forEach((p, i) => {
        lines.push(`${i + 1}. ${p.description || '—'} (${formatNumber(p.views)} views, ${p.er.toFixed(2)}% ER)`)
      })
    }
    if (liTop.length > 0) {
      lines.push('', 'TOP LINKEDIN')
      liTop.slice(0, 5).forEach((p, i) => {
        lines.push(`${i + 1}. ${p.title || '—'} (${formatNumber(p.impressions)} impr., ${p.er.toFixed(2)}% ER)`)
      })
    }
    if (note) {
      lines.push('', 'EN SEEDS LO VEMOS')
      lines.push(note)
    }
    const text = lines.join('\n')
    const doSet = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(doSet).catch(() => fallbackCopy(text, doSet))
    } else {
      fallbackCopy(text, doSet)
    }
  }

  function fallbackCopy(text: string, onSuccess: () => void) {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
    document.body.appendChild(ta)
    ta.focus(); ta.select()
    try { document.execCommand('copy'); onSuccess() } catch {}
    document.body.removeChild(ta)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Overview general{current ? ` — ${shortMonthLabel(current.year, current.month)}` : ''}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { clearCache(); setReloadKey(k => k + 1) }}
            className="presentation-hide p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw size={15} />
          </button>
          {current && (
            <button
              onClick={handleCopy}
              className={`presentation-hide text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {copied ? '✓ Copiado' : 'Copiar resumen'}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <>
          <SkeletonCard chart />
          <SkeletonCard chart />
          <SkeletonCard lines={5} />
        </>
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

          {/* Q banner (collapsible) */}
          {qBanner && (
            <div className="mb-6">
              <button
                onClick={() => setQOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 tracking-wider mb-2 hover:text-indigo-900 transition-colors"
              >
                Q{qBanner.curQ} {qBanner.year}
                {qOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {qOpen && (
                <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="hidden sm:block w-px h-4 bg-indigo-200" />
                  {[
                    { label: 'Impresiones', cur: qBanner.curImpQ, prev: qBanner.prevImpQ },
                    { label: 'Seguidores', cur: qBanner.curFollQ, prev: qBanner.prevFollQ },
                  ].map(({ label, cur, prev }) => {
                    const pct = pctChange(cur, prev)
                    return (
                      <span key={label} className="text-xs text-gray-600">
                        {label}{' '}
                        {pct !== null && (
                          <span className={`font-semibold ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                          </span>
                        )}{' '}
                        <span className="text-gray-400">vs Q{qBanner.prevQNum}</span>
                      </span>
                    )
                  })}
                  {qBanner.curERQ !== null && qBanner.prevERQ !== null && (
                    <span className="text-xs text-gray-600">
                      ER{' '}
                      <span className={`font-semibold ${qBanner.curERQ >= qBanner.prevERQ ? 'text-emerald-600' : 'text-red-500'}`}>
                        {qBanner.curERQ >= qBanner.prevERQ ? '+' : ''}{(qBanner.curERQ - qBanner.prevERQ).toFixed(2)}pp
                      </span>{' '}
                      <span className="text-gray-400">vs Q{qBanner.prevQNum}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Channel comparison */}
          {current && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="text-left py-2 px-4 text-xs font-medium text-gray-400">Canal</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Alcance</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Interacciones</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">ER%</th>
                    <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Nuevos seg.</th>
                    <th className="text-center py-2 px-3 text-xs font-medium text-gray-400">Tend.</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { canal: 'Instagram', alcance: current.igImpressions, interact: current.igInteractions, er: current.igER || null, newFoll: current.igNewFollowers, prevAlcance: prev?.igImpressions, rowCls: 'bg-rose-50/40' },
                    { canal: 'LinkedIn', alcance: current.liImpressions, interact: current.liInteractions, er: current.liER || null, newFoll: current.liNewFollowers, prevAlcance: prev?.liImpressions, rowCls: 'bg-blue-50/40' },
                    { canal: 'TikTok', alcance: current.ttViews, interact: current.ttInteractions, er: null, newFoll: current.ttNewFollowers, prevAlcance: prev?.ttViews, rowCls: '' },
                  ].map(({ canal, alcance, interact, er, newFoll, prevAlcance, rowCls }) => {
                    const trendPct = prevAlcance && prevAlcance > 0 ? ((alcance - prevAlcance) / prevAlcance) * 100 : null
                    const trend = trendPct === null ? '—' : trendPct > 5 ? '↑' : trendPct < -5 ? '↓' : '→'
                    const trendCls = trendPct === null ? 'text-gray-300' : trendPct > 5 ? 'text-emerald-600 font-bold' : trendPct < -5 ? 'text-red-500 font-bold' : 'text-gray-400'
                    return (
                      <tr key={canal} className={`border-b border-gray-50 last:border-0 ${rowCls}`}>
                        <td className="py-2.5 px-4 font-medium text-gray-700 text-xs">{canal}</td>
                        <td className="py-2.5 px-3 text-right text-xs font-medium text-gray-800">{formatNumber(alcance)}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600">{formatNumber(interact)}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600">{er ? `${er.toFixed(2)}%` : '—'}</td>
                        <td className="py-2.5 px-3 text-right text-xs text-gray-600">+{formatNumber(newFoll)}</td>
                        <td className={`py-2.5 px-3 text-center text-sm ${trendCls}`}>{trend}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Anomaly alerts */}
          {anomalyAlerts !== null && (
            <div className="mb-6">
              {anomalyAlerts.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 text-sm text-emerald-700">
                  ✅ Todas las métricas dentro del rango esperado
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {anomalyAlerts.map((alert, i) => {
                    const levelCfg = {
                      positive: { bg: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700', icon: '📈' },
                      warning:  { bg: 'bg-amber-50 border-amber-100',     text: 'text-amber-700',   icon: '⚠️' },
                      critical: { bg: 'bg-red-50 border-red-100',         text: 'text-red-700',     icon: '🔴' },
                      nodata:   { bg: 'bg-gray-50 border-gray-200',       text: 'text-gray-500',    icon: '⚪' },
                    }
                    const cfg = levelCfg[alert.level]
                    const suffix =
                      alert.level === 'nodata'    ? ' sin datos este mes' :
                      alert.level === 'positive'  ? ` +${alert.pct!.toFixed(0)}% vs promedio — mes excepcional` :
                      alert.level === 'critical'  ? ` ${alert.pct!.toFixed(0)}% — caída significativa` :
                                                    ` ${alert.pct!.toFixed(0)}% vs promedio de los últimos 3 meses`
                    return (
                      <div key={i} className={`border rounded-xl px-4 py-2.5 text-sm ${cfg.bg} ${cfg.text}`}>
                        {cfg.icon} {alert.label}{suffix}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

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

          {/* En Seeds lo vemos */}
          {current && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">En Seeds lo vemos</h2>
                <span className="presentation-hide text-xs h-4">
                  {saveStatus === 'saving' && <span className="text-gray-400">Guardando...</span>}
                  {saveStatus === 'saved' && <span className="text-emerald-500">Guardado ✓</span>}
                </span>
              </div>
              <textarea
                value={note}
                onChange={e => handleNoteChange(e.target.value)}
                placeholder="¿Qué aprendimos este mes? Escribí acá tus observaciones..."
                className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm leading-relaxed text-gray-700 placeholder-gray-300 resize-none focus:outline-none focus:border-gray-200 shadow-sm"
                rows={5}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
