'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getWebData, upsertWebMonthly, upsertWebUtmSource } from '@/lib/queries'
import { formatNumber, currentYearMonth, monthLabel } from '@/lib/utils'
import type { WebMonthly, WebUtmSource } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const UTM_SOURCES = ['instagram', 'linkedin', 'tiktok', 'linktree', 'other']

export default function WebPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [monthly, setMonthly] = useState<WebMonthly | null>(null)
  const [utmSources, setUtmSources] = useState<WebUtmSource[]>([])
  const [loading, setLoading] = useState(true)
  const [totalSessions, setTotalSessions] = useState('')
  const [utmValues, setUtmValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getWebData({ year, month })
    setMonthly(data.monthly)
    setUtmSources(data.utmSources)
    setTotalSessions(String(data.monthly?.total_sessions ?? ''))
    const vals: Record<string, string> = {}
    UTM_SOURCES.forEach(s => {
      const found = data.utmSources.find(u => u.source === s)
      vals[s] = String(found?.sessions ?? '')
    })
    setUtmValues(vals)
    setLoading(false)
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

  const chartData = UTM_SOURCES.map(s => ({
    source: s.charAt(0).toUpperCase() + s.slice(1),
    sessions: parseInt(utmValues[s] || '0') || 0,
  })).filter(d => d.sessions > 0)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Web / Webflow</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Tráfico orgánico social</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Cargando...</div>
      ) : (
        <>
          <div className="mb-6">
            <StatCard label="Sesiones totales" value={formatNumber(monthly?.total_sessions ?? 0)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Sesiones por fuente UTM</CardTitle></CardHeader>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="sessions" name="Sesiones" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
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
                      <label className="text-sm text-gray-600 w-24 capitalize">{s}</label>
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
