'use client'
import { useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { MonthSelector } from '@/components/ui/month-selector'
import { parseInstagramCSV, parseLinkedInCSV, parseLinkedInXLS, parseLinkedInXLSWithDebug, parseTikTokCSV, parseTikTokOverviewCSV, parseTikTokFollowerHistoryCSV, type LinkedInDebugInfo } from '@/lib/parsers'
import { upsertInstagramPosts, upsertLinkedInPosts, upsertTikTokVideos, upsertTikTokMonthly } from '@/lib/queries'
import { clearCache } from '@/lib/queryCache'
import { currentYearMonth, monthLabel } from '@/lib/utils'
import { Upload, CheckCircle, AlertCircle, Camera, Briefcase, Music2 } from 'lucide-react'

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

      {/* Quick links */}
      <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-sm font-medium text-gray-700 mb-2">Datos manuales</div>
        <p className="text-sm text-gray-500">
          Para seguidores, YouTube Shorts, Newsletter y datos de Web/UTM, usá las secciones específicas de cada canal en el menú lateral.
        </p>
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
