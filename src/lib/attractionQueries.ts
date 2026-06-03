import { supabase } from './supabase'

export type AttractionWeek = {
  id: string
  week_date: string
  notes: string | null
  careersite_registrations: number
  created_at: string
}

export type AttractionOpportunity = {
  id: string
  week_id: string
  title: string
  company: string | null
  status: 'active' | 'cancelled'
  applications: number
  candidates_presented: number
  created_at: string
}

export type AttractionVideo = {
  id: string
  week_id: string
  type: 'general' | 'specific'
  title: string | null
  views: number
  opportunity_id: string | null
  created_at: string
}

export async function getAttractionWeeks(): Promise<AttractionWeek[]> {
  const { data } = await supabase
    .from('attraction_weeks')
    .select('*')
    .order('week_date', { ascending: false })
  return (data ?? []) as AttractionWeek[]
}

export async function getAttractionWeekData(weekId: string): Promise<{
  opportunities: AttractionOpportunity[]
  videos: AttractionVideo[]
}> {
  const [opps, vids] = await Promise.all([
    supabase.from('attraction_opportunities').select('*').eq('week_id', weekId).order('created_at'),
    supabase.from('attraction_videos').select('*').eq('week_id', weekId).order('created_at'),
  ])
  return {
    opportunities: (opps.data ?? []) as AttractionOpportunity[],
    videos: (vids.data ?? []) as AttractionVideo[],
  }
}

export async function createAttractionWeek(week_date: string, notes?: string | null): Promise<{ data: AttractionWeek | null; error: string | null }> {
  const { data, error } = await supabase
    .from('attraction_weeks')
    .insert({ week_date, notes: notes ?? null })
    .select()
    .single()
  return { data: data as AttractionWeek | null, error: error ? error.message : null }
}

export async function updateAttractionWeek(
  id: string,
  updates: Partial<Pick<AttractionWeek, 'notes' | 'careersite_registrations'>>
) {
  return supabase.from('attraction_weeks').update(updates).eq('id', id).select().single()
}

export async function deleteAttractionWeek(id: string) {
  return supabase.from('attraction_weeks').delete().eq('id', id)
}

export async function addAttractionOpportunity(input: {
  week_id: string; title: string; company?: string | null
}): Promise<AttractionOpportunity | null> {
  const { data } = await supabase
    .from('attraction_opportunities')
    .insert({ week_id: input.week_id, title: input.title, company: input.company ?? null, status: 'active', applications: 0, candidates_presented: 0 })
    .select()
    .single()
  return data as AttractionOpportunity | null
}

export async function updateAttractionOpportunity(
  id: string,
  updates: Partial<Pick<AttractionOpportunity, 'title' | 'company' | 'status' | 'applications' | 'candidates_presented'>>
) {
  return supabase.from('attraction_opportunities').update(updates).eq('id', id).select().single()
}

export async function deleteAttractionOpportunity(id: string) {
  return supabase.from('attraction_opportunities').delete().eq('id', id)
}

export async function addAttractionVideo(input: {
  week_id: string; type: 'general' | 'specific'
  title?: string | null; views: number; opportunity_id?: string | null
}): Promise<AttractionVideo | null> {
  const { data } = await supabase
    .from('attraction_videos')
    .insert({ week_id: input.week_id, type: input.type, title: input.title ?? null, views: input.views, opportunity_id: input.opportunity_id ?? null })
    .select()
    .single()
  return data as AttractionVideo | null
}

export async function updateAttractionVideo(
  id: string,
  updates: Partial<Pick<AttractionVideo, 'title' | 'views' | 'type' | 'opportunity_id'>>
) {
  return supabase.from('attraction_videos').update(updates).eq('id', id).select().single()
}

export async function deleteAttractionVideo(id: string) {
  return supabase.from('attraction_videos').delete().eq('id', id)
}
