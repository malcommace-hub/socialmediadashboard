import { supabase } from './supabase'
import type { MonthlyFilter, InstagramPost, LinkedInPost, TikTokVideo, NewsletterEpisode, WebUtmSource } from './types'
import { computeAvgERFromDecimal } from './utils'
import { getCached, setCached } from './queryCache'

// ─── Instagram ───────────────────────────────

export async function getInstagramStats(filter: MonthlyFilter) {
  const { year, month } = filter

  const mStart = `${year}-${String(month).padStart(2, '0')}-01`
  const mEnd = `${year}-${String(month).padStart(2, '0')}-31`
  const [monthlyRes, postsRes, dailyRes] = await Promise.all([
    supabase.from('instagram_monthly').select('*').eq('year', year).eq('month', month).maybeSingle(),
    supabase.from('instagram_posts').select('*').eq('year', year).eq('month', month).order('post_date', { ascending: false }),
    supabase.from('instagram_daily').select('views,interactions').gte('date', mStart).lte('date', mEnd),
  ])

  const posts: InstagramPost[] = postsRes.data ?? []
  const interactionsOf = (p: InstagramPost) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0) + (p.follows ?? 0)
  const totalViews = posts.reduce((a, p) => a + (p.views ?? 0), 0)
  const totalImpressions = posts.reduce((a, p) => a + (p.impressions ?? 0), 0)

  // Legacy "external collab" posts (manually added, hosted by other accounts) were
  // added on top of the manual monthly totals. Kept only to preserve frozen months.
  const externalCollabPosts = posts.filter(p => p.is_manual && p.type === 'Collab')
  const externalCollabViews = externalCollabPosts.reduce((a, p) => a + (p.views ?? 0), 0)
  const externalCollabInteractions = externalCollabPosts.reduce((a, p) => a + interactionsOf(p), 0)

  const monthly = monthlyRes.data ?? null
  const manualViews = monthly?.total_views_manual ?? 0
  const postInteractionsSum = posts.reduce((a, p) => a + interactionsOf(p), 0)
  const storedInteractions = (monthly as Record<string, number> | null)?.total_interactions ?? 0

  // Priority: Meta daily export sum > manual/stored (frozen) > post-level sum.
  // Daily rows come from the "Visualizaciones"/"Content interactions" exports.
  const dailyRows = (dailyRes.data ?? []) as { views: number | null; interactions: number | null }[]
  const dailyViews = dailyRows.reduce((a, d) => a + (d.views ?? 0), 0)
  const dailyInteractions = dailyRows.reduce((a, d) => a + (d.interactions ?? 0), 0)

  const grandTotalViews = dailyViews > 0 ? dailyViews : (manualViews > 0 ? manualViews + externalCollabViews : totalViews)
  const totalInteractions = dailyInteractions > 0 ? dailyInteractions : (storedInteractions > 0 ? storedInteractions + externalCollabInteractions : postInteractionsSum)

  // ER% = interactions / views. Prefer a frozen stored avg_er if present.
  const storedAvgER = (monthly as Record<string, number | null> | null)?.avg_er
  const avgER = storedAvgER != null
    ? storedAvgER as number
    : (grandTotalViews > 0 ? (totalInteractions / grandTotalViews) * 100 : 0)

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
  total_interactions?: number
}) {
  return supabase.from('instagram_monthly').upsert(data, { onConflict: 'year,month' }).select().single()
}

export async function upsertInstagramPosts(posts: Omit<InstagramPost, 'id'>[]) {
  return supabase.from('instagram_posts').upsert(posts, { onConflict: 'permalink', ignoreDuplicates: false })
}

// "Liberate" a month from its manual view/reach/ER overrides so views become
// driven by the sum of its loaded posts. Called after importing that month's
// Meta content CSV. Followers stay manual (profile-level) and total_interactions
// is left untouched so a separately-uploaded Meta interactions total sticks.
export async function clearInstagramMonthlyMetrics(year: number, month: number) {
  return supabase.from('instagram_monthly')
    .update({ total_views_manual: 0, total_reach_manual: 0, avg_er: null })
    .eq('year', year).eq('month', month)
}

// Followers for a month (for the manual followers entry on the upload page).
export async function getInstagramFollowers(year: number, month: number) {
  const { data } = await supabase.from('instagram_monthly')
    .select('total_followers,new_followers').eq('year', year).eq('month', month).maybeSingle()
  const row = data as { total_followers: number | null; new_followers: number | null } | null
  return { total_followers: row?.total_followers ?? 0, new_followers: row?.new_followers ?? 0 }
}

// Set the month's interactions from Meta's "Content interactions" export (its
// total is broader than the per-post sum). Overrides the post-sum for that
// month; clearing avg_er so ER recomputes as interactions / views.
export async function upsertInstagramInteractions(year: number, month: number, totalInteractions: number) {
  return supabase.from('instagram_monthly')
    .upsert({ year, month, total_interactions: totalInteractions, avg_er: null }, { onConflict: 'year,month' })
    .select().single()
}

