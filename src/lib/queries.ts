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

  // External collab views = manually added posts (is_manual=true) with type=Collab
  // These come from influencer-hosted content and are added on top of the Meta app total
  const externalCollabViews = posts
    .filter(p => p.is_manual && p.type === 'Collab')
    .reduce((a, p) => a + (p.views ?? 0), 0)

  const monthly = monthlyRes.data ?? null
  // Grand total = manual app number + external collab views added manually
  const grandTotalViews = (monthly?.total_views_manual ?? 0) + externalCollabViews

  return {
    monthly,
    posts,
    totalViews,
    totalImpressions,
    totalInteractions,
    avgER,
    externalCollabViews,
    grandTotalViews,
  }
}

export async function upsertInstagramMonthly(data: {
  year: number; month: number
  total_followers: number; new_followers: number
  total_views_manual?: number; total_reach_manual?: number
}) {
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
  const monthly = monthlyRes.data ?? null
  // Prefer Overview-sourced monthly totals; fall back to summing video rows
  const totalViews = monthly?.total_views || videos.reduce((a, v) => a + (v.views ?? 0), 0)
  const totalInteractions = monthly?.total_interactions || videos.reduce((a, v) => a + (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0), 0)

  return { monthly, videos, totalViews, totalInteractions }
}

export async function upsertTikTokMonthly(data: {
  year: number; month: number
  total_followers?: number; new_followers?: number
  total_views?: number; total_interactions?: number
}) {
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

export async function getYouTubeHistory() {
  const monthly = await supabase.from('youtube_monthly').select('year,month,shorts_views').order('year').order('month')
  return (monthly.data ?? []).map((m: Record<string, number>) => ({
    year: m.year, month: m.month,
    views: m.shorts_views ?? 0,
  }))
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

// ─── Bulk historical data ─────────────────────

export async function getOverviewHistory() {
  const [igMonthly, liMonthly, liPosts, ttMonthly, ytMonthly, igPosts, nlEpisodes] = await Promise.all([
    supabase.from('instagram_monthly').select('year,month,total_views_manual,total_reach_manual,new_followers,total_followers,total_interactions,avg_er').order('year').order('month'),
    supabase.from('linkedin_monthly').select('year,month,new_followers,total_followers,total_impressions,total_interactions').order('year').order('month'),
    supabase.from('linkedin_posts').select('year,month,impressions,interactions,er_decimal'),
    supabase.from('tiktok_monthly').select('year,month,total_views,total_interactions,new_followers,total_followers').order('year').order('month'),
    supabase.from('youtube_monthly').select('year,month,shorts_views').order('year').order('month'),
    supabase.from('instagram_posts').select('year,month,views,impressions,likes,comments,shares,saves'),
    supabase.from('newsletter_episodes').select('year,month,views'),
  ])

  const liByMonth: Record<string, { impressions: number; interactions: number; erSum: number; count: number }> = {}
  for (const p of liPosts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!liByMonth[k]) liByMonth[k] = { impressions: 0, interactions: 0, erSum: 0, count: 0 }
    liByMonth[k].impressions += p.impressions ?? 0
    liByMonth[k].interactions += p.interactions ?? 0
    liByMonth[k].erSum += p.er_decimal ?? 0
    liByMonth[k].count++
  }
  const igByMonth: Record<string, { interactions: number; impressions: number }> = {}
  for (const p of igPosts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!igByMonth[k]) igByMonth[k] = { interactions: 0, impressions: 0 }
    igByMonth[k].impressions += p.impressions ?? p.views ?? 0
    igByMonth[k].interactions += (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)
  }
  const nlByMonth: Record<string, number> = {}
  for (const ep of nlEpisodes.data ?? []) {
    const k = `${ep.year}-${ep.month}`
    nlByMonth[k] = (nlByMonth[k] ?? 0) + (ep.views ?? 0)
  }

  const monthSet = new Set<string>()
  ;[igMonthly, liMonthly, ttMonthly, ytMonthly].forEach(r => (r.data ?? []).forEach((d: {year:number;month:number}) => monthSet.add(`${d.year}-${d.month}`)))

  return Array.from(monthSet).sort().map(key => {
    const [yr, mo] = key.split('-').map(Number)
    const ig = (igMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const li = (liMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const tt = (ttMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const yt = (ytMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const liM = liByMonth[key] ?? { impressions: 0, interactions: 0, erSum: 0, count: 0 }
    const igM = igByMonth[key] ?? { interactions: 0, impressions: 0 }
    // Prefer stored monthly totals for LinkedIn when post-level data isn't available
    const liImpressions = (li as Record<string, number>)?.total_impressions > 0 ? (li as Record<string, number>).total_impressions : liM.impressions
    const liInteractions = (li as Record<string, number>)?.total_interactions > 0 ? (li as Record<string, number>).total_interactions : liM.interactions
    const igInteractions = (ig as Record<string,number>)?.total_interactions > 0 ? (ig as Record<string,number>).total_interactions : igM.interactions
    const igER = (ig as Record<string,number | null>)?.avg_er != null ? (ig as Record<string,number>).avg_er : (igM.impressions > 0 ? (igM.interactions / igM.impressions) * 100 : 0)
    return {
      year: yr, month: mo,
      igImpressions: ig?.total_views_manual ?? 0,
      igInteractions,
      igNewFollowers: ig?.new_followers ?? 0,
      igTotalFollowers: ig?.total_followers ?? 0,
      igER,
      liImpressions,
      liInteractions,
      liNewFollowers: li?.new_followers ?? 0,
      liTotalFollowers: li?.total_followers ?? 0,
      liER: liM.count > 0 ? (liM.erSum / liM.count) * 100 : 0,
      ttViews: tt?.total_views ?? 0,
      ttInteractions: tt?.total_interactions ?? 0,
      ttNewFollowers: tt?.new_followers ?? 0,
      ttTotalFollowers: tt?.total_followers ?? 0,
      ytViews: yt?.shorts_views ?? 0,
      newsletterViews: nlByMonth[key] ?? 0,
    }
  })
}

export async function getInstagramHistory() {
  const [monthly, posts] = await Promise.all([
    supabase.from('instagram_monthly').select('*').order('year').order('month'),
    supabase.from('instagram_posts').select('year,month,views,impressions,likes,comments,shares,saves'),
  ])
  const byMonth: Record<string, { interactions: number; impressions: number; count: number }> = {}
  for (const p of posts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!byMonth[k]) byMonth[k] = { interactions: 0, impressions: 0, count: 0 }
    byMonth[k].impressions += p.impressions ?? p.views ?? 0
    byMonth[k].interactions += (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)
    byMonth[k].count++
  }
  const monthlyMap: Record<string, Record<string, number | null>> = {}
  for (const m of monthly.data ?? []) {
    monthlyMap[`${(m as Record<string,number>).year}-${(m as Record<string,number>).month}`] = m as Record<string, number | null>
  }
  const monthSet = new Set([...Object.keys(monthlyMap), ...Object.keys(byMonth)])
  return Array.from(monthSet).sort().map(key => {
    const [yr, mo] = key.split('-').map(Number)
    const m = monthlyMap[key] ?? {}
    const pm = byMonth[key] ?? { interactions: 0, impressions: 0, count: 0 }
    // Prefer stored monthly totals; fall back to post-level aggregates
    const interactions = ((m.total_interactions as number) ?? 0) > 0 ? (m.total_interactions as number) : pm.interactions
    const er = m.avg_er != null ? (m.avg_er as number) : (pm.impressions > 0 ? (pm.interactions / pm.impressions) * 100 : 0)
    return {
      year: yr, month: mo,
      views: (m.total_views_manual as number) ?? 0,
      reach: (m.total_reach_manual as number) ?? 0,
      newFollowers: (m.new_followers as number) ?? 0,
      totalFollowers: (m.total_followers as number) ?? 0,
      interactions,
      er,
    }
  })
}

export async function getLinkedInHistory() {
  const [monthly, posts] = await Promise.all([
    supabase.from('linkedin_monthly').select('*').order('year').order('month'),
    supabase.from('linkedin_posts').select('year,month,impressions,interactions,er_decimal'),
  ])
  const byMonth: Record<string, { impressions: number; interactions: number; erSum: number; count: number }> = {}
  for (const p of posts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!byMonth[k]) byMonth[k] = { impressions: 0, interactions: 0, erSum: 0, count: 0 }
    byMonth[k].impressions += p.impressions ?? 0
    byMonth[k].interactions += p.interactions ?? 0
    byMonth[k].erSum += p.er_decimal ?? 0
    byMonth[k].count++
  }
  // Index monthly rows by key for fast lookup
  const monthlyMap: Record<string, Record<string, number | null>> = {}
  for (const m of monthly.data ?? []) {
    monthlyMap[`${(m as Record<string,number>).year}-${(m as Record<string,number>).month}`] = m as Record<string, number | null>
  }
  // Include all months that appear in either table
  const monthSet = new Set([...Object.keys(monthlyMap), ...Object.keys(byMonth)])
  return Array.from(monthSet).sort().map(key => {
    const [yr, mo] = key.split('-').map(Number)
    const m = monthlyMap[key] ?? {}
    const pm = byMonth[key] ?? { impressions: 0, interactions: 0, erSum: 0, count: 0 }
    const impressions = ((m.total_impressions as number) ?? 0) > 0 ? (m.total_impressions as number) : pm.impressions
    const interactions = ((m.total_interactions as number) ?? 0) > 0 ? (m.total_interactions as number) : pm.interactions
    const er = m.avg_er != null ? (m.avg_er as number) : (pm.count > 0 ? (pm.erSum / pm.count) * 100 : 0)
    return {
      year: yr, month: mo,
      impressions,
      interactions,
      newFollowers: (m.new_followers as number) ?? 0,
      totalFollowers: (m.total_followers as number) ?? 0,
      er,
    }
  })
}

export async function upsertLinkedInMonthlyTotals(data: {
  year: number; month: number
  total_followers?: number; new_followers?: number
  total_impressions?: number; total_interactions?: number
  avg_er?: number | null
}) {
  return supabase.from('linkedin_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function getTikTokHistory() {
  const monthly = await supabase.from('tiktok_monthly').select('*').order('year').order('month')
  return (monthly.data ?? []).map((m: Record<string, number>) => ({
    year: m.year, month: m.month,
    views: m.total_views ?? 0,
    interactions: m.total_interactions ?? 0,
    newFollowers: m.new_followers ?? 0,
    totalFollowers: m.total_followers ?? 0,
    er: (m.total_views ?? 0) > 0 ? ((m.total_interactions ?? 0) / (m.total_views ?? 1)) * 100 : 0,
  })).sort((a: {year:number;month:number}, b: {year:number;month:number}) => a.year - b.year || a.month - b.month)
}

export async function getNewsletterHistory() {
  const [monthly, episodes] = await Promise.all([
    supabase.from('newsletter_monthly').select('year,month,new_subscribers').order('year').order('month'),
    supabase.from('newsletter_episodes').select('year,month,views'),
  ])
  const viewsByMonth: Record<string, number> = {}
  for (const ep of episodes.data ?? []) {
    const k = `${ep.year}-${ep.month}`
    viewsByMonth[k] = (viewsByMonth[k] ?? 0) + (ep.views ?? 0)
  }
  return (monthly.data ?? []).map((m: Record<string, number>) => ({
    year: m.year, month: m.month,
    views: viewsByMonth[`${m.year}-${m.month}`] ?? 0,
    newSubscribers: m.new_subscribers ?? 0,
  })).sort((a: {year:number;month:number}, b: {year:number;month:number}) => a.year - b.year || a.month - b.month)
}

export async function getWebHistory() {
  const [monthly, utm] = await Promise.all([
    supabase.from('web_monthly').select('year,month,total_sessions').order('year').order('month'),
    supabase.from('web_utm_sources').select('year,month,source,sessions'),
  ])
  const utmByMonth: Record<string, Record<string, number>> = {}
  for (const u of utm.data ?? []) {
    const k = `${u.year}-${u.month}`
    if (!utmByMonth[k]) utmByMonth[k] = {}
    utmByMonth[k][u.source as string] = u.sessions ?? 0
  }
  return (monthly.data ?? []).map((m: Record<string, number>) => {
    const k = `${m.year}-${m.month}`
    const src = utmByMonth[k] ?? {}
    return {
      year: m.year, month: m.month,
      totalSessions: m.total_sessions ?? 0,
      instagram: src['instagram'] ?? 0,
      linkedin: src['linkedin'] ?? 0,
      tiktok: src['tiktok'] ?? 0,
      linktree: src['linktree'] ?? 0,
      other: src['other'] ?? 0,
    }
  }).sort((a: {year:number;month:number}, b: {year:number;month:number}) => a.year - b.year || a.month - b.month)
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
