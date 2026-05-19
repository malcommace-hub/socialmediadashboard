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

export interface LinkedInDebugInfo {
  sheetNames: string[]
  usedSheet: string
  totalRows: number
  headerRowIdx: number
  first4Rows: string[][]
  columnIndices: Record<string, number>
}

function linkedInParseCore(buffer: ArrayBuffer): { rows: RawLinkedInRow[]; debug: LinkedInDebugInfo } {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })

  const sheetName = wb.SheetNames.includes('Todas las publicaciones')
    ? 'Todas las publicaciones'
    : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]

  const rawRows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' })

  const debug: LinkedInDebugInfo = {
    sheetNames: wb.SheetNames,
    usedSheet: sheetName,
    totalRows: rawRows.length,
    headerRowIdx: -1,
    first4Rows: rawRows.slice(0, 4).map(r => r.map(c => String(c).slice(0, 80))),
    columnIndices: {},
  }

  if (rawRows.length < 2) return { rows: [], debug }

  // Normalize: lowercase + strip combining diacritics (encoding-agnostic)
  const normalize = (s: string) =>
    String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  // Detect header row: first row in the first 8 that has ≥3 non-empty cells
  // AND where the joined text contains any known column keyword after normalization.
  // This avoids picking a metadata/description row that happens to have many cells.
  const KEYWORDS = ['impresion', 'impression', 'publicacion', 'publication', 'creacion', 'creation', 'enlace', 'link', 'titulo', 'title']
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
    const row = rawRows[i]
    const nonEmpty = row.filter(c => String(c).trim().length > 0).length
    if (nonEmpty < 3) continue
    const joined = normalize(row.join(' '))
    if (KEYWORDS.some(kw => joined.includes(kw))) {
      headerRowIdx = i
      break
    }
  }

  // Fallback: structural detection (≥5 non-empty, first cell short)
  if (headerRowIdx === -1) {
    for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
      const row = rawRows[i]
      const nonEmpty = row.filter(c => String(c).trim().length > 0).length
      const firstCellLen = String(row[0] ?? '').trim().length
      if (nonEmpty >= 5 && firstCellLen < 120) {
        headerRowIdx = i
        break
      }
    }
  }

  debug.headerRowIdx = headerRowIdx

  if (headerRowIdx === -1 || headerRowIdx >= rawRows.length - 1) return { rows: [], debug }

  const headers = rawRows[headerRowIdx].map(normalize)

  const idx = (names: string[]): number => {
    for (const name of names) {
      const n = normalize(name)
      const i = headers.findIndex(h => h.includes(n))
      if (i !== -1) return i
    }
    return -1
  }

  const iTitle       = idx(['titulo de la publicacion', 'post title', 'title'])
  const iPermalink   = idx(['enlace de la publicacion', 'post link', 'url'])
  const iDate        = idx(['fecha de creacion', 'created date', 'fecha'])
  const iImpressions = idx(['impresiones', 'impressions'])
  const iClicks      = idx(['clics', 'clicks'])
  const iReactions   = idx(['recomendaciones', 'reactions', 'reacciones'])
  const iComments    = idx(['comentarios', 'comments'])
  const iShares      = idx(['veces compartido', 'shares'])
  const iER          = idx(['tasa de interaccion', 'engagement rate'])

  debug.columnIndices = { iTitle, iPermalink, iDate, iImpressions, iClicks, iReactions, iComments, iShares, iER }

  const getNum = (row: string[], i: number): number =>
    i >= 0 ? parseFloat(String(row[i] ?? '').replace(',', '.')) || 0 : 0

  const rows = rawRows.slice(headerRowIdx + 1).map(row => {
    const impressions  = getNum(row, iImpressions)
    const clicks       = getNum(row, iClicks)
    const reactions    = getNum(row, iReactions)
    const comments     = getNum(row, iComments)
    const shares       = getNum(row, iShares)
    const interactions = clicks + reactions + comments + shares

    let er_decimal = getNum(row, iER)
    if (er_decimal > 1) er_decimal = er_decimal / 100

    const rawDate = iDate >= 0 ? String(row[iDate] ?? '') : ''
    const post_date = parseDateMMDDYYYY(rawDate)

    const title = iTitle >= 0 ? String(row[iTitle] ?? '').trim() : ''
    const permalink = iPermalink >= 0 ? String(row[iPermalink] ?? '').trim() || null : null

    return { title, permalink, post_date, impressions, interactions, er_decimal }
  }).filter(r => r.title || r.impressions > 0 || r.permalink)

  return { rows, debug }
}

export function parseLinkedInXLS(buffer: ArrayBuffer): RawLinkedInRow[] {
  return linkedInParseCore(buffer).rows
}

export function parseLinkedInXLSWithDebug(buffer: ArrayBuffer): { rows: RawLinkedInRow[]; debug: LinkedInDebugInfo } {
  return linkedInParseCore(buffer)
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
