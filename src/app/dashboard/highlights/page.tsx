'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card } from '@/components/ui/card'
import { useMesParam } from '@/hooks/useMesParam'
import { monthLabel, formatNumber } from '@/lib/utils'
import {
  getTopPostsByMonth, getFeaturedContent, addFeaturedContent, deleteFeaturedContent, getPostByUrl,
} from '@/lib/queries'
import { Camera, Briefcase, Music2, ExternalLink, Trash2, Plus, RefreshCw } from 'lucide-react'
import { clearCache } from '@/lib/queryCache'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'

type TopPosts = Awaited<ReturnType<typeof getTopPostsByMonth>>
type FeaturedItem = Awaited<ReturnType<typeof getFeaturedContent>>[0]

type Channel = 'instagram' | 'linkedin' | 'tiktok'

interface DisplayPost {
  label: string
  metricValue: number
  er: number
  permalink: string | null
  type?: string | null
}

const CHANNEL_CONFIG: Record<Channel, {
  label: string
  Icon: React.ComponentType<{ size?: number }>
  metricLabel: string
  accentBg: string
  accentBorder: string
  accentText: string
  badgeCls: string
}> = {
  instagram: {
    label: 'Instagram', Icon: Camera, metricLabel: 'Views',
    accentBg: 'bg-rose-50', accentBorder: 'border-rose-200', accentText: 'text-rose-700',
    badgeCls: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  linkedin: {
    label: 'LinkedIn', Icon: Briefcase, metricLabel: 'Impr.',
    accentBg: 'bg-blue-50', accentBorder: 'border-blue-200', accentText: 'text-blue-700',
    badgeCls: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  tiktok: {
    label: 'TikTok', Icon: Music2, metricLabel: 'Views',
    accentBg: 'bg-gray-50', accentBorder: 'border-gray-200', accentText: 'text-gray-600',
    badgeCls: 'bg-gray-100 text-gray-700 border-gray-200',
  },
}

const CHANNELS: Channel[] = ['instagram', 'linkedin', 'tiktok']

const emptyForm = {
  channel: 'instagram' as Channel,
  postUrl: '',
  description: '',
  views: '',
  erPct: '',
  editorialNote: '',
}

export default function HighlightsPage() {
  const { year, month, setYear, setMonth } = useMesParam()
  const [topPosts, setTopPosts] = useState<TopPosts | null>(null)
  const [featured, setFeatured] = useState<FeaturedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [top, curated] = await Promise.all([
        getTopPostsByMonth(year, month),
        getFeaturedContent(year, month),
      ])
      setTopPosts(top)
      setFeatured(curated)
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  const channelMap = useMemo((): Record<Channel, DisplayPost | null> => ({
    instagram: topPosts?.instagram ? {
      label: topPosts.instagram.description ?? '',
      metricValue: topPosts.instagram.views,
      er: topPosts.instagram.er,
      permalink: topPosts.instagram.permalink ?? null,
      type: topPosts.instagram.type,
    } : null,
    linkedin: topPosts?.linkedin ? {
      label: topPosts.linkedin.title ?? '',
      metricValue: topPosts.linkedin.impressions,
      er: topPosts.linkedin.er,
      permalink: topPosts.linkedin.permalink ?? null,
    } : null,
    tiktok: topPosts?.tiktok ? {
      label: topPosts.tiktok.title ?? '',
      metricValue: topPosts.tiktok.views,
      er: topPosts.tiktok.er,
      permalink: topPosts.tiktok.permalink ?? null,
    } : null,
  }), [topPosts])

  async function handleUrlLookup() {
    if (!form.postUrl.trim()) return
    setLookupStatus('searching')
    const match = await getPostByUrl(form.postUrl)
    if (match) {
      setForm(f => ({
        ...f,
        channel: match.channel,
        description: match.description ?? f.description,
        views: match.views != null ? String(match.views) : f.views,
        erPct: match.er_pct != null ? String(match.er_pct.toFixed(2)) : f.erPct,
      }))
      setLookupStatus('found')
    } else {
      setLookupStatus('not_found')
    }
  }

  async function handleAdd() {
    if (!form.editorialNote.trim()) return
    setSaving(true)
    await addFeaturedContent({
      year, month,
      channel: form.channel,
      post_url: form.postUrl.trim() || null,
      description: form.description.trim() || null,
      views: form.views.trim() !== '' ? (parseInt(form.views) || 0) : null,
      er_pct: form.erPct.trim() !== '' ? (parseFloat(form.erPct) || 0) : null,
      editorial_note: form.editorialNote.trim(),
    })
    setForm({ ...emptyForm })
    setLookupStatus('idle')
    setShowForm(false)
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Quitar este contenido destacado?')) return
    await deleteFeaturedContent(id)
    clearCache()
    await load()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impactos del mes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Seeds Business Radar</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm(v => !v)}
            className="presentation-hide flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-400"
          >
            <Plus size={15} /> Agregar contenido
          </button>
          <button
            onClick={() => { clearCache(); load() }}
            className="presentation-hide p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw size={15} />
          </button>
          <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <Card className="mb-6 presentation-hide border-emerald-200 bg-emerald-50">
          <div className="font-semibold text-gray-800 mb-4">Nuevo contenido destacado</div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Canal</label>
              <select
                value={form.channel}
                onChange={e => setForm(f => ({ ...f, channel: e.target.value as Channel }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-xs text-gray-500 block mb-1">URL del post</label>
              <input
                type="text"
                placeholder="https://..."
                value={form.postUrl}
                onChange={e => { setForm(f => ({ ...f, postUrl: e.target.value })); setLookupStatus('idle') }}
                onBlur={handleUrlLookup}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {lookupStatus === 'searching' && (
                <div className="text-xs text-gray-400 mt-1">Buscando en la BD...</div>
              )}
              {lookupStatus === 'found' && (
                <div className="text-xs text-emerald-600 mt-1">✓ Post encontrado — campos completados automáticamente</div>
              )}
              {lookupStatus === 'not_found' && (
                <div className="text-xs text-amber-600 mt-1">Sin match en BD — completá los campos manualmente</div>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Descripción / título</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Views / Impr.</label>
              <input
                type="number"
                value={form.views}
                onChange={e => setForm(f => ({ ...f, views: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">ER%</label>
              <input
                type="number"
                step="0.01"
                value={form.erPct}
                onChange={e => setForm(f => ({ ...f, erPct: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-gray-500 block mb-1">
                Nota editorial <span className="text-red-400">*</span>
              </label>
              <textarea
                value={form.editorialNote}
                onChange={e => setForm(f => ({ ...f, editorialNote: e.target.value }))}
                rows={2}
                placeholder="¿Por qué destaca? ¿Qué generó más allá de los números?"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={saving || !form.editorialNote.trim()}
              className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowForm(false); setLookupStatus('idle') }}
              className="text-sm text-gray-500 px-3 hover:text-gray-700"
            >
              Cancelar
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <>
          <SkeletonCard kpi count={3} />
          <SkeletonCard lines={3} />
        </>
      ) : (
        <>
          {/* ── Sección 1: Top posts automáticos ── */}
          <div className="flex items-center gap-2 mb-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Top del mes</div>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
            {CHANNELS.map(ch => {
              const cfg = CHANNEL_CONFIG[ch]
              const post = channelMap[ch]
              return (
                <div key={ch} className={`bg-white rounded-2xl border p-4 shadow-sm featured-top-card ${cfg.accentBorder}`}>
                  <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${cfg.accentBorder}`}>
                    <div className={`w-7 h-7 rounded-lg ${cfg.accentBg} flex items-center justify-center ${cfg.accentText}`}>
                      <cfg.Icon size={15} />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${cfg.accentText}`}>{cfg.label}</span>
                  </div>

                  {post ? (
                    <>
                      <div className="text-sm text-gray-700 font-medium line-clamp-2 mb-3 min-h-[2.5rem]">
                        {post.label || '(sin descripción)'}
                      </div>
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-xs font-bold text-gray-900">
                          {formatNumber(post.metricValue)}
                          <span className="font-normal text-gray-400 ml-1">{cfg.metricLabel}</span>
                        </span>
                        {post.er > 0 && (
                          <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                            {post.er.toFixed(1)}% ER
                          </span>
                        )}
                        {post.type && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full border ${cfg.badgeCls}`}>
                            {post.type}
                          </span>
                        )}
                      </div>
                      {post.permalink && (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.accentText} hover:opacity-70 transition-opacity`}
                        >
                          Ver post <ExternalLink size={11} />
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-24 text-gray-300 text-xs">
                      Sin posts cargados para este mes
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Sección 2: Curados ──────────────── */}
          <div className="flex items-center gap-2 mb-4">
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Curados</div>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {featured.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-sm">No hay contenidos curados para este mes.</div>
              <div className="text-xs mt-1 presentation-hide">
                Usá el botón &ldquo;Agregar contenido&rdquo; para destacar posts con una nota editorial.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {featured.map(item => {
                const ch = (item.channel as Channel) in CHANNEL_CONFIG ? item.channel as Channel : 'instagram'
                const cfg = CHANNEL_CONFIG[ch]
                return (
                  <Card key={item.id}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.badgeCls}`}>
                          {cfg.label}
                        </span>
                        {item.description && (
                          <span className="text-sm text-gray-700 font-medium truncate min-w-0">{item.description}</span>
                        )}
                        {item.views != null && (
                          <span className="text-xs font-bold text-gray-900 shrink-0">
                            {formatNumber(item.views)}{' '}
                            <span className="font-normal text-gray-400">{cfg.metricLabel}</span>
                          </span>
                        )}
                        {item.er_pct != null && (
                          <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full shrink-0">
                            {Number(item.er_pct).toFixed(1)}% ER
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.post_url && (
                          <a
                            href={item.post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="presentation-hide text-gray-200 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className={`featured-editorial-note rounded-xl px-4 py-3 text-sm text-gray-700 ${cfg.accentBg} border ${cfg.accentBorder}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${cfg.accentText} mr-2`}>Nota:</span>
                      {item.editorial_note}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
