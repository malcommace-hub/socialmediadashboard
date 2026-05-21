'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getInstagramStats, getInstagramHistory, deleteInstagramPost,
  upsertInstagramMonthly, addInstagramPostManual,
} from '@/lib/queries'
import { formatNumber, formatPercent, currentYearMonth, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import type { InstagramStats, InstagramPost } from '@/lib/types'
import { Trash2, ExternalLink, Plus, ChevronUp, ChevronDown, PencilLine, Upload } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area,
} from 'recharts'
import Link from 'next/link'

type HistoryPoint = Awaited<ReturnType<typeof getInstagramHistory>>[0]

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

type SortKey = 'views' | 'likes' | 'er'
type SortDir = 'asc' | 'desc'

function erForPost(p: InstagramPost): number {
  if (!p.impressions) return 0
  return ((p.likes + p.comments + p.shares + p.saves) / p.impressions) * 100
}

const emptyNewPost = {
  type: 'Collab' as InstagramPost['type'],
  description: '', post_date: '',
  views: '', likes: '', comments: '', shares: '', saves: '',
  permalink: '', collab_account: '',
}

export default function InstagramPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [stats, setStats] = useState<InstagramStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterType, setFilterType] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAddCollabForm, setShowAddCollabForm] = useState(false)
  const [editMonthly, setEditMonthly] = useState(false)
  const [saving, setSaving] = useState(false)

  // Monthly manual fields
  const [followers, setFollowers] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [viewsApp, setViewsApp] = useState('')      // from Meta app overview
  const [reachApp, setReachApp] = useState('')       // accounts reached

  // New regular post
  const [newPost, setNewPost] = useState({ ...emptyNewPost, type: 'Reel' as InstagramPost['type'] })

  // New external collab
  const [newCollab, setNewCollab] = useState({ ...emptyNewPost })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, hist] = await Promise.all([
        getInstagramStats({ year, month }),
        getInstagramHistory(),
      ])
      setStats(data)
      setHistory(hist)
      setFollowers(String(data.monthly?.total_followers ?? ''))
      setNewFollowers(String(data.monthly?.new_followers ?? ''))
      setViewsApp(String(data.monthly?.total_views_manual ?? ''))
      setReachApp(String(data.monthly?.total_reach_manual ?? ''))
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos de Instagram')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(new Set()) }, [year, month])

  async function saveMonthly() {
    setSaving(true)
    await upsertInstagramMonthly({
      year, month,
      total_followers: parseInt(followers) || 0,
      new_followers: parseInt(newFollowers) || 0,
      total_views_manual: parseInt(viewsApp) || 0,
      total_reach_manual: parseInt(reachApp) || 0,
    })
    await load()
    setEditMonthly(false)
    setSaving(false)
  }

  async function savePost(isCollab: boolean) {
    const src = isCollab ? newCollab : newPost
    if (!src.description && !src.permalink) return
    setSaving(true)
    await addInstagramPostManual({
      year, month,
      type: isCollab ? 'Collab' : src.type,
      description: src.description || null,
      post_date: src.post_date || null,
      views: parseInt(src.views) || 0,
      impressions: parseInt(src.views) || 0,
      likes: parseInt(src.likes) || 0,
      comments: parseInt(src.comments) || 0,
      shares: parseInt(src.shares) || 0,
      saves: parseInt(src.saves) || 0,
      permalink: src.permalink || null,
      collab_account: src.collab_account || null,
      is_manual: true,
    })
    if (isCollab) { setNewCollab({ ...emptyNewPost }); setShowAddCollabForm(false) }
    else { setNewPost({ ...emptyNewPost, type: 'Reel' }); setShowAddForm(false) }
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este post? Las métricas se recalcularán automáticamente.')) return
    await deleteInstagramPost(id)
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
    await Promise.all([...selected].map(id => deleteInstagramPost(id)))
    setSelected(new Set())
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const posts = stats?.posts ?? []
  const externalCollabs = posts.filter(p => p.is_manual && p.type === 'Collab')
  const regularPosts = posts.filter(p => !(p.is_manual && p.type === 'Collab'))
  const filtered = filterType === 'all' ? regularPosts : regularPosts.filter(p => p.type === filterType)
  const sorted = [...filtered].sort((a, b) => {
    let av = 0, bv = 0
    if (sortKey === 'views') { av = a.views; bv = b.views }
    else if (sortKey === 'likes') { av = a.likes; bv = b.likes }
    else if (sortKey === 'er') { av = erForPost(a); bv = erForPost(b) }
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  const grandTotal = stats?.grandTotalViews ?? 0
  const collabViewsSum = stats?.externalCollabViews ?? 0
  const appViews = stats?.monthly?.total_views_manual ?? 0

  const histLast = history.slice(-12)
  const curH = history.find(d => d.year === year && d.month === month)
  const prevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return history.find(d => d.year === pm.y && d.month === pm.m)
  })()
  const qPrevH = (() => {
    let m = month - 3, y = year
    if (m <= 0) { m += 12; y-- }
    return history.find(d => d.year === y && d.month === m)
  })()

  const viewsChart = useMemo(() => {
    const vals = histLast.map(d => d.views)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.views, ma: ma[i] }))
  }, [histLast])
  const intChart = useMemo(() => {
    const vals = histLast.map(d => d.interactions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.interactions, ma: ma[i] }))
  }, [histLast])
  const follChart = useMemo(() => {
    const vals = histLast.map(d => d.newFollowers)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.newFollowers, ma: ma[i] }))
  }, [histLast])
  const erChart = useMemo(() => {
    const vals = histLast.map(d => d.er)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: +d.er.toFixed(2), ma: ma[i] ? +ma[i]!.toFixed(2) : null }))
  }, [histLast])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Instagram — @weareseeds_</h1>
            <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · {formatNumber(stats?.monthly?.total_followers ?? 0)} followers</p>
          </div>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠ {error}
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          {/* KPI trend cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Views / Impr.', val: grandTotal, prev: prevH?.views, qPrev: qPrevH?.views, fmt: formatNumber,
                sub: collabViewsSum > 0 ? `App ${formatNumber(appViews)} + Collabs ${formatNumber(collabViewsSum)}` : undefined },
              { label: 'Interacciones', val: stats?.totalInteractions ?? 0, prev: prevH?.interactions, qPrev: qPrevH?.interactions, fmt: formatNumber },
              { label: 'Engagement %', val: stats?.avgER ?? 0, prev: prevH?.er, qPrev: qPrevH?.er, fmt: (v: number) => formatPercent(v) },
              { label: 'Nuevos seguidores', val: stats?.monthly?.new_followers ?? 0, prev: prevH?.newFollowers, qPrev: qPrevH?.newFollowers, fmt: (v: number) => `+${formatNumber(v)}` },
            ].map(({ label, val, prev, qPrev, fmt, sub }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(val)}</div>
                {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
                <div className="flex gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={prev} />
                    <span className="ml-1">vs mes ant.</span>
                  </span>
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={qPrev} />
                    <span className="ml-1">vs Q ant.</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Historical charts */}
          {histLast.length >= 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {[
                { title: 'Impresiones / Views', data: viewsChart, color: '#f43f5e', gradId: 'igViewsGrad' },
                { title: 'Nuevos seguidores', data: follChart, color: '#fb923c', gradId: 'igFollGrad' },
                { title: 'Interacciones', data: intChart, color: '#f43f5e', gradId: 'igIntGrad' },
                { title: 'Engagement %', data: erChart, color: '#e11d48', gradId: 'igErGrad', isPercent: true },
              ].map(({ title, data, color, gradId, isPercent }) => (
                <div key={title} className={chartCardCls}>
                  <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">{title}</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => isPercent ? `${v}%` : formatNumber(Number(v))} axisLine={false} tickLine={false} width={isPercent ? 32 : 44} />
                      <Tooltip formatter={(v, n) => [isPercent ? `${Number(v).toFixed(2)}%` : formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="value" name={title} stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="ma" name="Media 3m" stroke={color} strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          {/* Monthly manual data card */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Datos del mes (desde la app)</CardTitle>
              <button onClick={() => setEditMonthly(!editMonthly)}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <PencilLine size={12} /> {editMonthly ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {editMonthly ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Views totales (app)
                    <span className="ml-1 text-gray-400 cursor-help" title="Ingresá el total del Meta overview. No incluyas posts de colaboraciones externas — esos se agregan automáticamente.">ⓘ</span>
                  </label>
                  <input type="number" value={viewsApp} onChange={e => setViewsApp(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Accounts reached</label>
                  <input type="number" value={reachApp} onChange={e => setReachApp(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Seguidores totales</label>
                  <input type="number" value={followers} onChange={e => setFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nuevos seguidores</label>
                  <input type="number" value={newFollowers} onChange={e => setNewFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="col-span-2 lg:col-span-4 flex gap-2 pt-1">
                  <button onClick={saveMonthly} disabled={saving}
                    className="bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-8">
                <div>
                  <div className="text-2xl font-bold">{formatNumber(appViews)}</div>
                  <div className="text-xs text-gray-400">Views (app)</div>
                </div>
                {collabViewsSum > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-orange-500">+{formatNumber(collabViewsSum)}</div>
                    <div className="text-xs text-gray-400">Collabs externos</div>
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{formatNumber(grandTotal)}</div>
                  <div className="text-xs text-gray-400">Total reportado</div>
                </div>
                <div className="border-l border-gray-100 pl-8">
                  <div className="text-2xl font-bold">{formatNumber(stats?.monthly?.total_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Seguidores</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">+{formatNumber(stats?.monthly?.new_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Nuevos este mes</div>
                </div>
              </div>
            )}
          </Card>

          {/* External collabs section */}
          <Card className="mb-6 border-l-4 border-l-orange-400">
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle>Collabs externos</CardTitle>
                <p className="text-xs text-gray-400 mt-1">
                  Contenidos subidos por influencers donde Seeds figura como colaborador.
                  Sus views se suman automáticamente al total.
                </p>
              </div>
              <button onClick={() => setShowAddCollabForm(!showAddCollabForm)}
                className="flex items-center gap-1 text-xs bg-orange-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-orange-400">
                <Plus size={13} /> Agregar collab
              </button>
            </div>

            {showAddCollabForm && (
              <div className="bg-orange-50 rounded-xl p-4 mb-4 border border-orange-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Nuevo contenido collab externo</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Descripción / título del post</label>
                    <input type="text" placeholder="Descripción del contenido"
                      value={newCollab.description} onChange={e => setNewCollab(v => ({ ...v, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cuenta del influencer</label>
                    <input type="text" placeholder="@patriciajebsen"
                      value={newCollab.collab_account} onChange={e => setNewCollab(v => ({ ...v, collab_account: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                    <input type="date" value={newCollab.post_date} onChange={e => setNewCollab(v => ({ ...v, post_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Views</label>
                    <input type="number" value={newCollab.views} onChange={e => setNewCollab(v => ({ ...v, views: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Likes</label>
                    <input type="number" value={newCollab.likes} onChange={e => setNewCollab(v => ({ ...v, likes: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Comentarios</label>
                    <input type="number" value={newCollab.comments} onChange={e => setNewCollab(v => ({ ...v, comments: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Link del post</label>
                    <input type="text" placeholder="https://instagram.com/..."
                      value={newCollab.permalink} onChange={e => setNewCollab(v => ({ ...v, permalink: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => savePost(true)} disabled={saving}
                    className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar collab'}
                  </button>
                  <button onClick={() => setShowAddCollabForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            {externalCollabs.length === 0 && !showAddCollabForm ? (
              <p className="text-sm text-gray-400 py-2">No hay collabs externos cargados para este mes.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Cuenta</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Descripción</th>
                      <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Views</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Likes</th>
                      <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                      <th className="py-2 px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {externalCollabs.map(post => (
                      <tr key={post.id} className="border-b border-gray-50 hover:bg-orange-50 group">
                        <td className="py-2 px-2">
                          <span className="text-xs font-medium text-orange-600">{post.collab_account || '—'}</span>
                        </td>
                        <td className="py-2 px-2 text-gray-700 max-w-xs truncate">{post.description || '—'}</td>
                        <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                        <td className="py-2 px-2 text-right font-medium">{formatNumber(post.views)}</td>
                        <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.likes)}</td>
                        <td className="py-2 px-2 text-right">
                          {post.permalink
                            ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={14} /></a>
                            : '—'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button onClick={() => handleDelete(post.id)}
                            className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50">
                      <td colSpan={3} className="py-2 px-2 text-xs font-semibold text-orange-700">Total collabs externos</td>
                      <td className="py-2 px-2 text-right text-sm font-bold text-orange-700">{formatNumber(collabViewsSum)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Regular posts table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Contenido propio del mes ({regularPosts.length} posts)</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="flex gap-1">
                  {['all', 'Reel', 'Post', 'Collab', 'Story'].map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {t === 'all' ? 'Todos' : t}
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400"
                  >
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
                <Link href="/dashboard/upload"
                  className="flex items-center gap-1 text-xs bg-rose-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-rose-400">
                  <Upload size={13} /> Subir CSV
                </Link>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400">
                  <Plus size={13} /> Agregar manual
                </button>
              </div>
            </div>

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
                    <input type="text" value={newPost.description} onChange={e => setNewPost(p => ({ ...p, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {['views', 'likes', 'comments', 'shares', 'saves'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-gray-500 block mb-1 capitalize">{field}</label>
                      <input type="number" value={newPost[field as keyof typeof newPost]}
                        onChange={e => setNewPost(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Permalink</label>
                    <input type="text" value={newPost.permalink} onChange={e => setNewPost(p => ({ ...p, permalink: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cuenta collab</label>
                    <input type="text" placeholder="@sofijobs" value={newPost.collab_account}
                      onChange={e => setNewPost(p => ({ ...p, collab_account: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => savePost(false)} disabled={saving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar post'}
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
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Tipo</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Descripción</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('views')}>
                      <span className="flex items-center justify-end gap-1">Alcance <SortIcon k="views" /></span>
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
                      No hay posts. Subí un CSV o agregá uno manual.
                    </td></tr>
                  )}
                  {sorted.map(post => (
                    <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                      </td>
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
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.likes)}</td>
                      <td className="py-2 px-2 text-right font-medium text-emerald-600">{formatPercent(erForPost(post))}</td>
                      <td className="py-2 px-2 text-right">
                        {post.permalink
                          ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={14} /></a>
                          : '—'}
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
