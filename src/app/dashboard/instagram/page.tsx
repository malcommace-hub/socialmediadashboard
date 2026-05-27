'use client'
import { useEffect, useState, useCallback, useMemo, Fragment } from 'react'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getInstagramStats, getInstagramHistory, deleteInstagramPost,
  upsertInstagramMonthly, addInstagramPostManual, getInstagramCollabComparison,
  getInstagramPostsByCollab, addFeaturedContent, getFeaturedContent, deleteFeaturedContent,
  getInstagramErByTypeHistory,
} from '@/lib/queries'
import { formatNumber, formatPercent, monthLabel, shortMonthLabel, movingAvg, pctChange } from '@/lib/utils'
import { useMesParam } from '@/hooks/useMesParam'
import type { InstagramStats, InstagramPost } from '@/lib/types'
import { Trash2, ExternalLink, Plus, ChevronUp, ChevronDown, PencilLine, Upload, RefreshCw, Star } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, AreaChart, Area,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  LineChart, BarChart,
} from 'recharts'
import Link from 'next/link'
import { SkeletonCard } from '@/components/dashboard/SkeletonCard'
import { FollowerDot } from '@/components/dashboard/FollowerDot'
import { clearCache } from '@/lib/queryCache'
import { ratioToScore } from '@/lib/scoring'

type HistoryPoint = Awaited<ReturnType<typeof getInstagramHistory>>[0]