// ── Instagram daily metrics (Meta "Visualizaciones"/"Content interactions" exports) ──
// Stored per-day so weekly/partial exports accumulate by date with no overlap.
// The monthly views/interactions are summed from these when present (top
// priority over manual/post-sum), so any date range can be uploaded safely.
export async function upsertInstagramDailyViews(rows: { date: string; views: number }[]) {
  return supabase.from('instagram_daily').upsert(rows, { onConflict: 'date' })
}
export async function upsertInstagramDailyInteractions(rows: { date: string; interactions: number }[]) {
  return supabase.from('instagram_daily').upsert(rows, { onConflict: 'date' })
}
// All daily rows. Table may not exist yet (pre-migration) — degrades to [].
export async function getInstagramDaily(): Promise<{ date: string; views: number | null; interactions: number | null }[]> {
  const { data } = await supabase.from('instagram_daily').select('date,views,interactions')
  return (data ?? []) as { date: string; views: number | null; interactions: number | null }[]
}

// Stable identity hash — intentionally excludes mutable fields (views, likes)
// so that editing stats on an existing collab upserts the row rather than
// inserting a duplicate.
function manualPermalink(year: number, month: number, description?: string | null, postDate?: string | null, collabAccount?: string | null): string {
  const str = [year, month, description ?? '', postDate ?? '', collabAccount ?? ''].join('|')
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  return `manual:${Math.abs(h).toString(16).padStart(8, '0')}`
}

export async function addInstagramPostManual(post: Omit<InstagramPost, 'id'>) {
  const enriched = post.permalink
    ? post
    : { ...post, permalink: manualPermalink(post.year, post.month, post.description, post.post_date, post.collab_account) }
  return supabase.from('instagram_posts').upsert(enriched, { onConflict: 'permalink', ignoreDuplicates: false }).select().single()
}

export async function deleteInstagramPost(id: string) {
  return supabase.from('instagram_posts').delete().eq('id', id)
}

// Manually mark/unmark a post as a collaboration with a given influencer.
// Passing a name sets type='Collab' + collab_account so it groups in the
// influencer analysis; passing null clears it back to a regular Reel.
export async function updateInstagramPostCollab(id: string, collabAccount: string | null) {
  const patch = collabAccount && collabAccount.trim() !== ''
    ? { type: 'Collab', collab_account: collabAccount.trim() }
    : { type: 'Reel', collab_account: null }
  return supabase.from('instagram_posts').update(patch).eq('id', id).select().single()
}

// Distinct influencer names ever used, for the collab tagging autocomplete.
export async function getInfluencerNames(): Promise<string[]> {
  const { data } = await supabase
    .from('instagram_posts')
    .select('collab_account')
    .eq('type', 'Collab')
    .not('collab_account', 'is', null)
  const set = new Set<string>()
  for (const r of data ?? []) {
    const v = (r as { collab_account: string | null }).collab_account?.trim()
    if (v) set.add(v)
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b))
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

