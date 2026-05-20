'use client'
import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import {
  getObjectives, upsertObjective,
  getInstagramHistory, getLinkedInHistory, getTikTokHistory,
} from '@/lib/queries'
import { formatNumber, getQuarter } from '@/lib/utils'
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'

// ─── Helpers ─────────────────────────────────────────────────

function prevQInfo(year: number, q: number): { year: number; q: number } {
  return q === 1 ? { year: year - 1, q: 4 } : { year, q: q - 1 }
}

function qLabel(year: number, q: number) {
  return `Q${q} ${year}`
}

interface QResult {
  actual: number
  projection: number
  projected: number
  loadedMonths: number
}

function computeQ(monthMap: Record<string, number>, year: number, q: number): QResult {
  const start = (q - 1) * 3 + 1
  const values = [start, start + 1, start + 2].map(m => monthMap[`${year}-${m}`] ?? 0)
  const loaded = values.filter(v => v > 0)
  const actual = values.reduce((s, v) => s + v, 0)
  let projection = 0
  if (loaded.length > 0 && loaded.length < 3) {
    const avg = loaded.reduce((s, v) => s + v, 0) / loaded.length
    projection = avg * (3 - loaded.length)
  }
  return { actual, projection, projected: actual + projection, loadedMonths: loaded.length }
}

// ─── Metric definitions ──────────────────────────────────────

const METRICS = [
  { id: 'ig_views',        channel: 'instagram', metric: 'views',        label: 'Instagram Views',       color: '#f43f5e' },
  { id: 'ig_new_followers',channel: 'instagram', metric: 'new_followers', label: 'IG Nuevos Seguidores',  color: '#ec4899' },
  { id: 'tt_views',        channel: 'tiktok',    metric: 'views',        label: 'TikTok Views',          color: '#374151' },
  { id: 'li_impressions',  channel: 'linkedin',  metric: 'impressions',  label: 'LinkedIn Impresiones',  color: '#3b82f6' },
]

// ─── Metric Q card ───────────────────────────────────────────

interface MetricQCardProps {
  label: string
  color: string
  monthMap: Record<string, number>
  target: number
  onTargetChange: (v: string) => void
  year: number
  quarter: number
}

function MetricQCard({ label, color, monthMap, target, onTargetChange, year, quarter }: MetricQCardProps) {
  const pq = prevQInfo(year, quarter)
  const prev = computeQ(monthMap, pq.year, pq.q)
  const curr = computeQ(monthMap, year, quarter)

  const chartData = [
    { label: qLabel(pq.year, pq.q), actual: prev.actual, proj: 0,                          total: prev.actual          },
    { label: qLabel(year, quarter), actual: curr.actual, proj: Math.round(curr.projection), total: Math.round(curr.projected) },
  ]

  const progress = target > 0 ? Math.min((curr.actual / target) * 100, 100) : 0

  return (
    <Card>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{formatNumber(curr.actual)}</span>
            {curr.projection > 0 && (
              <span className="text-xs text-gray-400">
                → <span className="text-gray-500 font-medium">{formatNumber(curr.projected)}</span> proy.
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-400">Target:</span>
          <input
            type="number"
            value={target || ''}
            onChange={e => onTargetChange(e.target.value)}
            placeholder="—"
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-right"
          />
          {target > 0 && (
            <span className={`text-sm font-bold w-10 text-right tabular-nums ${
              progress >= 100 ? 'text-emerald-600' : progress >= 70 ? 'text-amber-500' : 'text-gray-400'
            }`}>
              {progress.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {target > 0 && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: color }}
          />
        </div>
      )}

      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={chartData} barCategoryGap="38%" margin={{ top: 22, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={46} />
          <Tooltip
            formatter={(v, name) => [formatNumber(Number(v)), name as string]}
            contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="actual" name="Real" stackId="a" fill={color} radius={[0, 0, 0, 0]} />
          <Bar dataKey="proj" name="Proyección" stackId="a" fill="#e2e8f0" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="total"
              position="top"
              style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }}
              formatter={(v: unknown) => Number(v) > 0 ? formatNumber(Number(v)) : ''}
            />
          </Bar>
          {target > 0 && (
            <ReferenceLine
              y={target}
              stroke={color}
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: `Target: ${formatNumber(target)}`, position: 'insideTopRight', fill: color, fontSize: 10 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {curr.projection > 0 && (
        <div className="text-xs text-gray-400 mt-1.5">
          Gris: prom. de {curr.loadedMonths} {curr.loadedMonths === 1 ? 'mes' : 'meses'} × {3 - curr.loadedMonths} mes{3 - curr.loadedMonths > 1 ? 'es' : ''} restante{3 - curr.loadedMonths > 1 ? 's' : ''}
        </div>
      )}
    </Card>
  )
}

// ─── Main page ───────────────────────────────────────────────

export default function ObjectivesPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarter = getQuarter(now.getMonth() + 1)

  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(currentQuarter)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [monthMaps, setMonthMaps] = useState<Record<string, Record<string, number>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [igHist, liHist, ttHist, objRes] = await Promise.all([
      getInstagramHistory(),
      getLinkedInHistory(),
      getTikTokHistory(),
      getObjectives(year, quarter),
    ])

    setMonthMaps({
      ig_views:         Object.fromEntries(igHist.map(d => [`${d.year}-${d.month}`, d.views])),
      ig_new_followers: Object.fromEntries(igHist.map(d => [`${d.year}-${d.month}`, d.newFollowers])),
      tt_views:         Object.fromEntries(ttHist.map(d => [`${d.year}-${d.month}`, d.views])),
      li_impressions:   Object.fromEntries(liHist.map(d => [`${d.year}-${d.month}`, d.impressions])),
    })

    const vals: Record<string, string> = {}
    ;(objRes.data ?? []).forEach(obj => {
      const found = METRICS.find(m => m.channel === obj.channel && m.metric === obj.metric)
      if (found) vals[found.id] = String(obj.target_value)
    })
    setTargets(vals)
    setLoading(false)
  }, [year, quarter])

  useEffect(() => { loadAll() }, [loadAll])

  async function save() {
    setSaving(true)
    await Promise.all(
      METRICS.map(m =>
        upsertObjective({
          year, quarter,
          channel: m.channel,
          metric: m.metric,
          target_value: parseFloat(targets[m.id] || '0') || 0,
        })
      )
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objetivos Q</h1>
          <p className="text-gray-500 text-sm mt-0.5">Seguimiento trimestral · ingresá targets y mirá proyección</p>
        </div>
        <div className="flex gap-2">
          <select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {METRICS.map(m => (
              <MetricQCard
                key={m.id}
                label={m.label}
                color={m.color}
                monthMap={monthMaps[m.id] ?? {}}
                target={parseFloat(targets[m.id] || '0') || 0}
                onTargetChange={v => setTargets(prev => ({ ...prev, [m.id]: v }))}
                year={year}
                quarter={quarter}
              />
            ))}
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar targets'}
          </button>
        </>
      )}
    </div>
  )
}
