export interface MonthlyFilter {
  year: number
  month: number
}

// ─── Instagram ───────────────────────────────
export interface InstagramMonthly {
  id: string
  year: number
  month: number
  total_followers: number
  new_followers: number
}

export interface InstagramPost {
  id: string
  year: number
  month: number
  post_date: string | null
  type: 'Reel' | 'Post' | 'Collab' | 'Story'
  description: string | null
  views: number
  impressions: number
  likes: number
  comments: number
  shares: number
  saves: number
  permalink: string | null
  collab_account: string | null
  is_manual: boolean
}

export interface InstagramStats {
  monthly: InstagramMonthly | null
  posts: InstagramPost[]
  totalViews: number
  totalImpressions: number
  totalInteractions: number
  avgER: number
}

// ─── LinkedIn ────────────────────────────────
export interface LinkedInMonthly {
  id: string
  year: number
  month: number
  total_followers: number
  new_followers: number
}

export interface LinkedInPost {
  id: string
  year: number
  month: number
  post_date: string | null
  title: string | null
  impressions: number
  interactions: number
  er_decimal: number
  permalink: string | null
  is_manual: boolean
}

export interface LinkedInStats {
  monthly: LinkedInMonthly | null
  posts: LinkedInPost[]
  totalImpressions: number
  totalInteractions: number
  avgER: number
}

// ─── TikTok ──────────────────────────────────
export interface TikTokMonthly {
  id: string
  year: number
  month: number
  total_followers: number
  new_followers: number
}

export interface TikTokVideo {
  id: string
  year: number
  month: number
  video_date: string | null
  title: string | null
  views: number
  likes: number
  comments: number
  shares: number
  permalink: string | null
  is_manual: boolean
}

export interface TikTokStats {
  monthly: TikTokMonthly | null
  videos: TikTokVideo[]
  totalViews: number
  totalInteractions: number
}

// ─── YouTube ─────────────────────────────────
export interface YouTubeMonthly {
  id: string
  year: number
  month: number
  shorts_views: number
}

// ─── Newsletter ──────────────────────────────
export interface NewsletterMonthly {
  id: string
  year: number
  month: number
  new_subscribers: number
}

export interface NewsletterEpisode {
  id: string
  year: number
  month: number
  episode_number: number | null
  title: string | null
  views: number
  lead_magnet_downloads: number
  published_date: string | null
}

// ─── Web ─────────────────────────────────────
export interface WebMonthly {
  id: string
  year: number
  month: number
  total_sessions: number
}

export interface WebUtmSource {
  id: string
  year: number
  month: number
  source: string
  sessions: number
}

// ─── Objectives ──────────────────────────────
export interface Objective {
  id: string
  year: number
  quarter: number
  channel: string
  metric: string
  target_value: number
}

// ─── Overview ────────────────────────────────
export interface OverviewData {
  ig: InstagramStats
  li: LinkedInStats
  tt: TikTokStats
  yt: YouTubeMonthly | null
  web: { monthly: WebMonthly | null; utmSources: WebUtmSource[] }
  newsletter: { monthly: NewsletterMonthly | null; episodes: NewsletterEpisode[] }
}
