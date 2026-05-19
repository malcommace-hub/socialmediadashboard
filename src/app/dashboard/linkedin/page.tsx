'use client'
import { useEffect, useState, useCallback } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLinkedInStats, deleteLinkedInPost, upsertLinkedInMonthly } from '@/lib/queries'
import { formatNumber, formatPercent, currentYearMonth, monthLabel } from '@/lib/utils'
import type { LinkedInStats } from '@/lib/types'
import { Trash2, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'

type SortKey = 'impressions' | 'interactions' | 'er'
type SortDir = 'asc' | 'desc'

export default function LinkedInPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [stats, setStats] = useState<LinkedInStats | null>(null)
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
    const data = await getLinkedInStats({ year, month })
    setStats(data)
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
    await Promise.all([...selected].map(id => deleteLinkedInPost(id)))
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LinkedIn</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · weareseeders</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard label="Impresiones totales" value={formatNumber(stats?.totalImpressions ?? 0)} />
            <StatCard label="Interacciones" value={formatNumber(stats?.totalInteractions ?? 0)} />
            <StatCard label="ER% promedio" value={formatPercent(stats?.avgER ?? 0)} />
          </div>

          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Seguidores del mes</CardTitle>
              <button onClick={() => setEditMonthly(!editMonthly)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
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
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Posts del mes ({posts.length})</CardTitle>
                {selected.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400"
                  >
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
              </div>
            </CardHeader>
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
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600"
                      onClick={() => toggleSort('impressions')}>
                      <span className="flex items-center justify-end gap-1">Impresiones <SortIcon k="impressions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600"
                      onClick={() => toggleSort('interactions')}>
                      <span className="flex items-center justify-end gap-1">Interacciones <SortIcon k="interactions" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer hover:text-gray-600"
                      onClick={() => toggleSort('er')}>
                      <span className="flex items-center justify-end gap-1">ER% <SortIcon k="er" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={8} className="py-8 text-center text-gray-400 text-sm">
                      No hay posts. Subí el XLS de LinkedIn Analytics.
                    </td></tr>
                  )}
                  {sorted.map(post => (
                    <tr key={post.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        <div className="text-gray-700 truncate">{post.title || '(sin título)'}</div>
                        {post.is_manual && <Badge variant="manual">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatNumber(post.impressions)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.interactions)}</td>
                      <td className="py-2 px-2 text-right font-medium text-emerald-600">{formatPercent(post.er_decimal * 100)}</td>
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
