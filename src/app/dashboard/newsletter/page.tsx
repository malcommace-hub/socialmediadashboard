'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getNewsletterData, upsertNewsletterMonthly, addNewsletterEpisode, deleteNewsletterEpisode } from '@/lib/queries'
import { formatNumber, currentYearMonth, monthLabel } from '@/lib/utils'
import type { NewsletterEpisode } from '@/lib/types'
import { Trash2, Plus } from 'lucide-react'

export default function NewsletterPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [episodes, setEpisodes] = useState<NewsletterEpisode[]>([])
  const [newSubs, setNewSubs] = useState('')
  const [savedNewSubs, setSavedNewSubs] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newEp, setNewEp] = useState({ episode_number: '', title: '', views: '', lead_magnet_downloads: '', published_date: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getNewsletterData({ year, month })
    setEpisodes(data.episodes)
    setNewSubs(String(data.monthly?.new_subscribers ?? ''))
    setSavedNewSubs(data.monthly?.new_subscribers ?? 0)
    setLoading(false)
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Seeds Business Radar</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">Cargando...</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <StatCard label="Views totales" value={formatNumber(totalViews)} />
            <StatCard label="Episodios" value={String(episodes.length)} />
            <StatCard label="Nuevos suscriptores" value={formatNumber(savedNewSubs)} />
          </div>

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
                    <td className="py-2 px-2 text-gray-700">{ep.title}</td>
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
          </Card>
        </>
      )}
    </div>
  )
}
