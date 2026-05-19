'use client'
import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/utils'
import { ExternalLink, Trash2, Plus, Star } from 'lucide-react'

interface HighlightedPost {
  id: string
  channel: 'instagram' | 'linkedin' | 'tiktok'
  year: number
  month: number
  title: string
  metric: string
  permalink: string | null
  note: string
  addedAt: string
}

const STORAGE_KEY = 'seeds_highlights_v1'
const CHANNEL_COLORS: Record<string, string> = {
  instagram: 'bg-rose-100 text-rose-700 border-rose-200',
  linkedin: 'bg-blue-100 text-blue-700 border-blue-200',
  tiktok: 'bg-gray-100 text-gray-700 border-gray-200',
}
const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const emptyForm = {
  channel: 'instagram' as HighlightedPost['channel'],
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  title: '',
  metric: '',
  permalink: '',
  note: '',
}

export default function HighlightsPage() {
  const [highlights, setHighlights] = useState<HighlightedPost[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setHighlights(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  function save(items: HighlightedPost[]) {
    setHighlights(items)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }

  function addPost() {
    if (!form.title && !form.permalink) return
    const item: HighlightedPost = {
      id: `${Date.now()}-${Math.random()}`,
      ...form,
      permalink: form.permalink || null,
      addedAt: new Date().toISOString(),
    }
    save([item, ...highlights])
    setForm({ ...emptyForm })
    setShowForm(false)
  }

  function removePost(id: string) {
    if (!confirm('¿Quitar este contenido destacado?')) return
    save(highlights.filter(h => h.id !== id))
  }

  function updateNote(id: string, note: string) {
    save(highlights.map(h => h.id === id ? { ...h, note } : h))
  }

  const filtered = filter === 'all' ? highlights : highlights.filter(h => h.channel === filter)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Star size={22} className="text-amber-400" fill="currentColor" />
            Contenidos destacados
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Spotlight de posts para presentar en reuniones</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-400"
        >
          <Plus size={15} /> Agregar contenido
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <CardTitle className="mb-4">Nuevo contenido destacado</CardTitle>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Canal</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as HighlightedPost['channel'] }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="instagram">Instagram</option>
                <option value="linkedin">LinkedIn</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Año</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || 2026 }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Mes</label>
              <select value={form.month} onChange={e => setForm(f => ({ ...f, month: parseInt(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Métrica clave</label>
              <input type="text" placeholder="ej: 1.2M views" value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Título / descripción del contenido</label>
              <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 block mb-1">Link del post</label>
              <input type="text" placeholder="https://..." value={form.permalink} onChange={e => setForm(f => ({ ...f, permalink: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div className="col-span-4">
              <label className="text-xs text-gray-500 block mb-1">Nota / insight</label>
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                rows={2} placeholder="¿Por qué destaca? ¿Qué aprendimos?"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addPost} className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400">
              Guardar
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-3 hover:text-gray-700">Cancelar</button>
          </div>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4">
        {['all', 'instagram', 'linkedin', 'tiktok'].map(ch => (
          <button key={ch} onClick={() => setFilter(ch)}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors capitalize ${filter === ch ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {ch === 'all' ? 'Todos' : ch}
          </button>
        ))}
      </div>

      {/* Highlights grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Star size={32} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm">No hay contenidos destacados aún.</div>
          <div className="text-xs mt-1">Agregá posts que quieras mostrar en reuniones.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(h => (
            <Card key={h.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${CHANNEL_COLORS[h.channel]}`}>{h.channel}</span>
                    <span className="text-xs text-gray-400">{MONTH_NAMES[h.month - 1]} {h.year}</span>
                    {h.metric && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{h.metric}</span>
                    )}
                  </div>
                  <div className="font-medium text-gray-800 text-sm mb-2 line-clamp-2">{h.title}</div>
                  <textarea
                    value={h.note}
                    onChange={e => updateNote(h.id, e.target.value)}
                    placeholder="Agregá un insight o nota sobre este contenido..."
                    rows={2}
                    className="w-full text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {h.permalink && (
                    <a href={h.permalink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                      Ver <ExternalLink size={12} />
                    </a>
                  )}
                  <button onClick={() => removePost(h.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
