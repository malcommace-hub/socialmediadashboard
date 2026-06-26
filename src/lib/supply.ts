import { supabase } from './supabase'

// ─── Tipos ───────────────────────────────────
export type Seniority = 'Junior' | 'Semi-Senior' | 'Senior'
export type Channel = 'LinkedIn' | 'Instagram' | 'TikTok'

export const SENIORITIES: Seniority[] = ['Junior', 'Semi-Senior', 'Senior']
export const CHANNELS: Channel[] = ['LinkedIn', 'Instagram', 'TikTok']

export interface SupplyWeek {
  id: string
  week_start: string // YYYY-MM-DD
  insights: string | null
}

export interface SupplyOpportunity {
  id: string
  week_id: string
  name: string
  company: string | null
  seniority: Seniority | null
  opp_date: string | null
  applications: number
  presented: number
  confirmed: number
}

export interface SupplyContent {
  id: string
  week_id: string
  channel: Channel | null
  title: string | null
  views: number
  url: string | null
  content_date: string | null
  opportunityIds: string[] // oportunidades mostradas en esta pieza
}

export interface WeekFunnel {
  contents: number
  views: number
  applications: number
  presented: number
  confirmed: number
}

export interface SupplyWeekFull extends SupplyWeek {
  opportunities: SupplyOpportunity[]
  contents: SupplyContent[]
  funnel: WeekFunnel
}

// ─── Helpers de fecha ────────────────────────
// Devuelve el lunes (YYYY-MM-DD) de la semana de una fecha dada
export function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0 dom … 6 sab
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

export function weekLabel(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  const fmt = (d: Date) => `${d.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`
  return `${fmt(start)} – ${fmt(end)}`
}

function funnelOf(opps: SupplyOpportunity[], contents: SupplyContent[]): WeekFunnel {
  return {
    contents: contents.length,
    views: contents.reduce((a, c) => a + (c.views ?? 0), 0),
    applications: opps.reduce((a, o) => a + (o.applications ?? 0), 0),
    presented: opps.reduce((a, o) => a + (o.presented ?? 0), 0),
    confirmed: opps.reduce((a, o) => a + (o.confirmed ?? 0), 0),
  }
}

// ─── Lectura ─────────────────────────────────
export async function getWeeks(): Promise<SupplyWeekFull[]> {
  const [weeksRes, oppsRes, contentsRes, linksRes] = await Promise.all([
    supabase.from('supply_weeks').select('*').order('week_start', { ascending: true }),
    supabase.from('supply_opportunities').select('*').order('created_at', { ascending: true }),
    supabase.from('supply_contents').select('*').order('content_date', { ascending: true }),
    supabase.from('supply_content_opportunities').select('*'),
  ])

  const weeks = (weeksRes.data ?? []) as SupplyWeek[]
  const opps = (oppsRes.data ?? []) as SupplyOpportunity[]
  const linksByContent = new Map<string, string[]>()
  for (const l of (linksRes.data ?? []) as { content_id: string; opportunity_id: string }[]) {
    const arr = linksByContent.get(l.content_id) ?? []
    arr.push(l.opportunity_id)
    linksByContent.set(l.content_id, arr)
  }
  const contents = ((contentsRes.data ?? []) as Omit<SupplyContent, 'opportunityIds'>[]).map(c => ({
    ...c,
    opportunityIds: linksByContent.get(c.id) ?? [],
  })) as SupplyContent[]

  return weeks.map(w => {
    const weekOpps = opps.filter(o => o.week_id === w.id)
    const weekContents = contents.filter(c => c.week_id === w.id)
    return { ...w, opportunities: weekOpps, contents: weekContents, funnel: funnelOf(weekOpps, weekContents) }
  })
}

// ─── Escritura: semanas ──────────────────────
export async function ensureWeek(weekStart: string): Promise<SupplyWeek> {
  const monday = mondayOf(weekStart)
  const existing = await supabase.from('supply_weeks').select('*').eq('week_start', monday).maybeSingle()
  if (existing.data) return existing.data as SupplyWeek
  const { data } = await supabase.from('supply_weeks').insert({ week_start: monday }).select().single()
  return data as SupplyWeek
}

export async function updateInsights(weekId: string, insights: string) {
  return supabase.from('supply_weeks').update({ insights, updated_at: new Date().toISOString() }).eq('id', weekId)
}

export async function deleteWeek(weekId: string) {
  return supabase.from('supply_weeks').delete().eq('id', weekId)
}

// ─── Escritura: oportunidades ────────────────
export async function addOpportunity(o: Omit<SupplyOpportunity, 'id'>) {
  return supabase.from('supply_opportunities').insert(o).select().single()
}

export async function updateOpportunity(id: string, patch: Partial<SupplyOpportunity>) {
  return supabase.from('supply_opportunities').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteOpportunity(id: string) {
  return supabase.from('supply_opportunities').delete().eq('id', id)
}

// ─── Escritura: contenidos ───────────────────
export async function addContent(
  c: Omit<SupplyContent, 'id' | 'opportunityIds'>,
  opportunityIds: string[],
) {
  const { data, error } = await supabase.from('supply_contents').insert(c).select().single()
  if (error || !data) return { data, error }
  if (opportunityIds.length) {
    await supabase.from('supply_content_opportunities').insert(
      opportunityIds.map(opportunity_id => ({ content_id: data.id, opportunity_id })),
    )
  }
  return { data, error }
}

export async function updateContentLinks(contentId: string, opportunityIds: string[]) {
  await supabase.from('supply_content_opportunities').delete().eq('content_id', contentId)
  if (opportunityIds.length) {
    await supabase.from('supply_content_opportunities').insert(
      opportunityIds.map(opportunity_id => ({ content_id: contentId, opportunity_id })),
    )
  }
}

export async function deleteContent(id: string) {
  return supabase.from('supply_contents').delete().eq('id', id)
}