// Weekly review: LinkedIn posts by publish-date range (spans months).
export async function getLinkedInPostsByDateRange(startDate: string, endDate: string) {
  const { data } = await supabase.from('linkedin_posts').select('*')
    .gte('post_date', startDate).lte('post_date', endDate)
    .order('impressions', { ascending: false })
  return (data ?? []) as LinkedInPost[]
}
export async function getLinkedInLatestPostDate(): Promise<string | null> {
  const { data } = await supabase.from('linkedin_posts').select('post_date')
    .not('post_date', 'is', null).order('post_date', { ascending: false }).limit(1).maybeSingle()
  return (data as { post_date: string | null } | null)?.post_date ?? null
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

  // Manually-added videos aren't part of the Overview CSV export, so their
  // stats are added on top of the monthly totals (same pattern as IG collabs).
  const inter = (v: TikTokVideo) => (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0)
  const manualViews = videos.filter(v => v.is_manual).reduce((a, v) => a + (v.views ?? 0), 0)
  const manualInteractions = videos.filter(v => v.is_manual).reduce((a, v) => a + inter(v), 0)
  // Base = Overview total when present, otherwise the sum of CSV (non-manual) videos.
  const baseViews = (monthly?.total_views ?? 0) > 0
    ? monthly!.total_views
    : videos.filter(v => !v.is_manual).reduce((a, v) => a + (v.views ?? 0), 0)
  const baseInteractions = (monthly?.total_interactions ?? 0) > 0
    ? monthly!.total_interactions
    : videos.filter(v => !v.is_manual).reduce((a, v) => a + inter(v), 0)

  const totalViews = baseViews + manualViews
  const totalInteractions = baseInteractions + manualInteractions

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

// Weekly review: TikTok videos by publish-date range (spans months).
export async function getTikTokVideosByDateRange(startDate: string, endDate: string) {
  const { data } = await supabase.from('tiktok_videos').select('*')
    .gte('video_date', startDate).lte('video_date', endDate)
    .order('views', { ascending: false })
  return (data ?? []) as TikTokVideo[]
}
export async function getTikTokLatestVideoDate(): Promise<string | null> {
  const { data } = await supabase.from('tiktok_videos').select('video_date')
    .not('video_date', 'is', null).order('video_date', { ascending: false }).limit(1).maybeSingle()
  return (data as { video_date: string | null } | null)?.video_date ?? null
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
  type Item = { year: number; month: number; igImpressions: number; igInteractions: number; igNewFollowers: number; igTotalFollowers: number; igER: number; liImpressions: number; liInteractions: number; liNewFollowers: number; liTotalFollowers: number; liER: number; ttViews: number; ttInteractions: number; ttNewFollowers: number; ttTotalFollowers: number; ytViews: number; newsletterViews: number; igPostCount: number; liPostCount: number }
  const hit = getCached<Item[]>('overview-history'); if (hit) return hit
  const [igMonthly, liMonthly, liPosts, ttMonthly, ttVideos, ytMonthly, igPosts, nlEpisodes, igDaily] = await Promise.all([
    supabase.from('instagram_monthly').select('year,month,total_views_manual,total_reach_manual,new_followers,total_followers,total_interactions,avg_er').order('year').order('month'),
    supabase.from('linkedin_monthly').select('year,month,new_followers,total_followers,total_impressions,total_interactions,avg_er').order('year').order('month'),
    supabase.from('linkedin_posts').select('year,month,impressions,interactions,er_decimal'),
    supabase.from('tiktok_monthly').select('year,month,total_views,total_interactions,new_followers,total_followers').order('year').order('month'),
    supabase.from('tiktok_videos').select('year,month,views,likes,comments,shares,is_manual'),
    supabase.from('youtube_monthly').select('year,month,shorts_views').order('year').order('month'),
    supabase.from('instagram_posts').select('year,month,type,is_manual,views,impressions,likes,comments,shares,saves,follows'),
    supabase.from('newsletter_episodes').select('year,month,views'),
    supabase.from('instagram_daily').select('date,views,interactions'),
  ])
  const igDailyByMonth: Record<string, { views: number; interactions: number }> = {}
  for (const d of (igDaily.data ?? []) as { date: string; views: number | null; interactions: number | null }[]) {
    const [dy, dm] = d.date.split('-'); const dk = `${parseInt(dy, 10)}-${parseInt(dm, 10)}`
    if (!igDailyByMonth[dk]) igDailyByMonth[dk] = { views: 0, interactions: 0 }
    igDailyByMonth[dk].views += d.views ?? 0
    igDailyByMonth[dk].interactions += d.interactions ?? 0
  }
  // TikTok video sums per month (fallback when no Overview total; manual videos
  // add on top) — mirrors getTikTokStats/getTikTokHistory so Overview matches.
  const ttByMonth: Record<string, { csvViews: number; csvInter: number; manViews: number; manInter: number }> = {}
  for (const v of (ttVideos.data ?? []) as { year: number; month: number; views: number | null; likes: number | null; comments: number | null; shares: number | null; is_manual: boolean | null }[]) {
    const k = `${v.year}-${v.month}`
    if (!ttByMonth[k]) ttByMonth[k] = { csvViews: 0, csvInter: 0, manViews: 0, manInter: 0 }
    const inter = (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0)
    if (v.is_manual) { ttByMonth[k].manViews += v.views ?? 0; ttByMonth[k].manInter += inter }
    else { ttByMonth[k].csvViews += v.views ?? 0; ttByMonth[k].csvInter += inter }
  }

  const liByMonth: Record<string, { impressions: number; interactions: number; erSum: number; count: number }> = {}
  for (const p of liPosts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!liByMonth[k]) liByMonth[k] = { impressions: 0, interactions: 0, erSum: 0, count: 0 }
    liByMonth[k].impressions += p.impressions ?? 0
    liByMonth[k].interactions += p.interactions ?? 0
    liByMonth[k].erSum += p.er_decimal ?? 0
    liByMonth[k].count++
  }
  const igByMonth: Record<string, { interactions: number; impressions: number; views: number; count: number; extViews: number; extInter: number }> = {}
  for (const p of igPosts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!igByMonth[k]) igByMonth[k] = { interactions: 0, impressions: 0, views: 0, count: 0, extViews: 0, extInter: 0 }
    const inter = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0) + (p.follows ?? 0)
    igByMonth[k].impressions += p.impressions ?? p.views ?? 0
    igByMonth[k].views += p.views ?? 0
    igByMonth[k].interactions += inter
    igByMonth[k].count++
    if (p.is_manual && p.type === 'Collab') { igByMonth[k].extViews += p.views ?? 0; igByMonth[k].extInter += inter }
  }
  const nlByMonth: Record<string, number> = {}
  for (const ep of nlEpisodes.data ?? []) {
    const k = `${ep.year}-${ep.month}`
    nlByMonth[k] = (nlByMonth[k] ?? 0) + (ep.views ?? 0)
  }

  const monthSet = new Set<string>()
  ;[igMonthly, liMonthly, ttMonthly, ytMonthly].forEach(r => (r.data ?? []).forEach((d: {year:number;month:number}) => monthSet.add(`${d.year}-${d.month}`)))
  // Include months that only have post-level data (CSV loaded, no monthly row yet)
  Object.keys(igByMonth).forEach(k => monthSet.add(k))
  Object.keys(liByMonth).forEach(k => monthSet.add(k))
  Object.keys(ttByMonth).forEach(k => monthSet.add(k))

  const result = Array.from(monthSet).sort().map(key => {
    const [yr, mo] = key.split('-').map(Number)
    const ig = (igMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const li = (liMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const tt = (ttMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const yt = (ytMonthly.data ?? []).find((d: {year:number;month:number}) => d.year === yr && d.month === mo)
    const liM = liByMonth[key] ?? { impressions: 0, interactions: 0, erSum: 0, count: 0 }
    const igM = igByMonth[key] ?? { interactions: 0, impressions: 0, views: 0, count: 0, extViews: 0, extInter: 0 }
    const ttvb = ttByMonth[key] ?? { csvViews: 0, csvInter: 0, manViews: 0, manInter: 0 }
    // TikTok: Overview total (or CSV video sum) + manual videos on top.
    const ttViewsVal = ((tt as Record<string, number>)?.total_views > 0 ? (tt as Record<string, number>).total_views : ttvb.csvViews) + ttvb.manViews
    const ttInteractionsVal = ((tt as Record<string, number>)?.total_interactions > 0 ? (tt as Record<string, number>).total_interactions : ttvb.csvInter) + ttvb.manInter
    // Prefer stored monthly totals for LinkedIn when post-level data isn't available
    const liImpressions = (li as Record<string, number>)?.total_impressions > 0 ? (li as Record<string, number>).total_impressions : liM.impressions
    const liInteractions = (li as Record<string, number>)?.total_interactions > 0 ? (li as Record<string, number>).total_interactions : liM.interactions
    // IG priority: Meta daily sum > frozen manual (+external collab) > post sum.
    const igDb = igDailyByMonth[key] ?? { views: 0, interactions: 0 }
    const igManualViews = (ig as Record<string, number>)?.total_views_manual ?? 0
    const igImpressionsVal = igDb.views > 0 ? igDb.views : (igManualViews > 0 ? igManualViews + igM.extViews : igM.views)
    const igStoredInter = (ig as Record<string,number>)?.total_interactions ?? 0
    const igInteractions = igDb.interactions > 0 ? igDb.interactions : (igStoredInter > 0 ? igStoredInter + igM.extInter : igM.interactions)
    const igER = (ig as Record<string,number | null>)?.avg_er != null ? (ig as Record<string,number>).avg_er : (igImpressionsVal > 0 ? (igInteractions / igImpressionsVal) * 100 : 0)
    return {
      year: yr, month: mo,
      igImpressions: igImpressionsVal,
      igInteractions,
      igNewFollowers: ig?.new_followers ?? 0,
      igTotalFollowers: ig?.total_followers ?? 0,
      igER,
      liImpressions,
      liInteractions,
      liNewFollowers: li?.new_followers ?? 0,
      liTotalFollowers: li?.total_followers ?? 0,
      liER: (li as Record<string, number | null>)?.avg_er != null ? (li as Record<string, number>).avg_er : (liM.count > 0 ? (liM.erSum / liM.count) * 100 : 0),
      ttViews: ttViewsVal,
      ttInteractions: ttInteractionsVal,
      ttNewFollowers: tt?.new_followers ?? 0,
      ttTotalFollowers: tt?.total_followers ?? 0,
      ytViews: yt?.shorts_views ?? 0,
      newsletterViews: nlByMonth[key] ?? 0,
      igPostCount: igM.count,
      liPostCount: liM.count,
    }
  })
  setCached('overview-history', result)
  return result
}

export async function getInstagramHistory() {
  type Item = { year: number; month: number; views: number; reach: number; newFollowers: number; totalFollowers: number; interactions: number; er: number; postCount: number; avgViews: number }
  const hit = getCached<Item[]>('ig-history'); if (hit) return hit
  const [monthly, posts, daily] = await Promise.all([
    supabase.from('instagram_monthly').select('*').order('year').order('month'),
    supabase.from('instagram_posts').select('year,month,type,is_manual,views,impressions,likes,comments,shares,saves,follows'),
    supabase.from('instagram_daily').select('date,views,interactions'),
  ])
  // Sum Meta daily exports per month (top-priority source when present).
  const dailyByMonth: Record<string, { views: number; interactions: number }> = {}
  for (const d of (daily.data ?? []) as { date: string; views: number | null; interactions: number | null }[]) {
    const [y, mo] = d.date.split('-'); const k = `${parseInt(y, 10)}-${parseInt(mo, 10)}`
    if (!dailyByMonth[k]) dailyByMonth[k] = { views: 0, interactions: 0 }
    dailyByMonth[k].views += d.views ?? 0
    dailyByMonth[k].interactions += d.interactions ?? 0
  }
  const byMonth: Record<string, { interactions: number; impressions: number; views: number; count: number; extViews: number; extInter: number }> = {}
  for (const p of posts.data ?? []) {
    const k = `${p.year}-${p.month}`
    if (!byMonth[k]) byMonth[k] = { interactions: 0, impressions: 0, views: 0, count: 0, extViews: 0, extInter: 0 }
    const inter = (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0) + (p.follows ?? 0)
    byMonth[k].impressions += p.impressions ?? p.views ?? 0
    byMonth[k].views += p.views ?? 0
    byMonth[k].interactions += inter
    byMonth[k].count++
    if (p.is_manual && p.type === 'Collab') { byMonth[k].extViews += p.views ?? 0; byMonth[k].extInter += inter }
  }
  const monthlyMap: Record<string, Record<string, number | null>> = {}
  for (const m of monthly.data ?? []) {
    monthlyMap[`${(m as Record<string,number>).year}-${(m as Record<string,number>).month}`] = m as Record<string, number | null>
  }
  const monthSet = new Set([...Object.keys(monthlyMap), ...Object.keys(byMonth)])
  const result = Array.from(monthSet).sort().map(key => {
    const [yr, mo] = key.split('-').map(Number)
    const m = monthlyMap[key] ?? {}
    const pm = byMonth[key] ?? { interactions: 0, impressions: 0, views: 0, count: 0, extViews: 0, extInter: 0 }
    // Priority: Meta daily sum > frozen manual (+external collab) > post sum.
    const db = dailyByMonth[key] ?? { views: 0, interactions: 0 }
    const manualViews = (m.total_views_manual as number) ?? 0
    const views = db.views > 0 ? db.views : (manualViews > 0 ? manualViews + pm.extViews : pm.views)
    const storedInter = (m.total_interactions as number) ?? 0
    const interactions = db.interactions > 0 ? db.interactions : (storedInter > 0 ? storedInter + pm.extInter : pm.interactions)
    const er = m.avg_er != null ? (m.avg_er as number) : (views > 0 ? (interactions / views) * 100 : 0)
    return {
      year: yr, month: mo,
      views,
      reach: (m.total_reach_manual as number) ?? 0,
      newFollowers: (m.new_followers as number) ?? 0,
      totalFollowers: (m.total_followers as number) ?? 0,
      interactions,
      er,
      postCount: pm.count,
      avgViews: pm.count > 0 ? Math.round(pm.views / pm.count) : 0,
    }
  })
  setCached('ig-history', result)
  return result
}

export async function getInstagramPostsByCollab(account: string) {
  const { data } = await supabase
    .from('instagram_posts')
    .select('*')
    .eq('type', 'Collab')
    .eq('collab_account', account)
    .order('views', { ascending: false })
  return (data ?? []) as InstagramPost[]
}

// Posts whose publish date falls in a date range (inclusive), for the weekly
// review view — spans month boundaries. Dates are 'YYYY-MM-DD'.
export async function getInstagramPostsByDateRange(startDate: string, endDate: string) {
  const { data } = await supabase
    .from('instagram_posts')
    .select('*')
    .gte('post_date', startDate)
    .lte('post_date', endDate)
    .order('views', { ascending: false })
  return (data ?? []) as InstagramPost[]
}

// Latest month that has any loaded data — used as the default selected month
// so the dashboard opens on a month with content instead of today's (empty) one.
export async function getLatestDataMonth(): Promise<{ year: number; month: number } | null> {
  const latest = (t: string) => supabase.from(t).select('year,month')
    .order('year', { ascending: false }).order('month', { ascending: false }).limit(1).maybeSingle()
  const [igP, igM, liM, ttM] = await Promise.all([
    latest('instagram_posts'), latest('instagram_monthly'), latest('linkedin_monthly'), latest('tiktok_monthly'),
  ])
  const cands = [igP.data, igM.data, liM.data, ttM.data].filter(Boolean) as { year: number; month: number }[]
  if (!cands.length) return null
  cands.sort((a, b) => b.year - a.year || b.month - a.month)
  return { year: cands[0].year, month: cands[0].month }
}

// Latest post publish date across all Instagram posts (anchors the weekly view).
export async function getInstagramLatestPostDate(): Promise<string | null> {
  const { data } = await supabase
    .from('instagram_posts')
    .select('post_date')
    .not('post_date', 'is', null)
    .order('post_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as { post_date: string | null } | null)?.post_date ?? null
}

export async function getInstagramCollabComparison() {
  const { data } = await supabase
    .from('instagram_posts')
    .select('collab_account, views, impressions, likes, comments, shares, saves')
    .eq('type', 'Collab')
  const rows = data ?? []
  const withAccount = rows.filter(r => r.collab_account && r.collab_account.trim() !== '')
  const withoutAccount = rows.length - withAccount.length
  const byAccount: Record<string, { count: number; totalViews: number; totalER: number }> = {}
  for (const r of withAccount) {
    const acct = r.collab_account!
    if (!byAccount[acct]) byAccount[acct] = { count: 0, totalViews: 0, totalER: 0 }
    byAccount[acct].count++
    byAccount[acct].totalViews += r.views ?? 0
    const imp = r.impressions ?? r.views ?? 0
    const interactions = (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0)
    byAccount[acct].totalER += imp > 0 ? (interactions / imp) * 100 : 0
  }
  const comparison = Object.entries(byAccount)
    .map(([account, d]) => ({
      account,
      count: d.count,
      avgViews: d.count ? d.totalViews / d.count : 0,
      avgER: d.count ? d.totalER / d.count : 0,
    }))
    .sort((a, b) => b.avgViews - a.avgViews)
  return { comparison, withoutAccount }
}

// Compares average views across content "buckets": influencer collabs vs the
// streaming show (newsletter episodes) vs own organic IG content (Reels/Posts).
// All-time across loaded data — labelled as such in the report.
export async function getContentPerformanceComparison() {
  const [collabs, episodes, organic] = await Promise.all([
    supabase.from('instagram_posts').select('views').eq('type', 'Collab'),
    supabase.from('newsletter_episodes').select('views'),
    supabase.from('instagram_posts').select('views').in('type', ['Reel', 'Post']),
  ])
  const agg = (rows: { views: number | null }[] | null) => {
    const vals = (rows ?? []).map(r => r.views ?? 0)
    const count = vals.length
    const total = vals.reduce((a, b) => a + b, 0)
    return { count, total, avg: count > 0 ? total / count : 0 }
  }
  return {
    influencer: agg(collabs.data),
    streaming: agg(episodes.data),
    organic: agg(organic.data),
  }
}

export async function getLinkedInHistory() {
  type Item = { year: number; month: number; impressions: number; interactions: number; newFollowers: number; totalFollowers: number; er: number; postCount: number; avgViews: number }
  const hit = getCached<Item[]>('li-history'); if (hit) return hit
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
  const result = Array.from(monthSet).sort().map(key => {
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
      postCount: pm.count,
      avgViews: pm.count > 0 ? Math.round(pm.impressions / pm.count) : 0,
    }
  })
  setCached('li-history', result)
  return result
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
  type Item = { year: number; month: number; views: number; interactions: number; newFollowers: number; totalFollowers: number; er: number }
  const hit = getCached<Item[]>('tt-history'); if (hit) return hit
  const [monthly, videos] = await Promise.all([
    supabase.from('tiktok_monthly').select('*').order('year').order('month'),
    supabase.from('tiktok_videos').select('year,month,views,likes,comments,shares,is_manual'),
  ])

  // Split video stats into CSV vs manual per month. Manual videos are added on
  // top of the Overview total; CSV videos are the fallback when no Overview
  // total exists (matches getTikTokStats behaviour).
  const vBy: Record<string, { csvViews: number; csvInter: number; manViews: number; manInter: number }> = {}
  for (const v of videos.data ?? []) {
    const k = `${v.year}-${v.month}`
    if (!vBy[k]) vBy[k] = { csvViews: 0, csvInter: 0, manViews: 0, manInter: 0 }
    const inter = (v.likes ?? 0) + (v.comments ?? 0) + (v.shares ?? 0)
    if (v.is_manual) { vBy[k].manViews += v.views ?? 0; vBy[k].manInter += inter }
    else { vBy[k].csvViews += v.views ?? 0; vBy[k].csvInter += inter }
  }

  const monthlyMap: Record<string, Record<string, number>> = {}
  for (const m of monthly.data ?? []) monthlyMap[`${(m as Record<string,number>).year}-${(m as Record<string,number>).month}`] = m as Record<string, number>

  const monthSet = new Set([...Object.keys(monthlyMap), ...Object.keys(vBy)])
  const result = Array.from(monthSet).map(k => {
    const [year, month] = k.split('-').map(Number)
    const m = monthlyMap[k]
    const vb = vBy[k] ?? { csvViews: 0, csvInter: 0, manViews: 0, manInter: 0 }
    // Overview total (or CSV video sum) + manual videos added on top.
    const views = ((m?.total_views ?? 0) > 0 ? m.total_views : vb.csvViews) + vb.manViews
    const interactions = ((m?.total_interactions ?? 0) > 0 ? m.total_interactions : vb.csvInter) + vb.manInter
    return {
      year, month,
      views,
      interactions,
      newFollowers: m?.new_followers ?? 0,
      totalFollowers: m?.total_followers ?? 0,
      er: views > 0 ? (interactions / views) * 100 : 0,
    }
  }).sort((a, b) => a.year - b.year || a.month - b.month)
  setCached('tt-history', result)
  return result
}

export async function getNewsletterHistory() {
  type Item = { year: number; month: number; views: number; newSubscribers: number }
  const hit = getCached<Item[]>('nl-history'); if (hit) return hit
  const [monthly, episodes] = await Promise.all([
    supabase.from('newsletter_monthly').select('year,month,new_subscribers').order('year').order('month'),
    supabase.from('newsletter_episodes').select('year,month,views'),
  ])
  const viewsByMonth: Record<string, number> = {}
  for (const ep of episodes.data ?? []) {
    const k = `${ep.year}-${ep.month}`
    viewsByMonth[k] = (viewsByMonth[k] ?? 0) + (ep.views ?? 0)
  }
  const result = (monthly.data ?? []).map((m: Record<string, number>) => ({
    year: m.year, month: m.month,
    views: viewsByMonth[`${m.year}-${m.month}`] ?? 0,
    newSubscribers: m.new_subscribers ?? 0,
  })).sort((a: {year:number;month:number}, b: {year:number;month:number}) => a.year - b.year || a.month - b.month)
  setCached('nl-history', result)
  return result
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

export async function getInstagramTopPosts(year: number, limit = 12) {
  const { data } = await supabase
    .from('instagram_posts')
    .select('year,month,description,type,views,impressions,likes,comments,shares,saves,permalink,collab_account')
    .eq('year', year)
    .order('views', { ascending: false })
    .limit(limit)
  return (data ?? []).map(p => ({
    ...p,
    er: (p.impressions ?? 0) > 0
      ? (((p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0)) / p.impressions) * 100
      : 0,
  }))
}

// ─── LinkedIn post dates (for streak calc) ───

export async function getLinkedInPostDates(): Promise<string[]> {
  const { data } = await supabase
    .from('linkedin_posts')
    .select('post_date')
    .not('post_date', 'is', null)
    .order('post_date', { ascending: false })
    .limit(200)
  return (data ?? []).map((p: { post_date: string }) => p.post_date).filter(Boolean)
}

// ─── Monthly notes ───────────────────────────

export async function getMonthlyNote(year: number, month: number) {
  const { data } = await supabase
    .from('monthly_notes')
    .select('content')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  return data as { content: string } | null
}

export async function upsertMonthlyNote(year: number, month: number, content: string) {
  return supabase
    .from('monthly_notes')
    .upsert({ year, month, content, updated_at: new Date().toISOString() }, { onConflict: 'year,month' })
}

export async function getPostingHeatmapData(year: number) {
  const [ig, li] = await Promise.all([
    supabase.from('instagram_posts').select('post_date,description,type').eq('year', year).not('post_date', 'is', null),
    supabase.from('linkedin_posts').select('post_date,title').eq('year', year).not('post_date', 'is', null),
  ])
  return {
    ig: (ig.data ?? []).map(p => ({ date: p.post_date as string, title: (p.description || null) as string | null })),
    li: (li.data ?? []).map(p => ({ date: p.post_date as string, title: (p.title || null) as string | null })),
  }
}

export async function getLinkedInTopPosts(year: number, limit = 12) {
  const { data } = await supabase
    .from('linkedin_posts')
    .select('year,month,title,impressions,er_decimal,permalink')
    .eq('year', year)
    .order('impressions', { ascending: false })
    .limit(limit)
  return (data ?? []).map(p => ({ ...p, er: (p.er_decimal ?? 0) * 100 }))
}

// ─── Featured content (Impactos del mes) ─────

export async function getTopPostsByMonth(year: number, month: number) {
  const [igRes, liRes, ttRes] = await Promise.all([
    supabase
      .from('instagram_posts')
      .select('id,description,type,views,impressions,likes,comments,shares,saves,permalink')
      .eq('year', year).eq('month', month)
      .order('views', { ascending: false })
      .limit(1),
    supabase
      .from('linkedin_posts')
      .select('id,title,impressions,interactions,er_decimal,permalink')
      .eq('year', year).eq('month', month)
      .order('impressions', { ascending: false })
      .limit(1),
    supabase
      .from('tiktok_videos')
      .select('id,title,views,likes,comments,shares,permalink')
      .eq('year', year).eq('month', month)
      .order('views', { ascending: false })
      .limit(1),
  ])

  const ig = igRes.data?.[0] ?? null
  const li = liRes.data?.[0] ?? null
  const tt = ttRes.data?.[0] ?? null

  return {
    instagram: ig ? {
      ...ig,
      er: (ig.impressions ?? 0) > 0
        ? (((ig.likes ?? 0) + (ig.comments ?? 0) + (ig.shares ?? 0) + (ig.saves ?? 0)) / ig.impressions) * 100
        : 0,
    } : null,
    linkedin: li ? {
      ...li,
      er: (li.er_decimal ?? 0) * 100,
    } : null,
    tiktok: tt ? {
      ...tt,
      er: (tt.views ?? 0) > 0
        ? (((tt.likes ?? 0) + (tt.comments ?? 0) + (tt.shares ?? 0)) / tt.views) * 100
        : 0,
    } : null,
  }
}

export async function getFeaturedContent(year: number, month: number) {
  const { data } = await supabase
    .from('featured_content')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .order('created_at', { ascending: false })
  return (data ?? []) as Array<{
    id: string; year: number; month: number; channel: string
    post_url: string | null; description: string | null
    views: number | null; er_pct: number | null
    editorial_note: string; created_at: string
  }>
}

export async function addFeaturedContent(item: {
  year: number; month: number; channel: string
  post_url?: string | null; description?: string | null
  views?: number | null; er_pct?: number | null
  editorial_note: string
}) {
  return supabase.from('featured_content').insert(item).select().single()
}

export async function deleteFeaturedContent(id: string) {
  return supabase.from('featured_content').delete().eq('id', id)
}

export async function getPostByUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return null

  const [igRes, liRes, ttRes] = await Promise.all([
    supabase
      .from('instagram_posts')
      .select('description,type,views,impressions,likes,comments,shares,saves')
      .eq('permalink', trimmed)
      .maybeSingle(),
    supabase
      .from('linkedin_posts')
      .select('title,impressions,er_decimal')
      .eq('permalink', trimmed)
      .maybeSingle(),
    supabase
      .from('tiktok_videos')
      .select('title,views,likes,comments,shares')
      .eq('permalink', trimmed)
      .maybeSingle(),
  ])

  if (igRes.data) {
    const ig = igRes.data
    const interactions = (ig.likes ?? 0) + (ig.comments ?? 0) + (ig.shares ?? 0) + (ig.saves ?? 0)
    return {
      channel: 'instagram' as const,
      description: ig.description ?? null,
      views: ig.views,
      er_pct: (ig.impressions ?? 0) > 0 ? (interactions / ig.impressions) * 100 : 0,
    }
  }
  if (liRes.data) {
    const li = liRes.data
    return {
      channel: 'linkedin' as const,
      description: li.title ?? null,
      views: li.impressions,
      er_pct: (li.er_decimal ?? 0) * 100,
    }
  }
  if (ttRes.data) {
    const tt = ttRes.data
    return {
      channel: 'tiktok' as const,
      description: tt.title ?? null,
      views: tt.views,
      er_pct: (tt.views ?? 0) > 0
        ? (((tt.likes ?? 0) + (tt.comments ?? 0) + (tt.shares ?? 0)) / tt.views) * 100
        : 0,
    }
  }
  return null
}

export async function getInstagramErByTypeHistory() {
  type Item = { year: number; month: number; type: string; avgEr: number; postCount: number }
  const hit = getCached<Item[]>('ig-er-type-history'); if (hit) return hit
  const { data } = await supabase
    .from('instagram_posts')
    .select('year, month, type, impressions, likes, comments, shares, saves')
    .gt('impressions', 0)
    .order('year')
    .order('month')
  const rows = data ?? []
  const grouped: Record<string, { year: number; month: number; type: string; totalInt: number; totalImp: number; count: number }> = {}
  for (const r of rows) {
    const k = `${r.year}-${r.month}-${r.type}`
    if (!grouped[k]) grouped[k] = { year: r.year, month: r.month, type: r.type as string, totalInt: 0, totalImp: 0, count: 0 }
    grouped[k].totalInt += (r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0) + (r.saves ?? 0)
    grouped[k].totalImp += r.impressions ?? 0
    grouped[k].count++
  }
  const result: Item[] = Object.values(grouped)
    .filter(g => g.totalImp > 0)
    .map(g => ({ year: g.year, month: g.month, type: g.type, avgEr: +(g.totalInt / g.totalImp * 100).toFixed(2), postCount: g.count }))
    .sort((a, b) => a.year - b.year || a.month - b.month)
  setCached('ig-er-type-history', result)
  return result
}
