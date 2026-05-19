'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTikTokStats, deleteTikTokVideo, upsertTikTokMonthly, addTikTokVideoManual } from '@/lib/queries'
import { formatNumber, currentYearMonth, monthLabel } from '@/lib/utils'
import type { TikTokStats } from '@/lib/types'
import { Trash2, ExternalLink, Plus, ChevronUp, ChevronDown } from 'lucide-react'

type SortKey = 'views' | 'likes' | 'comments' | 'shares'
type SortDir = 'asc' | 'desc'

export default function TikTokPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [stats, setStats] = useState<TikTokStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editMonthly, setEditMonthly] = useState(false)
  const [followers, setFollowers] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [saving, setSaving] = useState(false)
  const [newVideo, setNewVideo] = useState({ title: '', video_date: '', views: '', likes: '', comments: '', shares: '', permalink: '' })
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getTikTokStats({ year, month })
    setStats(data)
    setFollowers(String(data.monthly?.total_followers ?? ''))
    setNewFollowers(String(data.monthly?.new_followers ?? ''))
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(new Set()) }, [year, month])

  async function saveMonthly() {
    setSaving(true)
    await upsertTikTokMonthly({ year, month, total_followers: parseInt(followers) || 0, new_followers: parseInt(newFollowers) || 0 })
    await load()
    setEditMonthly(false)
    setSaving(false)
  }

  async function saveVideo() {
    if (!newVideo.title && !newVideo.permalink) return
    setSaving(true)
    await addTikTokVideoManual({
      year, month,
      title: newVideo.title || null,
      video_date: newVideo.video_date || null,
      views: parseInt(newVideo.views) || 0,
      likes: parseInt(newVideo.likes) || 0,
      comments: parseInt(newVideo.comments) || 0,
      shares: parseInt(newVideo.shares) || 0,
      permalink: newVideo.permalink || null,
      is_manual: true,
    })
    setNewVideo({ title: '', video_date: '', views: '', likes: '', comments: '', shares: '', permalink: '' })
    setShowAddForm(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este video?')) return
    await deleteTikTokVideo(id)
    await load()
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll(items: { id: string }[]) {
    setSelected(s => s.size === items.length && items.length > 0 ? new Set() : new Set(items.map(x => x.id)))
  }
  async function handleDeleteSelected() {
    if (!confirm(`¿Eliminar ${selected.size} elemento(s)? Esta acción no se puede deshacer.`)) return
    await Promise.all([...selected].map(id => deleteTikTokVideo(id)))
    setSelected(new Set())
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const videos = stats?.videos ?? []
  const sorted = [...videos].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TikTok</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · @weareseeds_</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Views totales" value={formatNumber(stats?.totalViews ?? 0)} />
            <StatCard label="Interacciones" value={formatNumber(stats?.totalInteractions ?? 0)} />
            <StatCard label="Videos del mes" value={String(videos.length)} />
          </div>

          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Seguidores del mes</CardTitle>
              <button onClick={() => setEditMonthly(!editMonthly)} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                {editMonthly ? 'Cancelar' : 'Editar'}
              </button>
            </div>
            {editMonthly ? (
              <div className="flex gap-3 items-end">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Total seguidores</label>
                  <input type="number" value={followers} onChange={e => setFollowers(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nuevos seguidores</label>
                  <input type="number" value={newFollowers} onChange={e => setNewFollowers(e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <button onClick={saveMonthly} disabled={saving}
                  className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            ) : (
              <div className="flex gap-8">
                <div>
                  <div className="text-2xl font-bold">{formatNumber(stats?.monthly?.total_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Seguidores totales</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">+{formatNumber(stats?.monthly?.new_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Nuevos este mes</div>
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Videos del mes ({videos.length})</CardTitle>
              <div className="flex gap-2">
                {selected.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400"
                  >
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400">
                  <Plus size={13} /> Agregar manual
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Nuevo video manual</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Título del video</label>
                    <input type="text" value={newVideo.title} onChange={e => setNewVideo(v => ({ ...v, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                    <input type="date" value={newVideo.video_date} onChange={e => setNewVideo(v => ({ ...v, video_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {['views', 'likes', 'comments', 'shares'].map(f => (
                    <div key={f}>
                      <label className="text-xs text-gray-500 block mb-1 capitalize">{f}</label>
                      <input type="number" value={newVideo[f as keyof typeof newVideo]} onChange={e => setNewVideo(v => ({ ...v, [f]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Link del video</label>
                    <input type="text" placeholder="https://tiktok.com/@..." value={newVideo.permalink} onChange={e => setNewVideo(v => ({ ...v, permalink: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveVideo} disabled={saving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar video'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="w-8 py-2 px-2">
                      <input
                        type="checkbox"
                        className="rounded"
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sorted.length }}
                        checked={sorted.length > 0 && selected.size === sorted.length}
                        onChange={() => toggleSelectAll(sorted)}
                      />
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('views')}>
                      <span className="flex items-center justify-end gap-1">Views <SortIcon k="views" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('likes')}>
                      <span className="flex items-center justify-end gap-1">Likes <SortIcon k="likes" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('comments')}>
                      <span className="flex items-center justify-end gap-1">Comments <SortIcon k="comments" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('shares')}>
                      <span className="flex items-center justify-end gap-1">Shares <SortIcon k="shares" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-sm">No hay videos. Subí el CSV de TikTok Studio o agregá uno manual.</td></tr>
                  )}
                  {sorted.map(v => (
                    <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(v.id)} onChange={() => toggleSelect(v.id)} />
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        <div className="text-gray-700 truncate">{v.title || '(sin título)'}</div>
                        {v.is_manual && <Badge variant="manual">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{v.video_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatNumber(v.views)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(v.likes)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(v.comments)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(v.shares)}</td>
                      <td className="py-2 px-2 text-right">
                        {v.permalink ? <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={14} /></a> : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDelete(v.id)} className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
