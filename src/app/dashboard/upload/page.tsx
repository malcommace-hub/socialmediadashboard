'use client'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthSelector } from '@/components/ui/month-selector'
import { parseInstagramCSV, parseLinkedInCSV, parseLinkedInXLS, parseLinkedInXLSWithDebug, parseTikTokCSV, parseTikTokOverviewCSV, parseTikTokFollowerHistoryCSV, type LinkedInDebugInfo } from '@/lib/parsers'
import {
  upsertInstagramPosts, upsertLinkedInPosts, upsertTikTokVideos, upsertTikTokMonthly,
  getYouTubeMonthly, upsertYouTubeMonthly,
  getNewsletterData, upsertNewsletterMonthly, addNewsletterEpisode, deleteNewsletterEpisode,
  getWebData, upsertWebMonthly, upsertWebUtmSource,
} from '@/lib/queries'
import type { NewsletterEpisode } from '@/lib/types'
import { clearCache } from '@/lib/queryCache'
import { currentYearMonth, monthLabel } from '@/lib/utils'
import { Upload, CheckCircle, AlertCircle, Camera, Briefcase, Music2, Play, Mail, Globe, Plus, Trash2 } from 'lucide-react'

type Status = 'idle' | 'parsing' | 'preview' | 'uploading' | 'done' | 'error'

interface UploadState {
  status: Status
  rowCount: number
  error?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  preview: any[]
  debug?: LinkedInDebugInfo
  detectedMonth?: { year: number; month: number } | null
}

