import { supabase } from './supabase'
import type { MonthlyFilter, InstagramPost, LinkedInPost, TikTokVideo, NewsletterEpisode, WebUtmSource } from './types'
import { computeAvgER, computeAvgERFromDecimal } from './utils'

// ─── Instagram ───────────────────────────────

export async function getInstagramStats(filter: MonthlyFilter) {
  const { year, month } = filter

  const [monthlyRes, postsRes] = await Promise.all([
    supabase.from('instagram_monthly').select('*').eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('instagram_posts').select('*').eq('year', year).eq('month', month).order('post_date', { ascending: false }),
  ])

  const posts: InstagramPost[] = postsRes.data ?? []
  const totalViews = posts.reduce((a, p) => a + (p.views ?? 0), 0)
  const totalImpressions = posts.reduce((a, p) => a + (p.impressions ?? 0), 0)
  const totalInteractions = posts.reduce((a, p) => a + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0), 0)
  const avgER = computeAvgER(posts.map(p => ({ impressions: p.impressions, interactions: (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0) })))

  return {
    monthly: monthlyRes.data ?? null,
    posts,
    totalViews,
    totalImpressions,
    totalInteractions,
    avgER,
  }
}

export async function upsertInstagramMonthly(data: { year: number; month: number; total_followers: number; new_followers: number }) {
  return supabase.from('instagram_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function upsertInstagramPosts(posts: Omit<InstagramPost, 'id'>[]) {
  return supabase.from('instagram_posts').upsert(posts, { onConflict: 'permalink', ignoreDuplicates: false })
}

export async function addInstagramPostManual(post: Omit<InstagramPost, 'id'>) {
  return supabase.from('instagram_posts').upsert(post, { onConflict: 'permalink', ignoreDuplicates: false }).select().single()
}

export async function deleteInstagramPost(id: string) {
  return supabase.from('instagram_posts').delete().eq('id', id)
}

// ─── LinkedIn ────────────────────────────────

export async function getLinkedInStats(filter: MonthlyFilter) {
  const { year, month } = filter

  const [monthlyRes, postsRes] = await Promise.all([
    supabase.from('linkedin_monthly').select('*').eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('linkedin_posts').select('*').eq('year', year).eq('month', month).order('post_date', { ascending: false }),
  ])

  const posts: LinkedInPost[] = postsRes.data ?? []
  const totalImpressions = posts.reduce((a, p) => a + (p.impressions ?? 0), 0)
  const totalInteractions = posts.reduce((a, p) => a + (p.interactions ?? 0), 0)
  const avgER = computeAvgERFromDecimal(posts)

  return {
    monthly: monthlyRes.data ?? null,
    posts,
    totalImpressions,
    totalInteractions,
    avgER,
  }
}

export async function upsertLinkedInMonthly(data: { year: number; month: number; total_followers: number; new_followers: number }) {
  return supabase.from('linkedin_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function upsertLinkedInPosts(posts: Omit<LinkedInPost, 'id'>[]) {
  return supabase.from('linkedin_posts').upsert(posts, { onConflict: 'permalink', ignoreDuplicates: false })
}

export async function deleteLinkedInPost(id: string) {
  return supabase.from('linkedin_posts').delete().eq('id', id)
}

// ─── TikTok ──────────────────────────────────

export async function getTikTokStats(filter: MonthlyFilter) {
  const { year, month } = filter

  const [monthlyRes, videosRes] = await Promise.all([
    supabase.from('tiktok_monthly').select('*').eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('tiktok_videos').select('*').eq('year', year).eq('month', month).order('video_date', { ascending: false }),
  ])

  const videos: TikTokVideo[] = videosRes.data ?? []
  const totalViews = videos.reduce((a, v) => a + (v.views ?? 0), 0)
  const totalInteractions = videos.reduce((a, v) => a + (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0), 0)

  return {
    monthly: monthlyRes.data ?? null,
    videos,
    totalViews,
    totalInteractions,
  }
}

export async function upsertTikTokMonthly(data: { year: number; month: number; total_followers: number; new_followers: number }) {
  return supabase.from('tiktok_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function upsertTikTokVideos(videos: Omit<TikTokVideo, 'id'>[]) {
  return supabase.from('tiktok_videos').upsert(videos, { onConflict: 'permalink', ignoreDuplicates: false })
}

export async function addTikTokVideoManual(video: Omit<TikTokVideo, 'id'>) {
  return supabase.from('tiktok_videos').insert(video).select().single()
}

export async function deleteTikTokVideo(id: string) {
  return supabase.from('tiktok_videos').delete().eq('id', id)
}

// ─── YouTube ─────────────────────────────────

export async function getYouTubeMonthly(filter: MonthlyFilter) {
  return supabase.from('youtube_monthly').select('*').eq('year', filter.year).eq('month', filter.month).maybeSingle()
}

export async function upsertYouTubeMonthly(data: { year: number; month: number; shorts_views: number }) {
  return supabase.from('youtube_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

// ─── Newsletter ──────────────────────────────

export async function getNewsletterData(filter: MonthlyFilter) {
  const { year, month } = filter
  const [monthlyRes, episodesRes] = await Promise.all([
    supabase.from('newsletter_monthly').select('*').eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('newsletter_episodes').select('*').eq('year', year).eq('month', month).order('episode_number'),
  ])
  return {
    monthly: monthlyRes.data ?? null,
    episodes: (episodesRes.data ?? []) as NewsletterEpisode[],
  }
}

export async function upsertNewsletterMonthly(data: { year: number; month: number; new_subscribers: number }) {
  return supabase.from('newsletter_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function addNewsletterEpisode(ep: Omit<NewsletterEpisode, 'id'>) {
  return supabase.from('newsletter_episodes').insert(ep).select().single()
}

export async function updateNewsletterEpisode(id: string, ep: Partial<NewsletterEpisode>) {
  return supabase.from('newsletter_episodes').update(ep).eq('id', id).select().single()
}

export async function deleteNewsletterEpisode(id: string) {
  return supabase.from('newsletter_episodes').delete().eq('id', id)
}

// ─── Web ─────────────────────────────────────

export async function getWebData(filter: MonthlyFilter) {
  const { year, month } = filter
  const [monthlyRes, utmRes] = await Promise.all([
    supabase.from('web_monthly').select('*').eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('web_utm_sources').select('*').eq('year', year).eq('month', month).order('sessions', { ascending: false }),
  ])
  return {
    monthly: monthlyRes.data ?? null,
    utmSources: (utmRes.data ?? []) as WebUtmSource[],
  }
}

export async function upsertWebMonthly(data: { year: number; month: number; total_sessions: number }) {
  return supabase.from('web_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function upsertWebUtmSource(data: { year: number; month: number; source: string; sessions: number }) {
  return supabase.from('web_utm_sources').upsert(data, { onConflict: 'year,month,source' }).select().single()
}

// ─── Objectives ──────────────────────────────

export async function getObjectives(year: number, quarter: number) {
  return supabase.from('objectives').select('*').eq('year', year).eq('quarter', quarter)
}

export async function upsertObjective(data: { year: number; quarter: number; channel: string; metric: string; target_value: number }) {
  return supabase.from('objectives').upsert(data, { onConflict: 'year,quarter,channel,metric' }).select().single()
}

// ─── Historical months list ───────────────────

export async function getAvailableMonths() {
  // Pull distinct year/month combos across all channels
  const [ig, li, tt] = await Promise.all([
    supabase.from('instagram_monthly').select('year,month').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('linkedin_monthly').select('year,month').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('tiktok_monthly').select('year,month').order('year', { ascending: false }).order('month', { ascending: false }),
  ])

  const all = [...(ig.data ?? []), ...(li.data ?? []), ...(tt.data ?? [])]
  const unique = Array.from(
    new Map(all.map(m => [`${m.year}-${m.month}`, m])).values()
  ).sort((a, b) => b.year - a.year || b.month - a.month)

  return unique
}
