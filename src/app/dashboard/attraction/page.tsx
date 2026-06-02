'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Plus, Trash2, PencilLine, Check, X, ChevronDown, ChevronUp } from 'lucide-react'
import {
  getAttractionWeeks, getAttractionWeekData, createAttractionWeek, deleteAttractionWeek,
  addAttractionOpportunity, updateAttractionOpportunity, deleteAttractionOpportunity,
  addAttractionVideo, updateAttractionVideo, deleteAttractionVideo,
  type AttractionWeek, type AttractionOpportunity, type AttractionVideo,
} from '@/lib/attractionQueries'
import { formatNumber } from '@/lib/utils'

function formatWeekDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function nextWednesday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day <= 3 ? 3 - day : 10 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export default function AttractionPage() {
  const [weeks, setWeeks] = useState<AttractionWeek[]>([])
  const [weekIdx, setWeekIdx] = useState(0)
  const [opportunities, setOpportunities] = useState<AttractionOpportunity[]>([])
  const [videos, setVideos] = useState<AttractionVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [videosOpen, setVideosOpen] = useState(true)

  // New week form
  const [showNewWeekForm, setShowNewWeekForm] = useState(false)
  const [newWeekDate, setNewWeekDate] = useState('')
  const [savingWeek, setSavingWeek] = useState(false)

  // New opportunity form
  const [showAddOpp, setShowAddOpp] = useState(false)
  const [newOppTitle, setNewOppTitle] = useState('')
  const [newOppCompany, setNewOppCompany] = useState('')
  const [savingOpp, setSavingOpp] = useState(false)

  // New video form
  const [showAddVideo, setShowAddVideo] = useState(false)
  const [newVideoType, setNewVideoType] = useState<'general' | 'specific'>('general')
  const [newVideoTitle, setNewVideoTitle] = useState('')
  const [newVideoViews, setNewVideoViews] = useState('')
  const [newVideoOppId, setNewVideoOppId] = useState('')
  const [savingVideo, setSavingVideo] = useState(false)

  // Inline editing — opportunity metrics
  const [editingOppId, setEditingOppId] = useState<string | null>(null)
  const [editApps, setEditApps] = useState('')
  const [editCandidates, setEditCandidates] = useState('')

  // Inline editing — video
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null)
  const [editVideoTitle, setEditVideoTitle] = useState('')
  const [editVideoViews, setEditVideoViews] = useState('')

  const currentWeek = weeks[weekIdx] ?? null

  const loadWeeks = useCallback(async () => {
    const w = await getAttractionWeeks()
    setWeeks(w)
    return w
  }, [])

  const loadWeekData = useCallback(async (weekId: string) => {
    const res = await getAttractionWeekData(weekId)
    setOpportunities(res.opportunities)
    setVideos(res.videos)
  }, [])

  // Initial load
  useEffect(() => {
    setLoading(true)
    loadWeeks()
      .then(w => { if (w.length > 0) return loadWeekData(w[0].id) })
      .finally(() => setLoading(false))
  }, [loadWeeks, loadWeekData])

  // Reload data when week changes
  useEffect(() => {
    if (currentWeek) loadWeekData(currentWeek.id)
  }, [weekIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Computed metrics ──────────────────────────────
  const totalViews = useMemo(() => videos.reduce((a, v) => a + v.views, 0), [videos])
  const totalApplications = useMemo(() => opportunities.reduce((a, o) => a + o.applications, 0), [opportunities])
  const totalCandidates = useMemo(() => opportunities.reduce((a, o) => a + o.candidates_presented, 0), [opportunities])

  const viewsByOpp = useMemo(() => {
    const map: Record<string, number> = {}
    for (const v of videos) {
      if (v.type === 'specific' && v.opportunity_id)
        map[v.opportunity_id] = (map[v.opportunity_id] ?? 0) + v.views
    }
    return map
  }, [videos])

  const appsConv = totalViews > 0 ? (totalApplications / totalViews) * 100 : null
  const candidatesConv = totalApplications > 0 ? (totalCandidates / totalApplications) * 100 : null

  // ── Handlers ──────────────────────────────────────
  async function handleCreateWeek() {
    if (!newWeekDate) return
    setSavingWeek(true)
    const week = await createAttractionWeek(newWeekDate)
    if (week) {
      const updated = await loadWeeks()
      const idx = updated.findIndex(w => w.id === week.id)
      setWeekIdx(idx >= 0 ? idx : 0)
      setOpportunities([])
      setVideos([])
    }
    setShowNewWeekForm(false)
    setNewWeekDate('')
    setSavingWeek(false)
  }

  async function handleDeleteWeek() {
    if (!currentWeek) return
    if (!confirm('¿Eliminar esta semana y todos sus datos? Esta acción no se puede deshacer.')) return
    await deleteAttractionWeek(currentWeek.id)
    const updated = await loadWeeks()
    setWeekIdx(0)
    if (updated.length > 0) await loadWeekData(updated[0].id)
    else { setOpportunities([]); setVideos([]) }
  }

  async function handleAddOpportunity() {
    if (!newOppTitle.trim() || !currentWeek) return
    setSavingOpp(true)
    const opp = await addAttractionOpportunity({
      week_id: currentWeek.id,
      title: newOppTitle.trim(),
      company: newOppCompany.trim() || null,
    })
    if (opp) setOpportunities(prev => [...prev, opp])
    setNewOppTitle(''); setNewOppCompany(''); setShowAddOpp(false); setSavingOpp(false)
  }

  async function handleDeleteOpportunity(id: string) {
    if (!confirm('¿Eliminar esta oportunidad?')) return
    await deleteAttractionOpportunity(id)
    setOpportunities(prev => prev.filter(o => o.id !== id))
    setVideos(prev => prev.map(v => v.opportunity_id === id ? { ...v, opportunity_id: null } : v))
  }

  async function handleToggleStatus(opp: AttractionOpportunity) {
    const newStatus = opp.status === 'active' ? 'cancelled' : 'active'
    const { data } = await updateAttractionOpportunity(opp.id, { status: newStatus })
    if (data) setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: newStatus } : o))
  }

  function startEditOpp(opp: AttractionOpportunity) {
    setEditingOppId(opp.id)
    setEditApps(String(opp.applications))
    setEditCandidates(String(opp.candidates_presented))
  }

  async function saveEditOpp(opp: AttractionOpportunity) {
    const updates = { applications: parseInt(editApps) || 0, candidates_presented: parseInt(editCandidates) || 0 }
    await updateAttractionOpportunity(opp.id, updates)
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, ...updates } : o))
    setEditingOppId(null)
  }

  async function handleAddVideo() {
    if (!currentWeek || !newVideoViews) return
    setSavingVideo(true)
    const vid = await addAttractionVideo({
      week_id: currentWeek.id,
      type: newVideoType,
      title: newVideoTitle.trim() || null,
      views: parseInt(newVideoViews) || 0,
      opportunity_id: newVideoType === 'specific' && newVideoOppId ? newVideoOppId : null,
    })
    if (vid) setVideos(prev => [...prev, vid])
    setNewVideoTitle(''); setNewVideoViews(''); setNewVideoOppId('')
    setShowAddVideo(false); setSavingVideo(false)
  }

  async function handleDeleteVideo(id: string) {
    await deleteAttractionVideo(id)
    setVideos(prev => prev.filter(v => v.id !== id))
  }

  async function handleSaveVideo(video: AttractionVideo) {
    const updates = { title: editVideoTitle.trim() || null, views: parseInt(editVideoViews) || 0 }
    await updateAttractionVideo(video.id, updates)
    setVideos(prev => prev.map(v => v.id === video.id ? { ...v, ...updates } : v))
    setEditingVideoId(null)
  }

  // ── Render ────────────────────────────────────────
  if (loading) return <div className="p-8 text-gray-400 text-sm">Cargando...</div>

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attraction</h1>
          <p className="text-gray-500 text-sm mt-0.5">Funnel semanal de oportunidades y talento</p>
        </div>
        <div className="flex items-center gap-2">
          {weeks.length > 0 && (
            <>
              <button
                onClick={() => setWeekIdx(i => i + 1)}
                disabled={weekIdx >= weeks.length - 1}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                title="Semana anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
                Semana del {formatWeekDate(currentWeek!.week_date)}
              </span>
              <button
                onClick={() => setWeekIdx(i => i - 1)}
                disabled={weekIdx <= 0}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                title="Semana siguiente"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
          <button
            onClick={() => { setShowNewWeekForm(v => !v); setNewWeekDate(nextWednesday()) }}
            className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-400 transition-colors"
          >
            <Plus size={15} /> Nueva semana
          </button>
        </div>
      </div>

      {/* ── New week form ── */}
      {showNewWeekForm && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-600 block mb-1 font-medium">Fecha de la semana</label>
              <input
                type="date"
                value={newWeekDate}
                onChange={e => setNewWeekDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">Usualmente el miércoles que te pasaron los perfiles</p>
            </div>
            <button
              onClick={handleCreateWeek}
              disabled={!newWeekDate || savingWeek}
              className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              {savingWeek ? 'Creando...' : 'Crear semana'}
            </button>
            <button onClick={() => setShowNewWeekForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancelar</button>
          </div>
        </Card>
      )}

      {/* ── Empty state ── */}
      {weeks.length === 0 && !showNewWeekForm && (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4 text-3xl">🎯</div>
          <div className="text-gray-700 font-semibold text-lg mb-1">Sin semanas cargadas</div>
          <div className="text-gray-400 text-sm mb-6 max-w-sm">
            Creá tu primera semana para empezar a trackear el funnel de Attraction semana a semana.
          </div>
          <button
            onClick={() => { setShowNewWeekForm(true); setNewWeekDate(nextWednesday()) }}
            className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-400"
          >
            <Plus size={16} /> Crear primera semana
          </button>
        </div>
      )}

      {currentWeek && (
        <>
          {/* ── Funnel KPIs ── */}
          <div className="mb-6">
            <div className="flex items-stretch gap-2">
              {/* Views */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">👁 Views totales</div>
                <div className="text-3xl font-bold text-gray-900">{formatNumber(totalViews)}</div>
                <div className="text-xs text-gray-400 mt-1.5">
                  {videos.length === 0 ? 'Sin videos' : `${videos.length} video${videos.length !== 1 ? 's' : ''}`}
                  {videos.filter(v => v.type === 'general').length > 0 && (
                    <span className="ml-1 text-violet-500">· {videos.filter(v => v.type === 'general').length} gral.</span>
                  )}
                  {videos.filter(v => v.type === 'specific').length > 0 && (
                    <span className="ml-1 text-amber-500">· {videos.filter(v => v.type === 'specific').length} esp.</span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center w-8 shrink-0 gap-0.5">
                <div className="text-gray-300 text-lg leading-none">→</div>
                {appsConv !== null && (
                  <div className="text-[10px] text-gray-400 font-semibold">{appsConv.toFixed(1)}%</div>
                )}
              </div>

              {/* Applications */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">📝 Aplicaciones</div>
                <div className="text-3xl font-bold text-gray-900">{formatNumber(totalApplications)}</div>
                <div className="text-xs text-gray-400 mt-1.5">
                  {opportunities.length === 0 ? 'Sin oportunidades'
                    : `en ${opportunities.length} oportunidad${opportunities.length !== 1 ? 'es' : ''}`}
                  {opportunities.filter(o => o.status === 'cancelled').length > 0 && (
                    <span className="ml-1 text-red-400">
                      · {opportunities.filter(o => o.status === 'cancelled').length} cancelada{opportunities.filter(o => o.status === 'cancelled').length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center w-8 shrink-0 gap-0.5">
                <div className="text-gray-300 text-lg leading-none">→</div>
                {candidatesConv !== null && (
                  <div className="text-[10px] text-gray-400 font-semibold">{candidatesConv.toFixed(1)}%</div>
                )}
              </div>

              {/* Candidates */}
              <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">✅ Candidatos</div>
                <div className="text-3xl font-bold text-emerald-600">{formatNumber(totalCandidates)}</div>
                <div className="text-xs text-gray-400 mt-1.5">presentados a empresas</div>
              </div>
            </div>
          </div>

          {/* ── Videos ── */}
          <Card className="mb-6">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setVideosOpen(o => !o)}
            >
              <CardTitle>Videos de la semana{videos.length > 0 ? ` (${videos.length})` : ''}</CardTitle>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setShowAddVideo(v => !v)}
                  className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400"
                >
                  <Plus size={13} /> Agregar video
                </button>
                <span className="text-gray-400">{videosOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
            </div>

            {videosOpen && (
              <div className="mt-4">
                {showAddVideo && (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                    <div className="text-sm font-medium text-gray-700 mb-3">Nuevo video</div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                        <select
                          value={newVideoType}
                          onChange={e => { setNewVideoType(e.target.value as 'general' | 'specific'); setNewVideoOppId('') }}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="general">General</option>
                          <option value="specific">Específico</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 block mb-1">Descripción (opcional)</label>
                        <input
                          type="text"
                          value={newVideoTitle}
                          onChange={e => setNewVideoTitle(e.target.value)}
                          placeholder={newVideoType === 'general' ? 'Ej: 3 oportunidades tech esta semana' : 'Ej: Senior Dev @ TechCorp'}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Views totales</label>
                        <input
                          type="number"
                          value={newVideoViews}
                          onChange={e => setNewVideoViews(e.target.value)}
                          placeholder="0"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      {newVideoType === 'specific' && (
                        <div className="col-span-2">
                          <label className="text-xs text-gray-500 block mb-1">Oportunidad que cubre</label>
                          <select
                            value={newVideoOppId}
                            onChange={e => setNewVideoOppId(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">Sin asignar</option>
                            {opportunities.map(o => (
                              <option key={o.id} value={o.id}>
                                {o.title}{o.company ? ` @ ${o.company}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleAddVideo}
                        disabled={!newVideoViews || savingVideo}
                        className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {savingVideo ? 'Guardando...' : 'Guardar video'}
                      </button>
                      <button onClick={() => setShowAddVideo(false)} className="text-sm text-gray-500 px-3 hover:text-gray-700">Cancelar</button>
                    </div>
                  </div>
                )}

                {videos.length === 0 && !showAddVideo ? (
                  <p className="text-sm text-gray-400 py-2">No hay videos cargados para esta semana.</p>
                ) : videos.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Tipo</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Descripción</th>
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Oportunidad</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views</th>
                          <th className="py-2 px-2 w-16" />
                        </tr>
                      </thead>
                      <tbody>
                        {videos.map(video => (
                          <tr key={video.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                            <td className="py-2 px-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
                                video.type === 'general'
                                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {video.type === 'general' ? 'General' : 'Específico'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-gray-700 max-w-xs">
                              {editingVideoId === video.id ? (
                                <input
                                  type="text"
                                  value={editVideoTitle}
                                  onChange={e => setEditVideoTitle(e.target.value)}
                                  className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                  autoFocus
                                />
                              ) : (
                                <span className="truncate">{video.title || <span className="text-gray-300">—</span>}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-xs text-gray-500">
                              {video.opportunity_id
                                ? (() => {
                                    const opp = opportunities.find(o => o.id === video.opportunity_id)
                                    return opp ? `${opp.title}${opp.company ? ` @ ${opp.company}` : ''}` : '—'
                                  })()
                                : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {editingVideoId === video.id ? (
                                <input
                                  type="number"
                                  value={editVideoViews}
                                  onChange={e => setEditVideoViews(e.target.value)}
                                  className="w-24 border border-gray-200 rounded px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              ) : (
                                formatNumber(video.views)
                              )}
                            </td>
                            <td className="py-2 px-2 text-right">
                              {editingVideoId === video.id ? (
                                <div className="flex items-center gap-1 justify-end">
                                  <button onClick={() => handleSaveVideo(video)} className="text-emerald-500 hover:text-emerald-700"><Check size={14} /></button>
                                  <button onClick={() => setEditingVideoId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => { setEditingVideoId(video.id); setEditVideoTitle(video.title ?? ''); setEditVideoViews(String(video.views)) }}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <PencilLine size={13} />
                                  </button>
                                  <button onClick={() => handleDeleteVideo(video.id)} className="text-gray-300 hover:text-red-500">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-100 bg-gray-50">
                          <td colSpan={3} className="py-2 px-3 text-xs font-semibold text-gray-500">Total views</td>
                          <td className="py-2 px-3 text-right text-sm font-bold text-gray-900">{formatNumber(totalViews)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : null}
              </div>
            )}
          </Card>

          {/* ── Opportunities ── */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Oportunidades de la semana{opportunities.length > 0 ? ` (${opportunities.length})` : ''}</CardTitle>
              <button
                onClick={() => setShowAddOpp(v => !v)}
                className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400"
              >
                <Plus size={13} /> Agregar
              </button>
            </div>

            {showAddOpp && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Rol / búsqueda <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={newOppTitle}
                      onChange={e => setNewOppTitle(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddOpportunity()}
                      placeholder="Ej: Senior React Developer"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Empresa (opcional)</label>
                    <input
                      type="text"
                      value={newOppCompany}
                      onChange={e => setNewOppCompany(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddOpportunity()}
                      placeholder="Ej: TechCorp"
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleAddOpportunity}
                    disabled={!newOppTitle.trim() || savingOpp}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {savingOpp ? 'Guardando...' : 'Agregar'}
                  </button>
                  <button onClick={() => setShowAddOpp(false)} className="text-sm text-gray-500 px-3 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            {opportunities.length === 0 && !showAddOpp ? (
              <p className="text-sm text-gray-400 py-2">No hay oportunidades cargadas para esta semana.</p>
            ) : opportunities.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Oportunidad</th>
                      <th className="text-center py-2 px-3 text-xs font-medium text-gray-400">Estado</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views esp.</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Aplicaciones</th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Candidatos</th>
                      <th className="py-2 px-2 w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map(opp => (
                      <tr key={opp.id} className={`border-b border-gray-50 hover:bg-gray-50 group ${opp.status === 'cancelled' ? 'opacity-55' : ''}`}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-gray-800">{opp.title}</div>
                          {opp.company && <div className="text-xs text-gray-400 mt-0.5">@ {opp.company}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => handleToggleStatus(opp)}
                            title={opp.status === 'active' ? 'Click para cancelar' : 'Click para reactivar'}
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                              opp.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                : 'bg-red-50 text-red-600 border-red-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                            }`}
                          >
                            {opp.status === 'active' ? 'Activa' : 'Cancelada'}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-500">
                          {viewsByOpp[opp.id] ? formatNumber(viewsByOpp[opp.id]) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {editingOppId === opp.id ? (
                            <input
                              type="number"
                              value={editApps}
                              onChange={e => setEditApps(e.target.value)}
                              className="w-16 border border-gray-200 rounded px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                          ) : (
                            <span className="font-medium text-gray-800">{formatNumber(opp.applications)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {editingOppId === opp.id ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                value={editCandidates}
                                onChange={e => setEditCandidates(e.target.value)}
                                className="w-16 border border-gray-200 rounded px-2 py-0.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <button onClick={() => saveEditOpp(opp)} className="text-emerald-500 hover:text-emerald-700"><Check size={14} /></button>
                              <button onClick={() => setEditingOppId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                            </div>
                          ) : (
                            <span className="font-semibold text-emerald-700">{formatNumber(opp.candidates_presented)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {editingOppId !== opp.id && (
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => startEditOpp(opp)} className="text-gray-400 hover:text-gray-600" title="Editar números">
                                <PencilLine size={13} />
                              </button>
                              <button onClick={() => handleDeleteOpportunity(opp.id)} className="text-gray-300 hover:text-red-500">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-100 bg-gray-50">
                      <td colSpan={3} className="py-2 px-3 text-xs font-semibold text-gray-500">Total</td>
                      <td className="py-2 px-3 text-right text-sm font-bold text-gray-900">{formatNumber(totalApplications)}</td>
                      <td className="py-2 px-3 text-right text-sm font-bold text-emerald-700">{formatNumber(totalCandidates)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                <p className="text-xs text-gray-400 mt-2 px-1">
                  Para editar aplicaciones y candidatos, hacé hover sobre la fila y tocá el lápiz. El estado Activa/Cancelada se cambia haciendo click en el badge.
                </p>
              </div>
            ) : null}
          </Card>

          {/* ── Delete week ── */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleDeleteWeek}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={12} /> Eliminar esta semana
            </button>
          </div>
        </>
      )}
    </div>
  )
}
