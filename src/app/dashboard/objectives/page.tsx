'use client'
import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getObjectives, upsertObjective, getInstagramStats, getLinkedInStats, getTikTokStats } from '@/lib/queries'
import { formatNumber, formatPercent, getQuarter } from '@/lib/utils'
import type { Objective } from '@/lib/types'

const CHANNELS = ['instagram', 'linkedin', 'tiktok', 'youtube', 'web']
const METRICS: Record<string, { key: string; label: string; format: (v: number) => string }[]> = {
  instagram: [
    { key: 'impressions', label: 'Impresiones', format: formatNumber },
    { key: 'followers', label: 'Seguidores', format: formatNumber },
    { key: 'er', label: 'ER%', format: v => formatPercent(v) },
  ],
  linkedin: [
    { key: 'impressions', label: 'Impresiones', format: formatNumber },
    { key: 'followers', label: 'Seguidores', format: formatNumber },
    { key: 'er', label: 'ER%', format: v => formatPercent(v) },
  ],
  tiktok: [
    { key: 'views', label: 'Views', format: formatNumber },
    { key: 'followers', label: 'Seguidores', format: formatNumber },
  ],
  youtube: [
    { key: 'views', label: 'Views Shorts', format: formatNumber },
  ],
  web: [
    { key: 'sessions', label: 'Sesiones', format: formatNumber },
  ],
}

const CHANNEL_COLORS: Record<string, string> = {
  instagram: 'border-l-rose-500',
  linkedin: 'border-l-blue-600',
  tiktok: 'border-l-gray-900',
  youtube: 'border-l-red-600',
  web: 'border-l-emerald-500',
}

export default function ObjectivesPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarter = getQuarter(now.getMonth() + 1)

  const [year, setYear] = useState(currentYear)
  const [quarter, setQuarter] = useState(currentQuarter)
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [editing, setEditing] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [actuals, setActuals] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    const res = await getObjectives(year, quarter)
    setObjectives(res.data ?? [])
    const vals: Record<string, string> = {}
    ;(res.data ?? []).forEach(obj => {
      vals[`${obj.channel}_${obj.metric}`] = String(obj.target_value)
    })
    setEditing(vals)
  }, [year, quarter])

  // Load quarter actuals (sum across 3 months)
  const loadActuals = useCallback(async () => {
    const startMonth = (quarter - 1) * 3 + 1
    const months = [startMonth, startMonth + 1, startMonth + 2]

    const igResults = await Promise.all(months.map(m => getInstagramStats({ year, month: m })))
    const liResults = await Promise.all(months.map(m => getLinkedInStats({ year, month: m })))
    const ttResults = await Promise.all(months.map(m => getTikTokStats({ year, month: m })))

    const computed: Record<string, number> = {
      'instagram_impressions': igResults.reduce((a, r) => a + r.totalImpressions, 0),
      'instagram_followers': igResults.at(-1)?.monthly?.total_followers ?? 0,
      'instagram_er': igResults.reduce((a, r) => a + r.avgER, 0) / 3,
      'linkedin_impressions': liResults.reduce((a, r) => a + r.totalImpressions, 0),
      'linkedin_followers': liResults.at(-1)?.monthly?.total_followers ?? 0,
      'linkedin_er': liResults.reduce((a, r) => a + r.avgER, 0) / 3,
      'tiktok_views': ttResults.reduce((a, r) => a + r.totalViews, 0),
      'tiktok_followers': ttResults.at(-1)?.monthly?.total_followers ?? 0,
    }
    setActuals(computed)
  }, [year, quarter])

  useEffect(() => {
    load()
    loadActuals()
  }, [load, loadActuals])

  async function save() {
    setSaving(true)
    await Promise.all(
      Object.entries(editing).map(([key, value]) => {
        const [channel, metric] = key.split('_')
        return upsertObjective({ year, quarter, channel, metric, target_value: parseFloat(value) || 0 })
      })
    )
    await load()
    setSaving(false)
  }

  function getTarget(channel: string, metric: string): number {
    const key = `${channel}_${metric}`
    return parseFloat(editing[key] || '0') || 0
  }

  function getActual(channel: string, metric: string): number {
    return actuals[`${channel}_${metric}`] ?? 0
  }

  function pct(actual: number, target: number): number {
    if (!target) return 0
    return Math.min((actual / target) * 100, 100)
  }

  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Objetivos por trimestre</h1>
          <p className="text-gray-500 text-sm mt-0.5">Seguimiento Q vs Q · Editá los targets directamente</p>
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

      <div className="space-y-4 mb-6">
        {CHANNELS.filter(ch => METRICS[ch]).map(channel => (
          <Card key={channel} className={`border-l-4 ${CHANNEL_COLORS[channel]}`}>
            <CardHeader>
              <CardTitle className="capitalize">{channel}</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              {METRICS[channel].map(({ key, label, format }) => {
                const target = getTarget(channel, key)
                const actual = getActual(channel, key)
                const progress = pct(actual, target)
                const editKey = `${channel}_${key}`

                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">{label}</span>
                        <span className="text-sm font-semibold">{format(actual)}</span>
                        <span className="text-xs text-gray-400">de</span>
                        <input
                          type="number"
                          value={editing[editKey] ?? ''}
                          onChange={e => setEditing(v => ({ ...v, [editKey]: e.target.value }))}
                          placeholder="Target"
                          className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <span className={`text-sm font-bold ${progress >= 100 ? 'text-emerald-600' : progress >= 70 ? 'text-amber-500' : 'text-gray-400'}`}>
                        {target > 0 ? `${progress.toFixed(0)}%` : '—'}
                      </span>
                    </div>
                    {target > 0 && (
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-amber-400' : 'bg-gray-300'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      <button onClick={save} disabled={saving}
        className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
        {saving ? 'Guardando...' : 'Guardar todos los targets'}
      </button>
    </div>
  )
}
