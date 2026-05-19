import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ─── Instagram CSV (Meta Business Suite → Content export) ────────────────────
// Real columns from weareseeds_ export:
//   Post ID, Account ID, Account username, Account name, Description,
//   Duration (sec), Publish time, Permalink, Post type, Data comment, Date,
//   Views, Likes, Shares, Comments, Saves, Reach, Follows
//
// Notes:
//   - No "Impressions" column — only Views and Reach
//   - We use max(Views, Reach) as the single reach/views metric
//   - Collab posts are detected by Account username != "weareseeds_"
//   - Publish time format: "MM/DD/YYYY HH:MM"
export interface RawInstagramRow {
  description: string
  type: 'Reel' | 'Post' | 'Collab' | 'Story'
  post_date: string | null
  permalink: string | null
  impressions: number  // max(Views, Reach) — single unified metric
  views: number        // same value, kept for DB compatibility
  likes: number
  comments: number
  shares: number
  saves: number
  collab_account: string | null
}

function normalizeInstagramType(raw: string): 'Reel' | 'Post' | 'Collab' | 'Story' {
  const lower = raw.toLowerCase()
  if (lower.includes('reel')) return 'Reel'
  if (lower.includes('story') || lower.includes('stories')) return 'Story'
  if (lower.includes('collab')) return 'Collab'
  return 'Post'
}

function parseDateMMDDYYYYTime(raw: string): string | null {
  // "04/01/2026 15:32" → "2026-04-01"
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return raw.slice(0, 10) || null
}

export function parseInstagramCSV(text: string): RawInstagramRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/[\s()]/g, '_').replace(/_+/g, '_').replace(/_$/, ''),
  })

  return result.data.map(row => {
    const permalink    = row['permalink'] || null
    const description  = row['description'] || ''
    const username     = (row['account_username'] || '').toLowerCase().trim()
    const rawType      = row['post_type'] || row['type'] || row['content_type'] || 'Post'

    // Collab = post from an account that isn't weareseeds_
    const isCollab     = username !== '' && username !== 'weareseeds_'
    const collab_account = isCollab ? `@${row['account_username'] || username}` : null
    const type         = isCollab ? 'Collab' : normalizeInstagramType(rawType)

    const views  = parseFloat(row['views'] || '0') || 0
    const reach  = parseFloat(row['reach'] || '0') || 0
    const maxVal = Math.max(views, reach) // unified metric as requested

    return {
      description,
      type,
      post_date: row['publish_time'] ? parseDateMMDDYYYYTime(row['publish_time']) : null,
      permalink,
      impressions: maxVal,
      views: maxVal,
      likes:    parseFloat(row['likes']    || '0') || 0,
      comments: parseFloat(row['comments'] || '0') || 0,
      shares:   parseFloat(row['shares']   || '0') || 0,
      saves:    parseFloat(row['saves']    || '0') || 0,
      collab_account,
    }
  }).filter(r => r.permalink || r.description)
}

// ─── LinkedIn XLS (LinkedIn Analytics → Exportar) ─────────────────────────
// Real structure from weareseeders export:
//   Sheet: "Todas las publicaciones"
//   Row 1: long description string (skip)
//   Row 2: actual column headers in Spanish
//   Row 3+: post data
//
// Relevant columns (Spanish):
//   "Título de la publicación", "Enlace de la publicación", "Fecha de creación",
//   "Impresiones", "Clics", "Recomendaciones", "Comentarios", "Veces compartido",
//   "Tasa de interacción"
export interface RawLinkedInRow {
  title: string
  permalink: string | null
  post_date: string | null
  impressions: number
  interactions: number
  er_decimal: number
}

function parseDateMMDDYYYY(raw: string): string | null {
  // Converts "04/30/2026" → "2026-04-30"
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return raw.slice(0, 10) || null
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export function parseLinkedInXLS(buffer: ArrayBuffer): RawLinkedInRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })

  // Use "Todas las publicaciones" sheet if present, otherwise first sheet
  const sheetName = wb.SheetNames.includes('Todas las publicaciones')
    ? 'Todas las publicaciones'
    : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  // sheet_to_json with header:1 gives raw arrays so we can handle the 2-row header
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

  // Row 0 = long description, Row 1 = actual column headers, Row 2+ = data
  if (rows.length < 3) return []

  const headers: string[] = rows[1].map(h => String(h).trim())

  const idx = (names: string[]): number => {
    for (const name of names) {
      const i = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()))
      if (i !== -1) return i
    }
    return -1
  }

  const iTitle       = idx(['título de la publicación', 'post title', 'title'])
  const iPermalink   = idx(['enlace de la publicación', 'post link', 'url'])
  const iDate        = idx(['fecha de creación', 'created date', 'fecha'])
  const iImpressions = idx(['impresiones'])
  const iClicks      = idx(['clics', 'clicks'])
  const iReactions   = idx(['recomendaciones', 'reactions', 'reacciones'])
  const iComments    = idx(['comentarios', 'comments'])
  const iShares      = idx(['veces compartido', 'shares'])
  const iER          = idx(['tasa de interacción', 'engagement rate', 'tasa de interaccion'])

  const getNum = (row: string[], i: number): number =>
    i >= 0 ? parseFloat(row[i]?.replace(',', '.') || '0') || 0 : 0

  return rows.slice(2).map(row => {
    const impressions  = getNum(row, iImpressions)
    const clicks       = getNum(row, iClicks)
    const reactions    = getNum(row, iReactions)
    const comments     = getNum(row, iComments)
    const shares       = getNum(row, iShares)
    const interactions = clicks + reactions + comments + shares

    let er_decimal = getNum(row, iER)
    if (er_decimal > 1) er_decimal = er_decimal / 100

    const rawDate = iDate >= 0 ? (row[iDate] || '') : ''
    const post_date = parseDateMMDDYYYY(rawDate)

    return {
      title:      iTitle >= 0 ? (row[iTitle] || '') : '',
      permalink:  iPermalink >= 0 ? (row[iPermalink] || null) : null,
      post_date,
      impressions,
      interactions,
      er_decimal,
    }
  }).filter(r => r.impressions > 0 || r.title)
}

// ─── TikTok CSV (TikTok Studio) ──────────────
// Headers: Video title, Video link, Views, Likes, Comments, Shares, Date
export interface RawTikTokRow {
  title: string
  permalink: string | null
  video_date: string | null
  views: number
  likes: number
  comments: number
  shares: number
}

export function parseTikTokCSV(text: string): RawTikTokRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  return result.data.map(row => ({
    title: row['video_title'] || row['title'] || '',
    permalink: row['video_link'] || row['link'] || row['url'] || null,
    video_date: row['date'] || row['publish_date'] || null,
    views: parseFloat(row['views'] || row['video_views'] || '0') || 0,
    likes: parseFloat(row['likes'] || '0') || 0,
    comments: parseFloat(row['comments'] || '0') || 0,
    shares: parseFloat(row['shares'] || '0') || 0,
  })).filter(r => r.views > 0 || r.title)
}