function detectMonthFromRows(rows: Array<{ post_date?: string | null; video_date?: string | null }>): { year: number; month: number } | null {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const d = (row as { post_date?: string | null }).post_date
      ?? (row as { video_date?: string | null }).video_date
      ?? null
    if (!d) continue
    const m = d.match(/^(\d{4})-(\d{2})/)
    if (m) {
      const key = `${m[1]}-${parseInt(m[2], 10)}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  if (counts.size === 0) return null
  let best = '', bestCount = 0
  for (const [key, count] of counts) {
    if (count > bestCount) { best = key; bestCount = count }
  }
  if (bestCount < rows.length * 0.4) return null
  const [yr, mo] = best.split('-').map(Number)
  return { year: yr, month: mo }
}

const emptyState: UploadState = { status: 'idle', rowCount: 0, preview: [] }

export default function UploadPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)

  const [ig, setIg] = useState<UploadState>(emptyState)
  const [li, setLi] = useState<UploadState>(emptyState)
  const [tt, setTt] = useState<UploadState>(emptyState)
  const [ttOv, setTtOv] = useState<UploadState>(emptyState)
  const [ttFoll, setTtFoll] = useState<UploadState>(emptyState)

  // ─── YouTube Shorts manual ────────────────────
  const [ytViews, setYtViews] = useState('')
  const [ytSaving, setYtSaving] = useState(false)
  const [ytOk, setYtOk] = useState(false)

  // ─── Newsletter manual ────────────────────────
  const [nlNewSubs, setNlNewSubs] = useState('')
  const [nlSaving, setNlSaving] = useState(false)
  const [nlOk, setNlOk] = useState(false)
  const [nlEpisodes, setNlEpisodes] = useState<NewsletterEpisode[]>([])
  const [nlShowForm, setNlShowForm] = useState(false)
  const [nlNewEp, setNlNewEp] = useState({ episode_number: '', title: '', views: '', lead_magnet_downloads: '', published_date: '', url: '' })

  // ─── Web / UTM manual ─────────────────────────
  const UTM_SOURCES = ['instagram', 'linkedin', 'tiktok', 'linktree', 'other']
  const UTM_COLORS: Record<string, string> = {
    instagram: '#f43f5e', linkedin: '#3b82f6', tiktok: '#374151', linktree: '#10b981', other: '#d1d5db',
  }
  const [webTotalSessions, setWebTotalSessions] = useState('')
  const [webUtmValues, setWebUtmValues] = useState<Record<string, string>>({})
  const [webSaving, setWebSaving] = useState(false)
  const [webOk, setWebOk] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getYouTubeMonthly({ year, month }),
      getNewsletterData({ year, month }),
      getWebData({ year, month }),
    ]).then(([ytRes, nlData, webData]) => {
      if (cancelled) return
      setYtViews(String(ytRes.data?.shorts_views ?? ''))
      setNlNewSubs(String(nlData.monthly?.new_subscribers ?? ''))
      setNlEpisodes(nlData.episodes)
      setWebTotalSessions(String(webData.monthly?.total_sessions ?? ''))
      const vals: Record<string, string> = {}
      UTM_SOURCES.forEach(s => {
        const found = webData.utmSources.find((u: { source: string }) => u.source === s)
        vals[s] = String(found?.sessions ?? '')
      })
      setWebUtmValues(vals)
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  async function saveYouTube() {
    setYtSaving(true)
    await upsertYouTubeMonthly({ year, month, shorts_views: parseInt(ytViews) || 0 })
    clearCache()
    setYtOk(true)
    setTimeout(() => setYtOk(false), 2000)
    setYtSaving(false)
  }

  async function saveNewsletter() {
    setNlSaving(true)
    await upsertNewsletterMonthly({ year, month, new_subscribers: parseInt(nlNewSubs) || 0 })
    clearCache()
    setNlOk(true)
    setTimeout(() => setNlOk(false), 2000)
    setNlSaving(false)
  }

  async function saveEpisode() {
    if (!nlNewEp.title) return
    setNlSaving(true)
    await addNewsletterEpisode({
      year, month,
      episode_number: parseInt(nlNewEp.episode_number) || null,
      title: nlNewEp.title,
      views: parseInt(nlNewEp.views) || 0,
      lead_magnet_downloads: parseInt(nlNewEp.lead_magnet_downloads) || 0,
      published_date: nlNewEp.published_date || null,
      url: nlNewEp.url || null,
    })
    setNlNewEp({ episode_number: '', title: '', views: '', lead_magnet_downloads: '', published_date: '', url: '' })
    setNlShowForm(false)
    const nlData = await getNewsletterData({ year, month })
    setNlEpisodes(nlData.episodes)
    setNlSaving(false)
  }

  async function handleDeleteEpisode(id: string) {
    if (!confirm('¿Eliminar este episodio?')) return
    await deleteNewsletterEpisode(id)
    const nlData = await getNewsletterData({ year, month })
    setNlEpisodes(nlData.episodes)
    clearCache()
  }

  async function saveWeb() {
    setWebSaving(true)
    await upsertWebMonthly({ year, month, total_sessions: parseInt(webTotalSessions) || 0 })
    await Promise.all(UTM_SOURCES.map(s =>
      upsertWebUtmSource({ year, month, source: s, sessions: parseInt(webUtmValues[s] || '0') || 0 })
    ))
    clearCache()
    setWebOk(true)
    setTimeout(() => setWebOk(false), 2000)
    setWebSaving(false)
  }

  // ─── Instagram ───────────────────────────────
  async function handleInstagramFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIg({ ...emptyState, status: 'parsing' })
    try {
      const text = await file.text()
      const rows = parseInstagramCSV(text)
      const detected = detectMonthFromRows(rows)
      if (detected) { setYear(detected.year); setMonth(detected.month) }
      setIg({ status: 'preview', rowCount: rows.length, preview: rows, detectedMonth: detected })
    } catch {
      setIg({ ...emptyState, status: 'error', error: 'No se pudo parsear el CSV. Asegurate de exportarlo desde Meta Business Suite.' })
    }
    e.target.value = ''
  }

  async function confirmInstagram() {
    setIg(s => ({ ...s, status: 'uploading' }))
    try {
      const posts = ig.preview.map((row: ReturnType<typeof parseInstagramCSV>[0]) => ({
        year, month,
        type: row.type,
        description: row.description,
        post_date: row.post_date,
        views: row.views,
        impressions: row.impressions,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        saves: row.saves,
        permalink: row.permalink,
        collab_account: row.collab_account,
        is_manual: false,
      }))
      const { error } = await upsertInstagramPosts(posts)
      if (error) throw error
      clearCache()
      setIg(s => ({ ...s, status: 'done' }))
    } catch (err) {
      setIg(s => ({ ...s, status: 'error', error: (err as { message?: string })?.message ?? String(err) }))
    }
  }

  // ─── LinkedIn ────────────────────────────────
  async function handleLinkedInFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLi({ ...emptyState, status: 'parsing' })
    try {
      const isCSV = file.name.toLowerCase().endsWith('.csv')
      if (isCSV) {
        const text = await file.text()
        const rows = parseLinkedInCSV(text)
        const detected = detectMonthFromRows(rows)
        if (detected) { setYear(detected.year); setMonth(detected.month) }
        setLi({ status: 'preview', rowCount: rows.length, preview: rows, detectedMonth: detected })
      } else {
        const binaryString = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (ev) => resolve(ev.target!.result as string)
          reader.onerror = () => reject(new Error('Error leyendo el archivo'))
          reader.readAsBinaryString(file)
        })
        const { rows, debug } = parseLinkedInXLSWithDebug(binaryString)
        const detected = detectMonthFromRows(rows)
        if (detected) { setYear(detected.year); setMonth(detected.month) }
        setLi({ status: 'preview', rowCount: rows.length, preview: rows, debug, detectedMonth: detected })
      }
    } catch (err) {
      setLi({ ...emptyState, status: 'error', error: `No se pudo parsear el archivo: ${(err as { message?: string })?.message ?? String(err)}` })
    }
    e.target.value = ''
  }

  async function confirmLinkedIn() {
    setLi(s => ({ ...s, status: 'uploading' }))
    try {
      const posts = li.preview.map((row: ReturnType<typeof parseLinkedInXLS>[0]) => ({
        year, month,
        title: row.title,
        permalink: row.permalink,
        post_date: row.post_date,
        impressions: row.impressions,
        interactions: row.interactions,
        er_decimal: row.er_decimal,
        is_manual: false,
      }))
      const { error } = await upsertLinkedInPosts(posts)
      if (error) throw error
      clearCache()
      setLi(s => ({ ...s, status: 'done' }))
    } catch (err) {
      setLi(s => ({ ...s, status: 'error', error: (err as { message?: string })?.message ?? String(err) }))
    }
  }

  // ─── TikTok ──────────────────────────────────
  async function handleTikTokFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setTt({ ...emptyState, status: 'parsing' })
    try {
      const text = await file.text()
      const rows = parseTikTokCSV(text, year, month)
      const detected = detectMonthFromRows(rows)
      if (detected) { setYear(detected.year); setMonth(detected.month) }
      setTt({ status: 'preview', rowCount: rows.length, preview: rows, detectedMonth: detected })
    } catch (err) {
      setTt({ ...emptyState, status: 'error', error: String(err) })
    }
    e.target.value = ''
  }

  async function confirmTikTok() {
    setTt(s => ({ ...s, status: 'uploading' }))
    try {
      const videos = tt.preview.map((row: ReturnType<typeof parseTikTokCSV>[0]) => ({
        year, month,
        title: row.title,
        permalink: row.permalink,
        video_date: row.video_date,
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        is_manual: false,
      }))
      const { error } = await upsertTikTokVideos(videos)
      if (error) throw error
      clearCache()
      setTt(s => ({ ...s, status: 'done' }))
    } catch (err) {
      setTt(s => ({ ...s, status: 'error', error: (err as { message?: string })?.message ?? String(err) }))
    }
  }

  // ─── TikTok Overview ─────────────────────────
  async function handleTikTokOverviewFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setTtOv({ ...emptyState, status: 'parsing' })
    try {
      const text = await file.text()
      const overview = parseTikTokOverviewCSV(text)
      setTtOv({ status: 'preview', rowCount: 1, preview: [overview] })
    } catch (err) {
      setTtOv({ ...emptyState, status: 'error', error: String(err) })
    }
    e.target.value = ''
  }

  async function confirmTikTokOverview() {
    setTtOv(s => ({ ...s, status: 'uploading' }))
    try {
      const { total_views, total_interactions } = ttOv.preview[0]
      const { error } = await upsertTikTokMonthly({ year, month, total_views, total_interactions })
      if (error) throw error
      clearCache()
      setTtOv(s => ({ ...s, status: 'done' }))
    } catch (err) {
      setTtOv(s => ({ ...s, status: 'error', error: (err as { message?: string })?.message ?? String(err) }))
    }
  }

  // ─── TikTok Follower History ─────────────────
  async function handleTikTokFollowerFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setTtFoll({ ...emptyState, status: 'parsing' })
    try {
      const text = await file.text()
      const data = parseTikTokFollowerHistoryCSV(text)
      setTtFoll({ status: 'preview', rowCount: 1, preview: [data] })
    } catch (err) {
      setTtFoll({ ...emptyState, status: 'error', error: (err as { message?: string })?.message ?? String(err) })
    }
    e.target.value = ''
  }

  async function confirmTikTokFollowers() {
    setTtFoll(s => ({ ...s, status: 'uploading' }))
    try {
      const { total_followers, new_followers } = ttFoll.preview[0]
      const { error } = await upsertTikTokMonthly({ year, month, total_followers, new_followers })
      if (error) throw error
      clearCache()
      setTtFoll(s => ({ ...s, status: 'done' }))
    } catch (err) {
      setTtFoll(s => ({ ...s, status: 'error', error: (err as { message?: string })?.message ?? String(err) }))
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cargar datos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Subí los exports de cada plataforma · {monthLabel(year, month)}</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {/* Info banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6 text-sm text-emerald-800">
        <strong>Deduplicación automática:</strong> Si ya subiste datos de este mes, reimportar el CSV actualiza los registros existentes (por permalink/video link) sin duplicar. Los posts manuales que no estén en el CSV se mantienen.
      </div>

      <div className="space-y-4">
        {/* Instagram */}
        <UploadCard
          icon={<Camera size={18} />}
          title="Instagram"
          subtitle="Meta Business Suite → Contenido → Exportar CSV"
          accept=".csv"
          state={ig}
          onFile={handleInstagramFile}
          onConfirm={confirmInstagram}
          onReset={() => setIg(emptyState)}
          previewColumns={['type', 'description', 'views', 'impressions', 'likes']}
        />

        {/* LinkedIn */}
        <UploadCard
          icon={<Briefcase size={18} />}
          title="LinkedIn"
          subtitle="LinkedIn Analytics → Publicaciones → Exportar (CSV o XLS)"
          accept=".xlsx,.xls,.csv"
          state={li}
          onFile={handleLinkedInFile}
          onConfirm={confirmLinkedIn}
          onReset={() => setLi(emptyState)}
          previewColumns={['title', 'impressions', 'interactions', 'er_decimal']}
          showDebug
        />

        {/* TikTok Content */}
        <UploadCard
          icon={<Music2 size={18} />}
          title="TikTok — Top contenidos"
          subtitle="TikTok Studio → Contenido → seleccioná rango de fechas → Exportar CSV"
          accept=".csv"
          state={tt}
          onFile={handleTikTokFile}
          onConfirm={confirmTikTok}
          onReset={() => setTt(emptyState)}
          previewColumns={['title', 'views', 'likes', 'comments', 'shares']}
        />

        {/* TikTok Overview */}
        <UploadCard
          icon={<Music2 size={18} />}
          title="TikTok — Resumen del mes (Overview)"
          subtitle="TikTok Studio → Overview → seleccioná el mes → Exportar CSV"
          accept=".csv"
          state={ttOv}
          onFile={handleTikTokOverviewFile}
          onConfirm={confirmTikTokOverview}
          onReset={() => setTtOv(emptyState)}
          previewColumns={['total_views', 'total_interactions']}
        />

        {/* TikTok Followers */}
        <UploadCard
          icon={<Music2 size={18} />}
          title="TikTok — Seguidores"
          subtitle="TikTok Studio → Seguidores → Historial de seguidores → Exportar CSV"
          accept=".csv"
          state={ttFoll}
          onFile={handleTikTokFollowerFile}
          onConfirm={confirmTikTokFollowers}
          onReset={() => setTtFoll(emptyState)}
          previewColumns={['total_followers', 'new_followers', 'daysInExport']}
        />
      </div>

      {/* YouTube Shorts manual entry */}
      <div className="presentation-hide">
        <div className="flex items-center gap-2 mt-8 mb-4">
          <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Datos manuales</div>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <Play size={18} />
            </div>
            <div>
              <div className="font-semibold text-gray-900">YouTube Shorts</div>
              <div className="text-xs text-gray-400">Views mensuales de Shorts en YouTube Studio</div>
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Views del mes</label>
              <input
                type="number"
                value={ytViews}
                onChange={e => setYtViews(e.target.value)}
                placeholder="0"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <button
              onClick={saveYouTube}
              disabled={ytSaving}
              className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-red-400 disabled:opacity-50"
            >
              {ytSaving ? 'Guardando...' : ytOk ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>
        </Card>

        {/* Newsletter */}
        <Card className="mt-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 shrink-0">
              <Mail size={18} />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Newsletter</div>
              <div className="text-xs text-gray-400">Nuevos suscriptores y episodios del mes</div>
            </div>
          </div>

          <div className="flex gap-3 items-end mb-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nuevos suscriptores</label>
              <input
                type="number"
                value={nlNewSubs}
                onChange={e => setNlNewSubs(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-36 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={saveNewsletter}
              disabled={nlSaving}
              className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              {nlSaving ? 'Guardando...' : nlOk ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-700">Episodios ({nlEpisodes.length})</div>
              <button
                onClick={() => setNlShowForm(v => !v)}
                className="flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400"
              >
                <Plus size={13} /> Agregar episodio
              </button>
            </div>

            {nlShowForm && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Episodio #</label>
                    <input type="number" value={nlNewEp.episode_number} onChange={e => setNlNewEp(v => ({ ...v, episode_number: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Título *</label>
                    <input type="text" value={nlNewEp.title} onChange={e => setNlNewEp(v => ({ ...v, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Views</label>
                    <input type="number" value={nlNewEp.views} onChange={e => setNlNewEp(v => ({ ...v, views: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Lead magnet downloads</label>
                    <input type="number" value={nlNewEp.lead_magnet_downloads} onChange={e => setNlNewEp(v => ({ ...v, lead_magnet_downloads: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha de publicación</label>
                    <input type="date" value={nlNewEp.published_date} onChange={e => setNlNewEp(v => ({ ...v, published_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-3">
                    <label className="text-xs text-gray-500 block mb-1">URL del artículo</label>
                    <input type="url" value={nlNewEp.url} onChange={e => setNlNewEp(v => ({ ...v, url: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveEpisode} disabled={nlSaving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {nlSaving ? 'Guardando...' : 'Guardar episodio'}
                  </button>
                  <button onClick={() => setNlShowForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            {nlEpisodes.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">#</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Título</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Views</th>
                    <th className="py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {nlEpisodes.map(ep => (
                    <tr key={ep.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="py-2 px-2 text-gray-400 font-mono text-xs">#{ep.episode_number ?? '—'}</td>
                      <td className="py-2 px-2 text-gray-700 truncate max-w-xs">{ep.title}</td>
                      <td className="py-2 px-2 text-right font-medium">{ep.views ?? 0}</td>
                      <td className="py-2 px-2 text-right">
                        <button onClick={() => handleDeleteEpisode(ep.id)} className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Tráfico Web */}
        <Card className="mt-4">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <Globe size={18} />
            </div>
            <div>
              <div className="font-semibold text-gray-900">Tráfico web</div>
              <div className="text-xs text-gray-400">Sesiones y fuentes UTM del mes — Webflow Analytics</div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sesiones totales</label>
              <input
                type="number"
                value={webTotalSessions}
                onChange={e => setWebTotalSessions(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="text-xs font-medium text-gray-500 mb-2">Sesiones por UTM source</div>
              {UTM_SOURCES.map(s => (
                <div key={s} className="flex items-center gap-3 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: UTM_COLORS[s] }} />
                  <label className="text-sm text-gray-600 w-20 capitalize">{s}</label>
                  <input
                    type="number"
                    value={webUtmValues[s] ?? ''}
                    onChange={e => setWebUtmValues(v => ({ ...v, [s]: e.target.value }))}
                    className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveWeb}
              disabled={webSaving}
              className="w-full bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
            >
              {webSaving ? 'Guardando...' : webOk ? '✓ Guardado' : 'Guardar todo'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Reusable upload card ─────────────────────

interface UploadCardProps {
  icon: React.ReactNode
  title: string
  subtitle: string
  accept: string
  state: UploadState
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  onConfirm: () => void
  onReset: () => void
  previewColumns: string[]
  showDebug?: boolean
  detectedMonth?: { year: number; month: number } | null
}

function UploadCard({ icon, title, subtitle, accept, state, onFile, onConfirm, onReset, previewColumns, showDebug }: UploadCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
            {icon}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{title}</div>
            <div className="text-xs text-gray-400">{subtitle}</div>
          </div>
        </div>
        {state.status !== 'idle' && state.status !== 'done' && (
          <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600">Reiniciar</button>
        )}
      </div>

      {state.status === 'idle' && (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl py-8 cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors">
          <Upload size={20} className="text-gray-300 mb-2" />
          <span className="text-sm text-gray-500">Arrastrá el archivo o hacé click para subir</span>
          <span className="text-xs text-gray-400 mt-1">{accept.replace(/\./g, '').toUpperCase()}</span>
          <input type="file" accept={accept} onChange={onFile} className="hidden" />
        </label>
      )}

      {state.status === 'parsing' && (
        <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Procesando archivo...</div>
      )}

      {state.status === 'error' && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} />
          {state.error}
        </div>
      )}

      {state.status === 'preview' && showDebug && state.rowCount === 0 && state.debug && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-mono text-amber-900 space-y-1 overflow-x-auto">
          <div className="font-semibold text-amber-800 mb-2">Diagnóstico (0 registros detectados)</div>
          <div>Hojas: [{state.debug.sheetNames.join(', ')}] → usando &quot;{state.debug.usedSheet}&quot;</div>
          <div>Filas totales: {state.debug.totalRows} | Fila de encabezado detectada: {state.debug.headerRowIdx}</div>
          <div>Índices de columnas: {JSON.stringify(state.debug.columnIndices)}</div>
          {state.debug.first4Rows.map((row, i) => (
            <div key={i} className="truncate">Fila {i}: [{row.filter(Boolean).slice(0, 5).map(c => `"${c}"`).join(', ')}]</div>
          ))}
        </div>
      )}

      {state.status === 'preview' && (
        <div>
          {state.detectedMonth && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 mb-2">
              Mes detectado automáticamente: {new Date(state.detectedMonth.year, state.detectedMonth.month - 1).toLocaleString('es', { month: 'long', year: 'numeric' })}
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{state.rowCount} registros</span> encontrados. Revisá antes de confirmar.
            </div>
            <div className="flex gap-2">
              <button onClick={onReset} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button onClick={onConfirm} className="text-sm bg-emerald-500 text-white px-4 py-1.5 rounded-lg font-medium hover:bg-emerald-400">
                Confirmar importación
              </button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  {previewColumns.map(col => (
                    <th key={col} className="text-left px-3 py-2 text-gray-500 font-medium capitalize">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {state.preview.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    {previewColumns.map(col => (
                      <td key={col} className="px-3 py-2 text-gray-700 max-w-[200px] truncate">
                        {col === 'er_decimal' ? `${(parseFloat(row[col] || 0) * 100).toFixed(2)}%` : String(row[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
                {state.preview.length > 5 && (
                  <tr className="border-t border-gray-100">
                    <td colSpan={previewColumns.length} className="px-3 py-2 text-gray-400 text-center">
                      + {state.preview.length - 5} registros más
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state.status === 'uploading' && (
        <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Guardando en base de datos...</div>
      )}

      {state.status === 'done' && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle size={16} />
          <span><strong>{state.rowCount} registros</strong> importados correctamente. Los totales ya se actualizaron.</span>
        </div>
      )}
    </Card>
  )
}
