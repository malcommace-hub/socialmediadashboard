import Papa from 'papaparse'
import * as XLSX from 'xlsx'

// ─── Instagram CSV (Meta Business Suite) ─────
// Headers: Description, Content type, Publish time, Permalink,
//          Impressions, Reach, Likes, Comments, Shares, Saves, Views
export interface RawInstagramRow {
  description: string
  type: 'Reel' | 'Post' | 'Collab' | 'Story'
  post_date: string | null
  permalink: string | null
  impressions: number
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  collab_account: string | null
}

function detectCollabAccount(description: string, permalink: string | null): string | null {
  // Collabs from other accounts have permalink pointing to another account
  if (!permalink) return null
  const match = permalink.match(/instagram\.com\/([^/]+)\//)
  if (match && match[1] !== 'weareseeds_' && match[1] !== 'p' && match[1] !== 'reel') {
    return `@${match[1]}`
  }
  // Also check if description mentions another account handle
  const descMatch = description.match(/@[\w.]+/)
  if (descMatch && !description.toLowerCase().includes('weareseeds')) {
    return descMatch[0]
  }
  return null
}

function normalizeInstagramType(raw: string): 'Reel' | 'Post' | 'Collab' | 'Story' {
  const lower = raw.toLowerCase()
  if (lower.includes('reel')) return 'Reel'
  if (lower.includes('story') || lower.includes('stories')) return 'Story'
  if (lower.includes('collab')) return 'Collab'
  return 'Post'
}

export function parseInstagramCSV(text: string): RawInstagramRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  })

  return result.data.map(row => {
    const permalink = row['permalink'] || row['post_link'] || row['url'] || null
    const description = row['description'] || row['post_description'] || ''
    const rawType = row['content_type'] || row['type'] || row['media_type'] || 'Post'

    const collab_account = detectCollabAccount(description, permalink)
    const type = collab_account ? 'Collab' : normalizeInstagramType(rawType)

    return {
      description,
      type,
      post_date: row['publish_time'] ? row['publish_time'].slice(0, 10) : null,
      permalink,
      impressions: parseFloat(row['impressions'] || '0') || 0,
      views: parseFloat(row['video_views'] || row['views'] || row['reach'] || '0') || 0,
      likes: parseFloat(row['likes'] || '0') || 0,
      comments: parseFloat(row['comments'] || '0') || 0,
      shares: parseFloat(row['shares'] || '0') || 0,
      saves: parseFloat(row['saves'] || '0') || 0,
      collab_account,
    }
  }).filter(r => r.permalink || r.description) // at least one identifier
}

// ─── LinkedIn XLS (LinkedIn Analytics → Content) ─
// Headers: Post title, Post link, Created date, Impressions, Clicks, Reactions, Comments, Shares, Engagement rate
export interface RawLinkedInRow {
  title: string
  permalink: string | null
  post_date: string | null
  impressions: number
  interactions: number
  er_decimal: number
}

export function parseLinkedInXLS(buffer: ArrayBuffer): RawLinkedInRow[] {
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: false })

  return raw.map(row => {
    // Normalize keys
    const keys = Object.keys(row).reduce<Record<string, string>>((acc, k) => {
      acc[k.toLowerCase().trim().replace(/\s+/g, '_')] = String(row[k] ?? '')
      return acc
    }, {})

    const interactions =
      (parseFloat(keys['reactions'] || '0') || 0) +
      (parseFloat(keys['comments'] || '0') || 0) +
      (parseFloat(keys['shares'] || '0') || 0) +
      (parseFloat(keys['clicks'] || '0') || 0)

    const erRaw = keys['engagement_rate'] || keys['er'] || '0'
    // LinkedIn exports ER as decimal (0.0966) or percent (9.66%)
    let er_decimal = parseFloat(erRaw.replace('%', '')) || 0
    if (er_decimal > 1) er_decimal = er_decimal / 100 // was percent

    return {
      title: keys['post_title'] || keys['title'] || keys['content'] || '',
      permalink: keys['post_link'] || keys['url'] || keys['permalink'] || null,
      post_date: keys['created_date'] || keys['date'] || null,
      impressions: parseFloat(keys['impressions'] || '0') || 0,
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
