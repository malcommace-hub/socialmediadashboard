'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getTikTokStats, getTikTokHistory, deleteTikTokVideo, upsertTikTokMonthly, addTikTokVideoManual } from '@/lib/queries'
import { formatNumber, currentYearMonth, monthLabel, shortMonthLabel, movingAvg, pctChange, formatPercent } from '@/lib/utils'
import type { TikTokStats } from '@/lib/types'
import { Trash2, ExternalLink, Plus, ChevronUp, ChevronDown, Upload } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area,
} from 'recharts'
import Link from 'next/link'

type HistoryPoint = Awaited<ReturnType<typeof getTikTokHistory>>[0]

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

type SortKey = 'views' | 'likes' | 'comments' | 'shares'
type SortDir = 'asc' | 'desc'

export default function TikTokPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [stats, setStats] = useState<TikTokStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
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
    const [data, hist] = await Promise.all([
      getTikTokStats({ year, month }),
      getTikTokHistory(),
    ])
    setStats(data)
    setHistory(hist)
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

  const histLast = history.slice(-12)
  const curH = history.find(d => d.year === year && d.month === month)
  const prevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return history.find(d => d.year === pm.y && d.month === pm.m)
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
            {[
              { label: 'Impresiones', val: stats?.totalViews ?? 0, prev: prevH?.views },
              { label: 'Interacciones', val: stats?.totalInteractions ?? 0, prev: prevH?.interactions },
              { label: 'Nuevos seguidores', val: stats?.monthly?.new_followers ?? 0, prev: prevH?.newFollowers },
            ].map(({ label, val, prev }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{formatNumber(val)}</div>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={prev} />
                    <span className="ml-1">vs mes ant.</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {histLast.length >= 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Impresiones / Views */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Impresiones / Views</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={viewsChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Views" fill="#d1d5db" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#6b7280" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Interacciones */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Interacciones</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={intChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Interacciones" fill="#e5e7eb" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#4b5563" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Engagement % (interacciones / views) */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Engagement %</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={erChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ttErGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#374151" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#374151" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                    <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" name="ER%" stroke="#374151" fill="url(#ttErGrad)" strokeWidth={2} dot={{ r: 3, fill: '#374151', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#374151" strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Nuevos seguidores */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Nuevos seguidores</div>
                <ResponsiveContainer width="100%" height={180}>
                  <ComposedChart data={follChart} barCategoryGap="22%" margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Nuevos seguidores" fill="#d1d5db" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#6b7280" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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
                <Link href="/dashboard/upload"
                  className="flex items-center gap-1 text-xs bg-gray-700 text-white px-3 py-1 rounded-lg font-medium hover:bg-gray-600">
                  <Upload size={13} /> Subir CSV TikTok
                </Link>
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
                        {v.permalink ? (
                          <a href={v.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600 truncate block">{v.title || '(sin título)'}</a>
                        ) : (
                          <div className="text-gray-700 truncate">{v.title || '(sin título)'}</div>
                        )}
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
