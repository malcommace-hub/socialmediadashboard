'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card } from '@/components/ui/card'
import { getYouTubeMonthly, upsertYouTubeMonthly } from '@/lib/queries'
import { formatNumber, currentYearMonth, monthLabel } from '@/lib/utils'
import type { YouTubeMonthly } from '@/lib/types'

export default function YouTubePage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [data, setData] = useState<YouTubeMonthly | null>(null)
  const [loading, setLoading] = useState(true)
  const [views, setViews] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await getYouTubeMonthly({ year, month })
    setData(res.data ?? null)
    setViews(String(res.data?.shorts_views ?? ''))
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function save() {
    setSaving(true)
    await upsertYouTubeMonthly({ year, month, shorts_views: parseInt(views) || 0 })
    await load()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">YouTube Shorts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · @weareseeds_</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Cargando...</div>
      ) : (
        <>
          <div className="mb-6">
            <StatCard label="Views totales (Shorts)" value={formatNumber(data?.shorts_views ?? 0)} />
          </div>

          <Card>
            <div className="text-sm font-semibold text-gray-700 mb-4">Actualizar views del mes</div>
            <div className="flex gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Views totales de Shorts</label>
                <input
                  type="number"
                  value={views}
                  onChange={e => setViews(e.target.value)}
                  placeholder="0"
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                onClick={save}
                disabled={saving}
                className="bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Ingresá el total de views de YouTube Shorts para este mes desde YouTube Studio → Analytics.
            </p>
          </Card>
        </>
      )}
    </div>
  )
}