function TrendBadge({ value, prev }: { value: number; prev: number | undefined }) {
  if (!prev) return <span className="text-gray-400 text-xs">—</span>
  const pct = pctChange(value, prev)
  if (pct === null) return <span className="text-gray-400 text-xs">—</span>
  const pos = pct >= 0
  return (
    <span className={`text-xs font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
      {pos ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

const IG_SCATTER_COLORS: Record<string, string> = {
  Reel: '#ec4899', Post: '#3b82f6', Collab: '#8b5cf6',
}

const IgFollowerDot = (props: Record<string, unknown>) => <FollowerDot color="#ec4899" {...props} />

function logTickFmt(v: number): string {
  const n = Math.pow(10, v)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return String(Math.round(n))
}

function ScatterTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { desc: string; rawX: number; y: number } }> }) {
  if (!active || !payload?.length) return null
  const pt = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-2 text-xs shadow-lg">
      <div className="font-medium text-gray-800 max-w-[160px] truncate">{pt.desc}</div>
      <div className="text-gray-500 mt-0.5">{formatNumber(pt.rawX)} views · {pt.y.toFixed(2)}% ER</div>
    </div>
  )
}

type SortKey = 'views' | 'likes' | 'er'
type SortDir = 'asc' | 'desc'

function erForPost(p: InstagramPost): number {
  if (!p.impressions) return 0
  return ((p.likes + p.comments + p.shares + p.saves) / p.impressions) * 100
}

const emptyNewPost = {
  type: 'Collab' as InstagramPost['type'],
  description: '', post_date: '',
  views: '', likes: '', comments: '', shares: '', saves: '',
  permalink: '', collab_account: '',
}

export default function InstagramPage() {
  const { year, month, setYear, setMonth } = useMesParam()
  const [stats, setStats] = useState<InstagramStats | null>(null)
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>('views')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterType, setFilterType] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showAddForm, setShowAddForm] = useState(false)
  const [showAddCollabForm, setShowAddCollabForm] = useState(false)
  const [editMonthly, setEditMonthly] = useState(false)
  const [saving, setSaving] = useState(false)

  // Monthly manual fields
  const [followers, setFollowers] = useState('')
  const [newFollowers, setNewFollowers] = useState('')
  const [viewsApp, setViewsApp] = useState('')      // from Meta app overview
  const [reachApp, setReachApp] = useState('')       // accounts reached
  const [interactionsApp, setInteractionsApp] = useState('')  // total interactions from Meta app

  // New regular post
  const [newPost, setNewPost] = useState({ ...emptyNewPost, type: 'Reel' as InstagramPost['type'] })

  // New external collab
  const [newCollab, setNewCollab] = useState({ ...emptyNewPost })

  // Collab comparison (all-time, loaded once)
  type CollabRow = { account: string; count: number; avgViews: number; avgER: number }
  const [collabComparison, setCollabComparison] = useState<CollabRow[]>([])
  const [collabWithout, setCollabWithout] = useState(0)
  const [collabsOpen, setCollabsOpen] = useState(false)
  const [weeklyOpen, setWeeklyOpen] = useState(false)
  const [typeBreakdownOpen, setTypeBreakdownOpen] = useState(false)
  const [extCollabOpen, setExtCollabOpen] = useState(false)
  const [presentationMode, setPresentationMode] = useState(false)
  const [expandedCollab, setExpandedCollab] = useState<string | null>(null)
  const [collabPostsMap, setCollabPostsMap] = useState<Record<string, InstagramPost[]>>({})
  const [loadingCollab, setLoadingCollab] = useState<string | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [featuredItems, setFeaturedItems] = useState<Array<{ id: string; post_url: string | null }>>([])
  const [featuredFormPostId, setFeaturedFormPostId] = useState<string | null>(null)
  const [featuredNote, setFeaturedNote] = useState('')
  const [savingFeatured, setSavingFeatured] = useState(false)
  const [featuredError, setFeaturedError] = useState<string | null>(null)
  const [prevStats, setPrevStats] = useState<InstagramStats | null>(null)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [erTypeHistory, setErTypeHistory] = useState<Awaited<ReturnType<typeof getInstagramErByTypeHistory>>>([])
  const [distOpen, setDistOpen] = useState(false)

  useEffect(() => {
    getInstagramCollabComparison().then(({ comparison, withoutAccount }) => {
      setCollabComparison(comparison)
      setCollabWithout(withoutAccount)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    getInstagramErByTypeHistory().then(setErTypeHistory).catch(() => {})
  }, [])

  useEffect(() => {
    getFeaturedContent(year, month)
      .then(items => setFeaturedItems(items.map(i => ({ id: i.id, post_url: i.post_url }))))
      .catch(() => {})
  }, [year, month])

  useEffect(() => {
    const check = () => setPresentationMode(document.body.classList.contains('presentation-mode'))
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.body, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [data, hist] = await Promise.all([
        getInstagramStats({ year, month }),
        getInstagramHistory(),
      ])
      setStats(data)
      setHistory(hist)
      setFollowers(String(data.monthly?.total_followers ?? ''))
      setNewFollowers(String(data.monthly?.new_followers ?? ''))
      setViewsApp(String(data.monthly?.total_views_manual ?? ''))
      setReachApp(String(data.monthly?.total_reach_manual ?? ''))
      setInteractionsApp(String((data.monthly as Record<string,number> | null)?.total_interactions ?? ''))
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Error al cargar datos de Instagram')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelected(new Set()); setCompareMode(false) }, [year, month])

  async function saveMonthly() {
    setSaving(true)
    await upsertInstagramMonthly({
      year, month,
      total_followers: parseInt(followers) || 0,
      new_followers: parseInt(newFollowers) || 0,
      total_views_manual: parseInt(viewsApp) || 0,
      total_reach_manual: parseInt(reachApp) || 0,
      total_interactions: parseInt(interactionsApp) || undefined,
    })
    clearCache()
    await load()
    setEditMonthly(false)
    setSaving(false)
  }

  async function savePost(isCollab: boolean) {
    const src = isCollab ? newCollab : newPost
    if (!src.description && !src.permalink) return
    setSaving(true)
    await addInstagramPostManual({
      year, month,
      type: isCollab ? 'Collab' : src.type,
      description: src.description || null,
      post_date: src.post_date || null,
      views: parseInt(src.views) || 0,
      impressions: parseInt(src.views) || 0,
      likes: parseInt(src.likes) || 0,
      comments: parseInt(src.comments) || 0,
      shares: parseInt(src.shares) || 0,
      saves: parseInt(src.saves) || 0,
      permalink: src.permalink || null,
      collab_account: src.collab_account || null,
      is_manual: true,
    })
    if (isCollab) { setNewCollab({ ...emptyNewPost }); setShowAddCollabForm(false) }
    else { setNewPost({ ...emptyNewPost, type: 'Reel' }); setShowAddForm(false) }
    clearCache()
    await load()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este post? Las métricas se recalcularán automáticamente.')) return
    await deleteInstagramPost(id)
    clearCache()
    await load()
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleSelectAll(items: { id: string }[]) {
    setSelected(s => s.size === items.length && items.length > 0 ? new Set() : new Set(items.map(x => x.id)))
  }
  async function handleDeleteSelected() {
    if (!confirm(`¿Eliminar ${selected.size} elemento(s)? Esta acción no se puede deshacer.`)) return
    await Promise.all([...selected].map(id => deleteInstagramPost(id)))
    setSelected(new Set())
    clearCache()
    await load()
  }

  async function handleCollabExpand(account: string) {
    if (expandedCollab === account) { setExpandedCollab(null); return }
    setExpandedCollab(account)
    if (collabPostsMap[account]) return
    setLoadingCollab(account)
    const posts = await getInstagramPostsByCollab(account)
    setCollabPostsMap(m => ({ ...m, [account]: posts }))
    setLoadingCollab(null)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const posts = stats?.posts ?? []
  const externalCollabs = posts.filter(p => p.is_manual && p.type === 'Collab')
  const regularPosts = posts.filter(p => !(p.is_manual && p.type === 'Collab'))
  const filtered = (presentationMode || filterType === 'all') ? regularPosts : regularPosts.filter(p => p.type === filterType)
  const sorted = [...filtered].sort((a, b) => {
    let av = 0, bv = 0
    if (sortKey === 'views') { av = a.views; bv = b.views }
    else if (sortKey === 'likes') { av = a.likes; bv = b.likes }
    else if (sortKey === 'er') { av = erForPost(a); bv = erForPost(b) }
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }: { k: SortKey }) => sortKey === k
    ? (sortDir === 'desc' ? <ChevronDown size={13} /> : <ChevronUp size={13} />)
    : null

  const grandTotal = stats?.grandTotalViews ?? 0
  const collabViewsSum = stats?.externalCollabViews ?? 0
  const appViews = stats?.monthly?.total_views_manual ?? 0

  const histLast = history.slice(-12)
  const curH = history.find(d => d.year === year && d.month === month)
  const prevH = (() => {
    const pm = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
    return history.find(d => d.year === pm.y && d.month === pm.m)
  })()

  const viewsChart = useMemo(() => {
    const vals = histLast.map(d => d.views)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.views, ma: ma[i] }))
  }, [histLast])
  const intChart = useMemo(() => {
    const vals = histLast.map(d => d.interactions)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: d.interactions, ma: ma[i] }))
  }, [histLast])
  const scatterData = useMemo(() => {
    type Pt = { x: number; rawX: number; y: number; type: string; desc: string }
    const nonStories = regularPosts.filter(p => p.type !== 'Story')
    const pts: Pt[] = nonStories.map(p => ({
      rawX: p.views,
      x: Math.log10(Math.max(p.views, 1)),
      y: +erForPost(p).toFixed(2),
      type: p.type,
      desc: (p.description || '(sin título)').slice(0, 40),
    }))
    const avgLogX = pts.length ? pts.reduce((a, p) => a + p.x, 0) / pts.length : 0
    const avgY = pts.length ? pts.reduce((a, p) => a + p.y, 0) / pts.length : 0
    const xTicks: number[] = []
    const xDomain: [number, number] = [0, 6]
    if (pts.length) {
      const minLog = Math.floor(Math.min(...pts.map(p => p.x)) - 0.3)
      const maxLog = Math.ceil(Math.max(...pts.map(p => p.x)) + 0.3)
      for (let t = Math.max(0, minLog); t <= maxLog; t++) xTicks.push(t)
      xDomain[0] = Math.max(0, minLog)
      xDomain[1] = maxLog
    }
    const byType = (['Reel', 'Post', 'Collab'] as const)
      .map(t => ({ type: t as string, pts: pts.filter(p => p.type === t) }))
      .filter(g => g.pts.length > 0)
    return { pts, avgLogX, avgY, byType, xTicks, xDomain }
  }, [regularPosts])
  const erChart = useMemo(() => {
    const vals = histLast.map(d => d.er)
    const ma = movingAvg(vals, 3)
    return histLast.map((d, i) => ({ label: shortMonthLabel(d.year, d.month), value: +d.er.toFixed(2), ma: ma[i] ? +ma[i]!.toFixed(2) : null }))
  }, [histLast])

  const igFollowerChart = useMemo(() => {
    const real = histLast.filter(d => d.totalFollowers > 0)
    const pts = real.map((d, i) => ({
      label: shortMonthLabel(d.year, d.month),
      followers: d.totalFollowers,
      pctChange: i > 0 ? ((d.totalFollowers - real[i - 1].totalFollowers) / real[i - 1].totalFollowers) * 100 : null,
      projected: undefined as number | undefined,
    }))
    // 3-month projection from avg % growth of last 6 real history points
    const allReal = history.filter(d => d.totalFollowers > 0)
    const projPts: { label: string; projected: number }[] = []
    if (allReal.length >= 3) {
      const slice = allReal.slice(-6)
      const rates: number[] = []
      for (let i = 1; i < slice.length; i++)
        rates.push((slice[i].totalFollowers - slice[i - 1].totalFollowers) / slice[i - 1].totalFollowers)
      const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0
      let val = allReal[allReal.length - 1].totalFollowers
      let { year: y, month: m } = allReal[allReal.length - 1]
      for (let i = 0; i < 3; i++) {
        m++; if (m > 12) { m = 1; y++ }
        val = Math.round(val * (1 + avgRate))
        projPts.push({ label: shortMonthLabel(y, m), projected: val })
      }
    }
    // Bridge: set projected on the last real point so lines connect
    if (pts.length > 0 && projPts.length > 0)
      pts[pts.length - 1] = { ...pts[pts.length - 1], projected: pts[pts.length - 1].followers }
    const combined: { label: string; followers?: number; projected?: number; pctChange: number | null }[] = [...pts]
    projPts.forEach(p => combined.push({ label: p.label, projected: p.projected, pctChange: null }))
    return combined
  }, [histLast, history])

  const summaryText = useMemo(() => {
    const allPosts = stats?.posts ?? []
    const regPosts = allPosts.filter(p => !(p.is_manual && p.type === 'Collab'))
    const bestPost = [...regPosts].sort((a, b) => b.views - a.views)[0]
    const total = stats?.grandTotalViews ?? 0
    const parts: string[] = [monthLabel(year, month)]
    if (total > 0) {
      parts.push(`${formatNumber(total)} views`)
      if (prevH?.views) {
        const pct = pctChange(total, prevH.views)
        if (pct !== null) parts.push(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs mes ant.`)
      }
    }
    if (bestPost) {
      const desc = bestPost.description || '(sin título)'
      const truncated = desc.length > 40 ? desc.slice(0, 40) + '…' : desc
      parts.push(`Mejor post: "${truncated}" (${formatNumber(bestPost.views)} views)`)
    }
    return parts.join(' · ')
  }, [year, month, stats, prevH])

  const bestErPostId = useMemo(() => {
    if (filtered.length <= 5) return null
    const eligible = filtered.filter(p => (p.views ?? 0) >= 100)
    if (!eligible.length) return null
    const bestEr = eligible.reduce((a, b) => erForPost(a) > erForPost(b) ? a : b)
    const topViews = [...filtered].sort((a, b) => (b.views ?? 0) - (a.views ?? 0))[0]
    if (!topViews || bestEr.id === topViews.id) return null
    return bestEr.id
  }, [filtered])

  // Computed client-side from already-loaded posts — avoids a redundant extra query
  const typeBreakdown = useMemo(() => {
    const posts = (stats?.posts ?? []).filter(p => !(p.is_manual && p.type === 'Collab'))
    const byType: Record<string, { count: number; totalViews: number; totalER: number }> = {}
    for (const p of posts) {
      if (!byType[p.type]) byType[p.type] = { count: 0, totalViews: 0, totalER: 0 }
      byType[p.type].count++
      byType[p.type].totalViews += p.views ?? 0
      byType[p.type].totalER += erForPost(p)
    }
    return Object.entries(byType)
      .map(([type, d]) => ({
        type, count: d.count,
        avgViews: d.count ? d.totalViews / d.count : 0,
        avgER: d.count ? d.totalER / d.count : 0,
      }))
      .sort((a, b) => b.avgViews - a.avgViews)
  }, [stats])

  const weeklyActivity = useMemo(() => {
    const withDate = regularPosts.filter(p => p.post_date)
    if (withDate.length < 5) return null
    const defs = [
      { label: 'Sem 1', range: '1–7', lo: 1, hi: 7 },
      { label: 'Sem 2', range: '8–14', lo: 8, hi: 14 },
      { label: 'Sem 3', range: '15–21', lo: 15, hi: 21 },
      { label: 'Sem 4', range: '22–28', lo: 22, hi: 28 },
      { label: 'Sem 5', range: '29–31', lo: 29, hi: 31 },
    ]
    return defs.map(def => {
      const bucket = withDate.filter(p => {
        const d = new Date(p.post_date! + 'T12:00:00Z').getUTCDate()
        return d >= def.lo && d <= def.hi
      })
      return {
        label: def.label, range: def.range,
        count: bucket.length,
        totalViews: bucket.reduce((a, p) => a + p.views, 0),
        avgER: bucket.length ? bucket.reduce((a, p) => a + erForPost(p), 0) / bucket.length : 0,
      }
    }).filter(w => w.count > 0)
  }, [regularPosts])

  const contentInsight = useMemo(() => {
    if (typeBreakdown.length < 2) return null
    const collab = typeBreakdown.find(t => t.type === 'Collab')
    const reel = typeBreakdown.find(t => t.type === 'Reel')
    const post = typeBreakdown.find(t => t.type === 'Post')
    if (collab && reel && collab.count >= 1 && reel.count >= 1 && reel.avgViews > 0 && collab.avgViews / reel.avgViews >= 2) {
      const ratio = (collab.avgViews / reel.avgViews).toFixed(1)
      return `Los collabs generan ${ratio}x más alcance que los reels este mes — considerar aumentar la frecuencia`
    }
    if (reel && post && reel.count >= 1 && post.count >= 1 && post.avgER > 0 && reel.avgER / post.avgER >= 1.5) {
      const ratio = (reel.avgER / post.avgER).toFixed(1)
      return `Los reels tienen ${ratio}x más engagement que los posts — priorizar formato video`
    }
    if (post && reel && post.count >= 1 && reel.count >= 1 && reel.avgER > 0 && post.avgER / reel.avgER >= 1.3) {
      const ratio = (post.avgER / reel.avgER).toFixed(1)
      return `Los posts generan más engagement por view que los reels (${ratio}x) — el formato estático está funcionando`
    }
    if (collab && collab.count >= 1) {
      const own = typeBreakdown.filter(t => t.type !== 'Collab')
      if (own.length > 0) {
        const totalOwn = own.reduce((a, t) => a + t.count, 0)
        const ownAvgER = totalOwn > 0 ? own.reduce((a, t) => a + t.avgER * t.count, 0) / totalOwn : 0
        if (ownAvgER > 0 && collab.avgER / ownAvgER >= 1.2) {
          return `Los collabs superan el ER promedio del contenido propio — los colaboradores amplifican la conversión`
        }
      }
    }
    return null
  }, [typeBreakdown])

  const bestDayToPost = useMemo(() => {
    const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
    const eligible = regularPosts.filter(p => p.post_date && p.type !== 'Story' && p.impressions > 0)
    if (eligible.length < 10) return null
    const byDay: Record<number, { totalER: number; count: number }> = {}
    for (const p of eligible) {
      const day = new Date(p.post_date! + 'T12:00:00Z').getUTCDay()
      if (!byDay[day]) byDay[day] = { totalER: 0, count: 0 }
      byDay[day].totalER += erForPost(p)
      byDay[day].count++
    }
    const days = Object.entries(byDay)
      .map(([d, v]) => ({ day: +d, avgER: v.count > 0 ? v.totalER / v.count : 0, count: v.count }))
      .filter(d => d.count >= 2)
    if (!days.length) return null
    const best = days.reduce((b, d) => d.avgER > b.avgER ? d : b)
    return { dayName: DAY_NAMES[best.day], avgER: best.avgER }
  }, [regularPosts])

  const freqBadge = useMemo(() => {
    const withDate = regularPosts.filter(p => p.post_date)
    if (!withDate.length) return null
    const weekCounts: Record<number, number> = {}
    for (const p of withDate) {
      const day = new Date(p.post_date! + 'T12:00:00Z').getUTCDate()
      const wk = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5
      weekCounts[wk] = (weekCounts[wk] ?? 0) + 1
    }
    const counts = Object.values(weekCounts)
    return counts.reduce((a, b) => a + b, 0) / counts.length
  }, [regularPosts])

  const prevMonthFilter = useMemo(() => {
    const m = month === 1 ? 12 : month - 1
    const y = month === 1 ? year - 1 : year
    return { year: y, month: m }
  }, [year, month])

  useEffect(() => {
    if (!compareMode) { setPrevStats(null); return }
    setLoadingCompare(true)
    getInstagramStats(prevMonthFilter)
      .then(setPrevStats)
      .catch(() => {})
      .finally(() => setLoadingCompare(false))
  }, [compareMode, prevMonthFilter])

  const prevTypeBreakdown = useMemo(() => {
    if (!prevStats) return []
    const posts = (prevStats.posts ?? []).filter(p => !(p.is_manual && p.type === 'Collab'))
    const byType: Record<string, { count: number; totalViews: number; totalER: number }> = {}
    for (const p of posts) {
      if (!byType[p.type]) byType[p.type] = { count: 0, totalViews: 0, totalER: 0 }
      byType[p.type].count++
      byType[p.type].totalViews += p.views ?? 0
      byType[p.type].totalER += erForPost(p)
    }
    return Object.entries(byType)
      .map(([type, d]) => ({
        type, count: d.count,
        avgViews: d.count ? d.totalViews / d.count : 0,
        avgER: d.count ? d.totalER / d.count : 0,
      }))
      .sort((a, b) => b.avgViews - a.avgViews)
  }, [prevStats])

  const collabScores = useMemo(() => {
    if (collabComparison.length < 2) return {}
    const totalRows = collabComparison.length
    const avgViews = collabComparison.reduce((a, r) => a + r.avgViews, 0) / totalRows
    const avgER = collabComparison.reduce((a, r) => a + r.avgER, 0) / totalRows
    const result: Record<string, number> = {}
    for (const row of collabComparison) {
      const viewsScore = ratioToScore(avgViews > 0 ? row.avgViews / avgViews : 0)
      const erScore = ratioToScore(avgER > 0 ? row.avgER / avgER : 0)
      const consistencyScore = (Math.min(row.count, 10) / 10) * 100
      result[row.account] = Math.round(0.4 * viewsScore + 0.4 * erScore + 0.2 * consistencyScore)
    }
    return result
  }, [collabComparison])

  const erByTypeChart = useMemo(() => {
    if (!erTypeHistory.length) return null
    const types = ['Reel', 'Post', 'Collab']
    const monthKeys = [...new Set(erTypeHistory.map(r => `${r.year}-${r.month}`))].sort()
    if (monthKeys.length < 3) return null
    const validTypes = types.filter(t => erTypeHistory.filter(r => r.type === t).length >= 3)
    if (validTypes.length < 1) return null
    const rows = monthKeys.map(k => {
      const [yr, mo] = k.split('-').map(Number)
      const entry: Record<string, string | number | null> = { label: shortMonthLabel(yr, mo) }
      for (const t of validTypes) {
        const found = erTypeHistory.find(r => r.year === yr && r.month === mo && r.type === t)
        entry[t] = found ? found.avgEr : null
        entry[`${t}_count`] = found ? found.postCount : null
      }
      return entry
    })
    return { rows, validTypes }
  }, [erTypeHistory])

  const viewsDist = useMemo(() => {
    const ranges = [
      { label: '0–1k',     lo: 0,      hi: 1000 },
      { label: '1k–5k',    lo: 1000,   hi: 5000 },
      { label: '5k–15k',   lo: 5000,   hi: 15000 },
      { label: '15k–50k',  lo: 15000,  hi: 50000 },
      { label: '50k–150k', lo: 50000,  hi: 150000 },
      { label: '150k+',    lo: 150000, hi: Infinity },
    ]
    const nonCollab = regularPosts.filter(p => p.type !== 'Story')
    if (nonCollab.length < 3) return null
    const buckets = ranges.map(r => ({
      label: r.label,
      count: nonCollab.filter(p => p.views >= r.lo && p.views < r.hi).length,
    })).filter(b => b.count > 0)
    if (buckets.length < 2) return null

    const totalViews = nonCollab.reduce((a, p) => a + p.views, 0)
    const topPost = [...nonCollab].sort((a, b) => b.views - a.views)[0]
    const topShare = totalViews > 0 && topPost ? topPost.views / totalViews : 0
    const insight = topShare > 0.5
      ? `El alcance está concentrado en 1 post — el mes depende de un solo contenido`
      : topShare < 0.3
      ? `Alcance bien distribuido entre los posts del mes`
      : null

    return { buckets, insight }
  }, [regularPosts])

  const chartCardCls = 'bg-white rounded-2xl border border-gray-100 p-4 shadow-sm'

  function isFeaturedId(post: InstagramPost): string | null {
    if (!post.permalink) return null
    return featuredItems.find(f => f.post_url === post.permalink)?.id ?? null
  }

  async function handleUnfeature(featuredId: string) {
    await deleteFeaturedContent(featuredId)
    setFeaturedItems(items => items.filter(i => i.id !== featuredId))
  }

  async function handleSaveFeature(post: InstagramPost) {
    if (!featuredNote.trim()) return
    setSavingFeatured(true)
    setFeaturedError(null)
    const er = erForPost(post)
    const { data, error } = await addFeaturedContent({
      year, month,
      channel: 'instagram',
      post_url: post.permalink || null,
      description: post.description || null,
      views: post.views || null,
      er_pct: er > 0 ? +er.toFixed(2) : null,
      editorial_note: featuredNote.trim(),
    })
    setSavingFeatured(false)
    if (error || !data) {
      setFeaturedError((error as { message?: string })?.message ?? 'No se pudo guardar. Intentá de nuevo.')
      return
    }
    setFeaturedItems(items => [...items, { id: data.id, post_url: data.post_url }])
    setFeaturedFormPostId(null)
    setFeaturedNote('')
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Instagram — @weareseeds_</h1>
            <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · {formatNumber(stats?.monthly?.total_followers ?? 0)} followers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { clearCache(); load() }}
            className="presentation-hide p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Actualizar datos"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setCompareMode(c => !c)}
            className={`presentation-hide text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
              compareMode ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {compareMode ? 'Comparando' : 'Comparar con mes anterior'}
          </button>
          <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
          ⚠ {error}
        </div>
      )}
      {loading ? (
        <>
          <SkeletonCard kpi count={4} />
          <SkeletonCard chart />
          <SkeletonCard chart />
          <SkeletonCard lines={5} />
        </>
      ) : (
        <>
          {/* Month summary */}
          {summaryText && (
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 text-xs text-gray-500 mb-3">
              {summaryText}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 mb-5">
            {freqBadge !== null && (
              <div className={`presentation-hide inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${
                freqBadge >= 3 ? 'bg-emerald-100 text-emerald-700' :
                freqBadge >= 1 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                ~{freqBadge.toFixed(1)} posts/sem
              </div>
            )}
            {bestDayToPost && (
              <div className="inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold bg-violet-50 text-violet-700">
                📅 Mejor día: {bestDayToPost.dayName} (ER {bestDayToPost.avgER.toFixed(1)}% promedio)
              </div>
            )}
          </div>

          {/* KPI trend cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Views / Impr.', val: grandTotal, prev: prevH?.views, fmt: formatNumber,
                sub: collabViewsSum > 0 ? `App ${formatNumber(appViews)} + Collabs ${formatNumber(collabViewsSum)}` : undefined },
              { label: 'Interacciones', val: stats?.totalInteractions ?? 0, prev: prevH?.interactions, fmt: formatNumber },
              { label: 'Engagement %', val: stats?.avgER ?? 0, prev: prevH?.er, fmt: (v: number) => formatPercent(v) },
              { label: 'Nuevos seguidores', val: stats?.monthly?.new_followers ?? 0, prev: prevH?.newFollowers, fmt: (v: number) => `+${formatNumber(v)}` },
            ].map(({ label, val, prev, fmt, sub }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-900">{fmt(val)}</div>
                {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
                <div className="flex gap-3 mt-1 flex-wrap">
                  <span className="text-xs text-gray-400">
                    <TrendBadge value={val} prev={prev} />
                    <span className="ml-1">vs mes ant.</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Month comparison panel */}
          {compareMode && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                  Comparación: {monthLabel(year, month)} vs {monthLabel(prevMonthFilter.year, prevMonthFilter.month)}
                </div>
                {loadingCompare && <span className="text-xs text-indigo-400">Cargando...</span>}
              </div>
              {prevStats && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-indigo-200">
                        <th className="text-left py-1.5 px-2 text-xs font-medium text-indigo-400">Métrica</th>
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-indigo-400">{shortMonthLabel(year, month)}</th>
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-indigo-400">{shortMonthLabel(prevMonthFilter.year, prevMonthFilter.month)}</th>
                        <th className="text-right py-1.5 px-2 text-xs font-medium text-indigo-400">Cambio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Views totales', cur: stats?.grandTotalViews ?? 0, prev: prevStats.grandTotalViews ?? 0, fmt: formatNumber },
                        { label: 'Interacciones', cur: stats?.totalInteractions ?? 0, prev: prevStats.totalInteractions ?? 0, fmt: formatNumber },
                        { label: 'Nuevos seguidores', cur: stats?.monthly?.new_followers ?? 0, prev: prevStats.monthly?.new_followers ?? 0, fmt: (v: number) => `+${formatNumber(v)}` },
                        { label: 'Engagement %', cur: stats?.avgER ?? 0, prev: prevStats.avgER ?? 0, fmt: formatPercent },
                      ].map(({ label, cur, prev, fmt }) => {
                        const chg = prev > 0 ? ((cur - prev) / prev) * 100 : null
                        return (
                          <tr key={label} className="border-b border-indigo-50">
                            <td className="py-2 px-2 text-gray-700">{label}</td>
                            <td className="py-2 px-2 text-right font-semibold text-gray-900">{fmt(cur)}</td>
                            <td className="py-2 px-2 text-right text-gray-500">{fmt(prev)}</td>
                            <td className={`py-2 px-2 text-right font-semibold ${chg === null ? 'text-gray-400' : chg >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {chg !== null ? `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Follower evolution */}
          {igFollowerChart.filter(d => d.followers).length >= 2 && (
            <div className={chartCardCls + ' mb-4'}>
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">
                Evolución de seguidores{igFollowerChart.some(d => d.projected && !d.followers) ? ' (incl. proyección)' : ''}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart data={igFollowerChart} margin={{ top: 36, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Line type="monotone" dataKey="followers" name="Seguidores" stroke="#ec4899" strokeWidth={2}
                    dot={<IgFollowerDot /> as unknown as boolean} activeDot={{ r: 5 }} connectNulls={false} />
                  {igFollowerChart.some(d => d.projected && !d.followers) && (
                    <Line type="monotone" dataKey="projected" name="Proyección" stroke="#f9a8d4"
                      strokeWidth={1.5} strokeDasharray="4 3"
                      dot={{ r: 3, fill: '#f9a8d4', strokeWidth: 0 }} connectNulls />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Content type insight */}
          {contentInsight && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-sm text-emerald-700 mb-4">
              💡 {contentInsight}
            </div>
          )}

          {/* Historical charts */}
          {histLast.length >= 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* 1. Impresiones / Views */}
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Impresiones / Views</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={viewsChart} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="igViewsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => formatNumber(Number(v))} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v, n) => [formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Area type="monotone" dataKey="value" name="Views" stroke="#f43f5e" fill="url(#igViewsGrad)" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }} />
                    <Line type="monotone" dataKey="ma" name="Media 3m" stroke="#f43f5e" strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 2. Scatter: Alcance vs Engagement (replaces Nuevos seguidores) */}
              <div className={chartCardCls}>
                <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">Alcance vs Engagement</div>
                {scatterData.pts.length >= 5 ? (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={180}>
                      <ScatterChart margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" dataKey="x" name="Views" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={logTickFmt} ticks={scatterData.xTicks} domain={scatterData.xDomain} axisLine={false} tickLine={false} />
                        <YAxis type="number" dataKey="y" name="ER%" tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                        <ZAxis range={[40, 40]} />
                        <Tooltip content={<ScatterTooltip />} />
                        <ReferenceLine x={scatterData.avgLogX} stroke="#d1d5db" strokeDasharray="4 2" strokeWidth={1} />
                        <ReferenceLine y={scatterData.avgY} stroke="#d1d5db" strokeDasharray="4 2" strokeWidth={1} />
                        {scatterData.byType.map(({ type, pts }) => (
                          <Scatter key={type} name={type} data={pts} fill={IG_SCATTER_COLORS[type] ?? '#6b7280'} opacity={0.85} />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                    <span className="absolute top-5 right-2 text-[9px] font-medium text-gray-400 pointer-events-none">Ideal</span>
                    <span className="absolute top-5 left-10 text-[9px] font-medium text-gray-400 pointer-events-none">Nicho</span>
                    <span className="absolute bottom-1 right-2 text-[9px] font-medium text-gray-400 pointer-events-none">Viral superficial</span>
                    <span className="absolute bottom-1 left-10 text-[9px] font-medium text-gray-400 pointer-events-none">A mejorar</span>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-xs text-gray-400 text-center px-4">
                    Cargá al menos 5 Reels o Posts para ver este análisis
                  </div>
                )}
              </div>

              {/* 3 & 4: Interacciones and Engagement % */}
              {[
                { title: 'Interacciones', data: intChart, color: '#f43f5e', gradId: 'igIntGrad', isPercent: false },
                { title: 'Engagement %', data: erChart, color: '#e11d48', gradId: 'igErGrad', isPercent: true },
              ].map(({ title, data, color, gradId, isPercent }) => (
                <div key={title} className={chartCardCls}>
                  <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">{title}</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={data} margin={{ top: 16, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={color} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => isPercent ? `${v}%` : formatNumber(Number(v))} axisLine={false} tickLine={false} width={isPercent ? 32 : 44} />
                      <Tooltip formatter={(v, n) => [isPercent ? `${Number(v).toFixed(2)}%` : formatNumber(Number(v)), n as string]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Area type="monotone" dataKey="value" name={title} stroke={color} fill={`url(#${gradId})`} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} />
                      <Line type="monotone" dataKey="ma" name="Media 3m" stroke={color} strokeDasharray="5 3" dot={false} strokeWidth={1.5} connectNulls strokeOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ))}
            </div>
          )}

          {erByTypeChart && (
            <div className={chartCardCls + ' mb-4'}>
              <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase mb-3">
                Tendencia de engagement por tipo
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={erByTypeChart.rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} width={36} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="bg-white border border-gray-200 rounded-xl p-2 text-xs shadow-lg">
                          <div className="font-medium text-gray-700 mb-1">{label}</div>
                          {payload.map(p => p.value != null && (
                            <div key={p.dataKey as string} style={{ color: p.color }} className="flex justify-between gap-3">
                              <span>{p.name}</span>
                              <span className="font-semibold">{Number(p.value).toFixed(2)}%</span>
                            </div>
                          ))}
                        </div>
                      )
                    }}
                  />
                  {erByTypeChart.validTypes.includes('Reel') && (
                    <Line type="monotone" dataKey="Reel" name="Reel" stroke="#ec4899" strokeWidth={2} dot={{ r: 3, fill: '#ec4899', strokeWidth: 0 }} connectNulls />
                  )}
                  {erByTypeChart.validTypes.includes('Post') && (
                    <Line type="monotone" dataKey="Post" name="Post" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }} connectNulls />
                  )}
                  {erByTypeChart.validTypes.includes('Collab') && (
                    <Line type="monotone" dataKey="Collab" name="Collab" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }} connectNulls />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Monthly manual data card */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <CardTitle>Datos del mes (desde la app)</CardTitle>
              <button onClick={() => setEditMonthly(!editMonthly)}
                className="presentation-hide flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <PencilLine size={12} /> {editMonthly ? 'Cancelar' : 'Editar'}
              </button>
            </div>

            {editMonthly ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Views totales (app)
                    <span className="ml-1 text-gray-400 cursor-help" title="Ingresá el total del Meta overview. No incluyas posts de colaboraciones externas — esos se agregan automáticamente.">ⓘ</span>
                  </label>
                  <input type="number" value={viewsApp} onChange={e => setViewsApp(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Accounts reached</label>
                  <input type="number" value={reachApp} onChange={e => setReachApp(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Seguidores totales</label>
                  <input type="number" value={followers} onChange={e => setFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Nuevos seguidores</label>
                  <input type="number" value={newFollowers} onChange={e => setNewFollowers(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Interacciones totales (app)
                    <span className="ml-1 text-gray-400 cursor-help" title="Total de interacciones del mes que muestra Meta. Si está vacío, se calcula automáticamente sumando likes+comentarios+shares+guardados de cada post.">ⓘ</span>
                  </label>
                  <input type="number" value={interactionsApp} onChange={e => setInteractionsApp(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="col-span-2 lg:col-span-4 flex gap-2 pt-1">
                  <button onClick={saveMonthly} disabled={saving}
                    className="bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-8">
                <div>
                  <div className="text-2xl font-bold">{formatNumber(appViews)}</div>
                  <div className="text-xs text-gray-400">Views (app)</div>
                </div>
                {collabViewsSum > 0 && (
                  <div>
                    <div className="text-2xl font-bold text-orange-500">+{formatNumber(collabViewsSum)}</div>
                    <div className="text-xs text-gray-400">Collabs externos</div>
                  </div>
                )}
                <div>
                  <div className="text-2xl font-bold text-emerald-600">{formatNumber(grandTotal)}</div>
                  <div className="text-xs text-gray-400">Total reportado</div>
                </div>
                <div className="border-l border-gray-100 pl-8">
                  <div className="text-2xl font-bold">{formatNumber(stats?.monthly?.total_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Seguidores</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">+{formatNumber(stats?.monthly?.new_followers ?? 0)}</div>
                  <div className="text-xs text-gray-400">Nuevos este mes</div>
                </div>
              </div>
            )}
          </Card>

          {/* Content type breakdown */}
          {typeBreakdown.length >= 2 && (
            <Card className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setTypeBreakdownOpen(o => !o)}
              >
                <span className="text-sm font-semibold text-gray-700">Rendimiento por tipo de contenido</span>
                <span className="text-gray-400">{typeBreakdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
              {typeBreakdownOpen && <div className="overflow-x-auto mt-4">
                {compareMode && prevStats ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Tipo</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Posts {shortMonthLabel(year, month)}</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views prom. {shortMonthLabel(year, month)}</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Posts {shortMonthLabel(prevMonthFilter.year, prevMonthFilter.month)}</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views prom. {shortMonthLabel(prevMonthFilter.year, prevMonthFilter.month)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeBreakdown.map(row => {
                        const prev = prevTypeBreakdown.find(r => r.type === row.type)
                        return (
                          <tr key={row.type} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-3">
                              <Badge variant={(row.type.toLowerCase() as 'reel' | 'post' | 'collab' | 'story' | 'manual') || 'default'} className="text-xs">{row.type}</Badge>
                            </td>
                            <td className="py-2 px-3 text-right font-semibold">{row.count}</td>
                            <td className="py-2 px-3 text-right font-semibold">{formatNumber(Math.round(row.avgViews))}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{prev ? prev.count : '—'}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{prev ? formatNumber(Math.round(prev.avgViews)) : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Tipo</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Posts</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views promedio</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">ER% promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeBreakdown.map(row => (
                        <tr key={row.type} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3">
                            <Badge variant={(row.type.toLowerCase() as 'reel' | 'post' | 'collab' | 'story' | 'manual') || 'default'} className="text-xs">{row.type}</Badge>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700">{row.count}</td>
                          <td className="py-2 px-3 text-right font-medium">{formatNumber(Math.round(row.avgViews))}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{formatPercent(row.avgER)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>}
            </Card>
          )}

          {/* Weekly activity */}
          {weeklyActivity && weeklyActivity.length > 0 && (
            <Card className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setWeeklyOpen(o => !o)}
              >
                <span className="text-sm font-semibold text-gray-700">Actividad semanal</span>
                <span className="text-gray-400">{weeklyOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
              {weeklyOpen && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Semana</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Posts</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views totales</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">ER% promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyActivity.map(w => (
                        <tr key={w.label} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-3 text-gray-700">
                            <span className="font-medium">{w.label}</span>
                            <span className="text-gray-400 text-xs ml-1">({w.range})</span>
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700">{w.count}</td>
                          <td className="py-2 px-3 text-right font-medium">{formatNumber(w.totalViews)}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{formatPercent(w.avgER)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {viewsDist && (
            <Card className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setDistOpen(o => !o)}
              >
                <span className="text-sm font-semibold text-gray-700">Distribución de alcance</span>
                <span className="text-gray-400">{distOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
              {distOpen && (
                <div className="mt-4">
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={viewsDist.buckets} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={60} />
                      <Tooltip formatter={(v) => [`${v} posts`, 'Posts']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="count" name="Posts" fill="#f43f5e" radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="count" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#374151' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {viewsDist.insight && (
                    <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                      {viewsDist.insight}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Colaboradores comparison (all-time, 2+ accounts required) */}
          {collabComparison.length >= 2 && (
            <Card className="mb-6">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setCollabsOpen(o => !o)}
              >
                <span className="text-sm font-semibold text-gray-700">Colaboradores</span>
                <span className="text-gray-400">{collabsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
              {collabsOpen && (
                <div className="mt-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-3 text-xs font-medium text-gray-400">Colaborador</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Collabs</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">Views promedio</th>
                          <th className="text-right py-2 px-3 text-xs font-medium text-gray-400">ER% promedio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collabComparison.map(row => (
                          <>
                            <tr
                              key={row.account}
                              className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer select-none"
                              onClick={() => handleCollabExpand(row.account)}
                            >
                              <td className="py-2 px-3 font-medium text-orange-600 flex items-center gap-1">
                                {expandedCollab === row.account ? <ChevronUp size={13} className="text-gray-400 shrink-0" /> : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
                                {row.account}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-700">{row.count}</td>
                              <td className="py-2 px-3 text-right font-medium">{formatNumber(Math.round(row.avgViews))}</td>
                              <td className="py-2 px-3 text-right text-gray-600">{formatPercent(row.avgER)}</td>
                            </tr>
                            {expandedCollab === row.account && (
                              <tr key={`${row.account}-detail`}>
                                <td colSpan={4} className="px-3 pb-3 pt-1 bg-orange-50/60">
                                  {loadingCollab === row.account ? (
                                    <div className="text-xs text-gray-400 py-2">Cargando posts...</div>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-orange-100">
                                          <th className="text-left py-1.5 px-2 font-medium text-gray-400">#</th>
                                          <th className="text-left py-1.5 px-2 font-medium text-gray-400">Descripción</th>
                                          <th className="text-left py-1.5 px-2 font-medium text-gray-400">Mes</th>
                                          <th className="text-right py-1.5 px-2 font-medium text-gray-400">Views</th>
                                          <th className="text-right py-1.5 px-2 font-medium text-gray-400">ER%</th>
                                          <th className="py-1.5 px-2 w-6" />
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(collabPostsMap[row.account] ?? []).map((p, idx) => (
                                          <tr key={p.id} className="border-b border-orange-50 last:border-0">
                                            <td className="py-1.5 px-2 text-gray-400">{idx + 1}</td>
                                            <td className="py-1.5 px-2 text-gray-700 max-w-[200px] truncate">{p.description || '—'}</td>
                                            <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{shortMonthLabel(p.year, p.month)}</td>
                                            <td className="py-1.5 px-2 text-right font-medium">{formatNumber(p.views)}</td>
                                            <td className="py-1.5 px-2 text-right text-emerald-600">{formatPercent(erForPost(p))}</td>
                                            <td className="py-1.5 px-2 text-right">
                                              {p.permalink && !p.permalink.startsWith('manual:')
                                                ? <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={12} /></a>
                                                : null}
                                            </td>
                                          </tr>
                                        ))}
                                        {(collabPostsMap[row.account] ?? []).length === 0 && (
                                          <tr><td colSpan={6} className="py-3 text-center text-gray-400">Sin posts registrados</td></tr>
                                        )}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {collabWithout > 0 && (
                    <p className="text-xs text-gray-400 mt-2 px-1">
                      {collabWithout} collab{collabWithout !== 1 ? 's' : ''} sin cuenta registrada no aparece{collabWithout !== 1 ? 'n' : ''} en esta tabla.
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Regular posts table */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <CardTitle>Contenido propio del mes ({regularPosts.length} posts)</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <div className="presentation-hide flex gap-1">
                  {['all', 'Reel', 'Post', 'Collab', 'Story'].map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${filterType === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {t === 'all' ? 'Todos' : t}
                    </button>
                  ))}
                </div>
                {selected.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-red-400"
                  >
                    <Trash2 size={13} /> Eliminar {selected.size}
                  </button>
                )}
                <Link href="/dashboard/upload"
                  className="presentation-hide flex items-center gap-1 text-xs bg-rose-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-rose-400">
                  <Upload size={13} /> Subir CSV
                </Link>
                <button onClick={() => setShowAddForm(!showAddForm)}
                  className="presentation-hide flex items-center gap-1 text-xs bg-emerald-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-emerald-400">
                  <Plus size={13} /> Agregar manual
                </button>
              </div>
            </div>

            {showAddForm && (
              <div className="presentation-hide bg-gray-50 rounded-xl p-4 mb-4 border border-gray-200">
                <div className="text-sm font-medium text-gray-700 mb-3">Nuevo post manual</div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                    <select value={newPost.type} onChange={e => setNewPost(p => ({ ...p, type: e.target.value as InstagramPost['type'] }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {['Reel', 'Post', 'Collab', 'Story'].map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                    <input type="date" value={newPost.post_date} onChange={e => setNewPost(p => ({ ...p, post_date: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                    <input type="text" value={newPost.description} onChange={e => setNewPost(p => ({ ...p, description: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  {['views', 'likes', 'comments', 'shares', 'saves'].map(field => (
                    <div key={field}>
                      <label className="text-xs text-gray-500 block mb-1 capitalize">{field}</label>
                      <input type="number" value={newPost[field as keyof typeof newPost]}
                        onChange={e => setNewPost(p => ({ ...p, [field]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Permalink</label>
                    <input type="text" value={newPost.permalink} onChange={e => setNewPost(p => ({ ...p, permalink: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Cuenta collab</label>
                    <input type="text" placeholder="@sofijobs" value={newPost.collab_account}
                      onChange={e => setNewPost(p => ({ ...p, collab_account: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => savePost(false)} disabled={saving}
                    className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-400 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar post'}
                  </button>
                  <button onClick={() => setShowAddForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="ph-col w-8 py-2 px-2">
                      <input
                        type="checkbox"
                        className="rounded"
                        ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < sorted.length }}
                        checked={sorted.length > 0 && selected.size === sorted.length}
                        onChange={() => toggleSelectAll(sorted)}
                      />
                    </th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Tipo</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Descripción</th>
                    <th className="hidden md:table-cell text-left py-2 px-2 text-xs font-medium text-gray-400">Cuenta</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('views')}>
                      <span className="flex items-center justify-end gap-1">Alcance <SortIcon k="views" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('likes')}>
                      <span className="flex items-center justify-end gap-1">Likes <SortIcon k="likes" /></span>
                    </th>
                    <th className="text-right py-2 px-2 text-xs font-medium text-gray-400 cursor-pointer select-none hover:text-gray-600"
                      onClick={() => toggleSort('er')}>
                      <span className="flex items-center justify-end gap-1">ER% <SortIcon k="er" /></span>
                    </th>
                    <th className="ph-col text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                    <th className="ph-col py-2 px-2 w-8" />
                    <th className="ph-col py-2 px-2 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 && (
                    <tr><td colSpan={11} className="py-8 text-center text-gray-400 text-sm">
                      No hay posts. Subí un CSV o agregá uno manual.
                    </td></tr>
                  )}
                  {sorted.map((post, idx) => {
                    if (presentationMode && idx >= 8) return null
                    const fid = isFeaturedId(post)
                    return (
                    <Fragment key={post.id}>
                    <tr className="border-b border-gray-50 hover:bg-gray-50 group">
                      <td className="ph-col py-2 px-2">
                        <input type="checkbox" className="rounded" checked={selected.has(post.id)} onChange={() => toggleSelect(post.id)} />
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant={post.type.toLowerCase() as 'reel' | 'post' | 'collab' | 'story'}>
                          {post.type}
                        </Badge>
                        {post.is_manual && <Badge variant="manual" className="ml-1">Manual</Badge>}
                      </td>
                      <td className="py-2 px-2 max-w-xs">
                        <div className="flex items-center gap-1">
                          {idx === 0 && sorted.length > 3 && (
                            <span className="text-xs font-semibold text-amber-500 whitespace-nowrap">⭐ Top</span>
                          )}
                          {post.id === bestErPostId && (
                            <span className="text-xs font-semibold text-violet-500 whitespace-nowrap">💎 Mejor ER</span>
                          )}
                          <span className="text-gray-700 truncate">{post.description || '—'}</span>
                        </div>
                        {post.collab_account && (
                          <div className="text-xs text-orange-600 font-medium md:hidden">{post.collab_account}</div>
                        )}
                      </td>
                      <td className="hidden md:table-cell py-2 px-2 text-xs text-gray-500">
                        {post.collab_account || ''}
                      </td>
                      <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                      <td className="py-2 px-2 text-right font-medium text-gray-800">{formatNumber(post.views)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.likes)}</td>
                      <td className="py-2 px-2 text-right font-medium text-emerald-600">{formatPercent(erForPost(post))}</td>
                      <td className="ph-col py-2 px-2 text-right">
                        {post.permalink
                          ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={14} /></a>
                          : '—'}
                      </td>
                      <td className="ph-col py-2 px-2 text-right">
                        {fid
                          ? <button onClick={() => handleUnfeature(fid)} className="text-amber-400 hover:text-gray-300 transition-colors" title="Quitar de destacados"><Star size={14} fill="currentColor" /></button>
                          : <button onClick={() => { setFeaturedFormPostId(featuredFormPostId === post.id ? null : post.id); setFeaturedNote('') }} className="text-gray-400 hover:text-amber-400 transition-colors" title="Destacar este post"><Star size={14} /></button>
                        }
                      </td>
                      <td className="ph-col py-2 px-2 text-right">
                        <button onClick={() => handleDelete(post.id)}
                          className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                    {featuredFormPostId === post.id && (
                      <tr>
                        <td colSpan={11} className="px-3 pb-3 pt-1.5 bg-amber-50 border-b border-amber-100">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-amber-700 whitespace-nowrap">Nota editorial</span>
                              <input
                                type="text"
                                placeholder="¿Por qué destacar este contenido?"
                                value={featuredNote}
                                onChange={e => { setFeaturedNote(e.target.value); setFeaturedError(null) }}
                                onKeyDown={e => e.key === 'Enter' && handleSaveFeature(post)}
                                className="flex-1 border border-amber-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveFeature(post)}
                                disabled={!featuredNote.trim() || savingFeatured}
                                className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-amber-400 disabled:opacity-50 whitespace-nowrap"
                              >
                                {savingFeatured ? '...' : 'Destacar'}
                              </button>
                              <button onClick={() => { setFeaturedFormPostId(null); setFeaturedNote(''); setFeaturedError(null) }} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                            </div>
                            {featuredError && (
                              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1">{featuredError}</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )})}
                  {presentationMode && sorted.length > 8 && (
                    <tr>
                      <td colSpan={11} className="py-2 px-2 text-xs text-gray-400 text-center">
                        y {sorted.length - 8} más...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* External collabs section — collapsible, at bottom */}
          <Card className="mt-6 border-l-4 border-l-orange-400">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => setExtCollabOpen(o => !o)}
            >
              <div>
                <span className="text-sm font-semibold text-gray-700">Collabs externos</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  Contenidos subidos por influencers donde Seeds figura como colaborador. Sus views se suman automáticamente al total.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={e => { e.stopPropagation(); setShowAddCollabForm(v => !v) }}
                  className="presentation-hide flex items-center gap-1 text-xs bg-orange-500 text-white px-3 py-1 rounded-lg font-medium hover:bg-orange-400">
                  <Plus size={13} /> Agregar collab
                </button>
                <span className="text-gray-400">{extCollabOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
              </div>
            </div>
            {extCollabOpen && (
              <div className="mt-4">
                {showAddCollabForm && (
                  <div className="presentation-hide bg-orange-50 rounded-xl p-4 mb-4 border border-orange-200">
                    <div className="text-sm font-medium text-gray-700 mb-3">Nuevo contenido collab externo</div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 block mb-1">Descripción / título del post</label>
                        <input type="text" placeholder="Descripción del contenido"
                          value={newCollab.description} onChange={e => setNewCollab(v => ({ ...v, description: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Cuenta del influencer</label>
                        <input type="text" placeholder="@patriciajebsen"
                          value={newCollab.collab_account} onChange={e => setNewCollab(v => ({ ...v, collab_account: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                        <input type="date" value={newCollab.post_date} onChange={e => setNewCollab(v => ({ ...v, post_date: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Views</label>
                        <input type="number" value={newCollab.views} onChange={e => setNewCollab(v => ({ ...v, views: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Likes</label>
                        <input type="number" value={newCollab.likes} onChange={e => setNewCollab(v => ({ ...v, likes: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Comentarios</label>
                        <input type="number" value={newCollab.comments} onChange={e => setNewCollab(v => ({ ...v, comments: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Link del post</label>
                        <input type="text" placeholder="https://instagram.com/..."
                          value={newCollab.permalink} onChange={e => setNewCollab(v => ({ ...v, permalink: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => savePost(true)} disabled={saving}
                        className="bg-orange-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-400 disabled:opacity-50">
                        {saving ? 'Guardando...' : 'Guardar collab'}
                      </button>
                      <button onClick={() => setShowAddCollabForm(false)} className="text-sm text-gray-500 px-3 py-1.5 hover:text-gray-700">Cancelar</button>
                    </div>
                  </div>
                )}
                {externalCollabs.length === 0 && !showAddCollabForm ? (
                  <p className="text-sm text-gray-400 py-2">No hay collabs externos cargados para este mes.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Cuenta</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Descripción</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-400">Fecha</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Views</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Likes</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-400">Link</th>
                          <th className="py-2 px-2 w-8" />
                        </tr>
                      </thead>
                      <tbody>
                        {externalCollabs.map(post => (
                          <tr key={post.id} className="border-b border-gray-50 hover:bg-orange-50 group">
                            <td className="py-2 px-2">
                              <span className="text-xs font-medium text-orange-600">{post.collab_account || '—'}</span>
                            </td>
                            <td className="py-2 px-2 text-gray-700 max-w-xs truncate">{post.description || '—'}</td>
                            <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{post.post_date ?? '—'}</td>
                            <td className="py-2 px-2 text-right font-medium">{formatNumber(post.views)}</td>
                            <td className="py-2 px-2 text-right text-gray-600">{formatNumber(post.likes)}</td>
                            <td className="py-2 px-2 text-right">
                              {post.permalink
                                ? <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-600 inline-flex"><ExternalLink size={14} /></a>
                                : '—'}
                            </td>
                            <td className="py-2 px-2 text-right">
                              <button onClick={() => handleDelete(post.id)}
                                className="text-gray-200 hover:text-red-500 group-hover:text-gray-400 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-orange-50">
                          <td colSpan={3} className="py-2 px-2 text-xs font-semibold text-orange-700">Total collabs externos</td>
                          <td className="py-2 px-2 text-right text-sm font-bold text-orange-700">{formatNumber(collabViewsSum)}</td>
                          <td colSpan={3} />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
