'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getInstagramStats, deleteInstagramPost, upsertInstagramMonthly, addInstagramPostManual } from '@/lib/queries'
import { formatNumber, formatPercent, currentYearMonth, monthLabel } from '@/lib/utils'
import type { InstagramStats, InstagramPost } from '@/lib/types'
import { Trash2, ExternalLink, Plus, ChevronUp, ChevronDown } from 'lucide-react'

type SortKey = 'views' | 'impressions' | 'likes' | 'er'
type SortDir = 'asc' | 'desc'

function erForPost(p: InstagramPost): number {
  if (!p.impressions) return 0
  return ((p.likes + p.comments + p.shares + p.saves) / p.impressions) * 100
}

export default function InstagramPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [stats, setStats] = useState<InstagramStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterType, setFilterType] = useState<string>('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editMonthly, setEditMonthly] = useState(false)
  const [saving, setSaving] = useState(false)

  // Monthly form state
  const [followers, setFollowers] = useState('')
  const [newFollowers, setNewFollowers] = useState('')

  // New post form state
  const [newPost, setNewPost] = useState({
    type: 'Reel' as InstagramPost['type'],
    description: '',
    post_date: '',
    views: '',
    impressions: '',
    likes: '',
    comments: '',
    shares: '',
    saves: '',
    permalink: '',
    collab_account: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getInstagramStats({ year, month })
    setStats(data)
    setFollowers(String(data.monthly?.total_followers ?? ''))
    setNewFollowers(String(data.monthly?.new_followers ?? ''))
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function saveMonthly() {
    setSaving(true)
    await upsertInstagramMonthly({
      year, month,
      total_followers: parseInt(followers) || 0,
      new_followers: parseInt(newFollowers) || 0,
    })
    await load()
    setEditMonthly(false)
    setSaving(false)
  }

  async function saveNewPost() {
    if (!newPost.description && !newPost.permalink) return
    setSaving(true)
    await addInstagramPostManual({
      year, month,
      type: newPost.type,
      description: newPost.description || null,
      post_date: newPost.post_date || null,
      views: parseInt(newPost.views) || 0,
      impressions: parseInt(newPost.impressions) || 0,
      likes: parseInt(newPost.likes) || 0,
      comments: parseInt(newPost.comments) || 0,
      shares: parseInt(newPost.shares) || 0,
      saves: parseInt(newPost.saves) || 0,
      permalink: newPost.permalink || null,
      collab_account: newPost.collab_account || null,
      is_manual: true,
    })
    setShowAddForm(false)
    setNewPost({ type: 'Reel', description: '', post_date: '', views: '', impressions: '', likes: '', comments: '', shares: '', saves: '', permalink: '', collab_account: '' })
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este post? Las métricas se recalcularán automáticamente.')) return
    await deleteInstagramPost(id)
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const posts = stats?.posts ?? []
  const filtered = filterType === 'all' ? posts : posts.filter(p => p.type === filterType)
  const sorted = [...filtered].sort((a, b) => {
    let av = 0, bv = 0
    if (sortKey === 'views') { av = a.views; bv = b.views }
    else if (sortKey === 'impressions') { av = a.impressions; bv = b.impressions }
    else if (sortKey === 'likes') { av = a.likes; bv = b.likes }
    else if (sortKey === 'er') { av = erForPost(a); bv = erForPost(b) }
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instagram</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · @weareseeds_</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Views totales" value={formatNumber(stats?.totalViews ?? 0)} />
            <StatCard label="Impresiones" value={formatNumber(stats?.totalImpressions ?? 0)} />
            <StatCard label="Interacciones" value={formatNumber(stats?.totalInteractions ?? 0)} />
            <StatCard label="ER% promedio" value={formatPercent(stats?.avgER ?? 0)} />
          </div>

          {/* Followers card (editable) */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Seguidores del mes</CardTitle>
              <button
                onClick={() => setEditMonthly(!editMonthly)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
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
                  <div className="text-2xl font-bold text-gray-900">{formatNumber(stats?.monthly?.total_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Seguidores totales</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">+{formatNumber(stats?.monthly?.new_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Nuevos este mes</div>
                </div>
              </div>
            )}
          </Card>

          {/* Posts table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Contenido del mes ({posts.length} posts)</CardTitle>
              <div className="flex gap-2">
                {/* Type filter */}
                <div className="flex gap-1">
                  {['all', 'Reel', 'Post', 'Collab', 'Story'].map(t => (
                    <button key={t}
                      onClick={() => setFilterType(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {t === 'all' ? 'Todos' : t}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400">
                  <Plus size={13} /> Agregar manual
                </button>
              </div>
            </div>

            {/* Add form */}
            {showAddForm && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Nuevo post manual</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                    <select value={newPost.type} onChange={e => setNewPost(p => ({ ...p, type: e.target.value as InstagramPost['type'] }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {['Reel', 'Post', 'Collab', 'Story'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                    <input type="date" value={newPost.post_date} onChange={e => setNewPost(p => ({ ...p, post_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                    <input type="text" placeholder="Descripción del post" value={newPost.description} onChange={e => setNewPost(p => ({ ...p, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {['views', 'impressions', 'likes', 'comments', 'shares', 'saves'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-gray-500 block mb-1 capitalize">{field}</label>
                      <input type="number" value={newPost[field as keyof typeof newPost]} onChange={e => setNewPost(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Permalink (URL)</label>
                    <input type="text" placeholder="https://instagram.com/..." value={newPost.permalink} onChange={e => setNewPost(p => ({ ...p, permalink: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cuenta collab</label>
                    <input type="text" placeholder="@sofijobs" value={newPost.collab_account} onChange={e => setNewPost(p => ({ ...p, collab_account: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveNewPost} disabled={saving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar post'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Tipo</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Descripción</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('views')}>
                      <span className="flex items-center justify-end gap-1">Views <SortIcon k="views" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('impressions')}>
                      <span className="flex items-center justify-end gap-1">Impr. <SortIcon k="impressions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('likes')}>
                      <span className="flex items-center justify-end gap-1">Likes <SortIcon k="likes" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('er')}>
                      <span className="flex items-center justify-end gap-1">ER% <SortIcon k="er" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                      No hay posts para este mes. Subí un CSV o agregá uno manual.
                    </td></tr>
                  )}
                  {sorted.map(post => (
                    <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2">
                        <Badge variant={post.type.toLowerCase() as 'reel' | 'post' | 'collab' | 'story'}>
                          {post.type}
                        </Badge>
                        {post.is_manual && <Badge variant="manual" className="ml-1">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        <div className="text-gray-700 truncate">{post.description || '—'}</div>
                        {post.collab_account && (
                          <div className="text-xs text-orange-600 font-medium">{post.collab_account}</div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium text-gray-800">{formatNumber(post.views)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.impressions)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.likes)}</td>
                      <td className="py-2 px-2 text-right font-medium text-emerald-600">{formatPercent(erForPost(post))}</td>
                      <td className="py-2 px-2 text-right">
                        {post.permalink ? (
                          <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600 inline-flex">
                            <ExternalLink size={14} />
                          </a>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDelete(post.id)}
                          className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
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
