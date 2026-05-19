'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLinkedInStats, getLinkedInHistory, deleteLinkedInPost, upsertLinkedInMonthly } from '@/lib/queries'
import { formatNumber, formatPercent, currentYearMonth, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import type { LinkedInStats } from '@/lib/types'
import { Trash2, ExternalLink, ChevronUp, ChevronDown, Upload, Plus } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LabelList, AreaChart, Area,
} from 'recharts'
import Link from 'next/link'

type SortKey = 'impressions' | 'interactions' | 'er'
type SortDir = 'asc' | 'desc'

type HistoryPoint = Awaited<ReturnType<typeof getLinkedInHistory>>[0]

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

export default function LinkedInPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [stats, setStats] = useState<LinkedInStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('impressions')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editMonthly, setEditMonthly] = useState(false)
  const [followers, setFollowers] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const [data, hist] = await Promise.all([
      getLinkedInStats({ year, month }),
      getLinkedInHistory(),
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
    await upsertLinkedInMonthly({ year, month, total_followers: parseInt(followers) || 0, new_followers: parseInt(newFollowers) || 0 })
    await load()
    setEditMonthly(false)
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este post?')) return
    await deleteLinkedInPost(id)
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
    const { deleteLinkedInPost: del } = await import('@/lib/queries')
    await Promise.all([...selected].map(id => del(id)))
    setSelected(new Set())
    await load()
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const posts = stats?.posts ?? []
  const sorted = [...posts].sort((a, b) => {
    let av = 0, bv = 0
    if (sortKey === 'impressions') { av = a.impressions; bv = b.impressions }
    else if (sortKey === 'interactions') { av = a.interactions; bv = b.interactions }
    else if (sortKey === 'er') { av = a.er_decimal; bv = b.er_decimal }
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  // Historical chart data (last 12 months)
  const histLast = history.slice(-12)
  const impChart = useMemo(() => {
    const vals = histLast.map(d => d.impressions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.impressions, ma: ma[i] }))
  }, [histLast])
  const erChart = useMemo(() => {
    const vals = histLast.map(d => d.er)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: +d.er.toFixed(2), ma: ma[i] ? +ma[i]!.toFixed(2) : null }))
  }, [histLast])

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

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn — Seeds</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · weareseeders</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Impresiones', val: stats?.totalImpressions ?? 0, prev: prevH?.impressions, qPrev: qPrevH?.impressions, fmt: formatNumber },
              { label: 'Interacciones', val: stats?.totalInteractions ?? 0, prev: prevH?.interactions, qPrev: qPrevH?.interactions, fmt: formatNumber },
              { label: 'Engagement %', val: stats?.avgER ?? 0, prev: prevH?.er, qPrev: qPrevH?.er, fmt: (v: number) => formatPercent(v) },
              { label: 'Nuevos seguidores', val: stats?.monthly?.new_followers ?? 0, prev: prevH?.newFollowers, qPrev: qPrevH?.newFollowers, fmt: formatNumber },
            ].map(({ label, val, prev, qPrev, fmt }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(val)}</div>
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
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Impresiones</div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={impChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" name="Impresiones" fill="#bfdbfe" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" style={{ fontSize: 10, fontWeight: 700, fill: '#374151' }} formatter={(v: unknown) => formatNumber(Number(v))} />
                    </Bar>
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#3b82f6" strokeDasharray="5 3" dot={false} strokeWidth={2} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Engagement %</div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={erChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="liErGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                    <Tooltip formatter={(v, n) => [`${Number(v).toFixed(2)}%`, n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" name="ER%" stroke="#3b82f6" fill="url(#liErGrad)" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#3b82f6" strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Followers card */}
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

          {/* Posts table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Contenidos del mes ({posts.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="flex gap-1">
                  {(['impressions', 'er', 'interactions'] as SortKey[]).map(k => (
                    <button key={k} onClick={() => { setSortKey(k); setSortDir('desc') }}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${sortKey === k ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                      {k === 'impressions' ? 'Por impresiones' : k === 'er' ? 'Por ER' : 'Por interacciones'}
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <button onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400">
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
                <Link href="/dashboard/upload"
                  className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-blue-500">
                  <Upload size={13} /> Subir CSV LinkedIn
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400 w-8">#</th>
                    <th className="w-8 py-2 px-2">
                      <input type="checkbox" className="rounded"
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sorted.length }}
                        checked={sorted.length > 0 && selected.size === sorted.length}
                        onChange={() => toggleSelectAll(sorted)} />
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('impressions')}>
                      <span className="flex items-center justify-end gap-1">Impresiones <SortIcon k="impressions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('interactions')}>
                      <span className="flex items-center justify-end gap-1">Interacc. <SortIcon k="interactions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600" onClick={() => toggleSort('er')}>
                      <span className="flex items-center justify-end gap-1">ER <SortIcon k="er" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Enlace</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={9} className="py-8 text-center text-gray-400 text-sm">
                      No hay posts. <Link href="/dashboard/upload" className="text-blue-500 underline">Subí el CSV de LinkedIn</Link>.
                    </td></tr>
                  )}
                  {sorted.map((post, idx) => (
                    <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2 text-xs text-gray-400 font-medium">#{idx + 1}</td>
                      <td className="py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        {post.permalink
                          ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600 truncate block">{post.title || '(sin título)'}</a>
                          : <div className="text-gray-700 truncate">{post.title || '(sin título)'}</div>
                        }
                        {post.is_manual && <Badge variant="manual">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatNumber(post.impressions)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.interactions)}</td>
                      <td className="py-2 px-2 text-right font-medium text-blue-600">{formatPercent(post.er_decimal * 100)}</td>
                      <td className="py-2 px-2 text-right">
                        {post.permalink
                          ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex items-center gap-0.5 text-xs font-medium">Ver <ExternalLink size={11} /></a>
                          : '—'}
                      </td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDelete(post.id)} className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
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
