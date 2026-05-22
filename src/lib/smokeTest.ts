import { supabase } from './supabase'

export type CheckStatus = 'ok' | 'warn' | 'fail'

export interface SmokeCheck {
  name: string
  status: CheckStatus
  message?: string
  rowCount?: number
}

async function countRows(table: string): Promise<{ count: number | null; error: string | null }> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
  if (error) return { count: null, error: error.message }
  return { count: count ?? null, error: null }
}

const TABLES: Array<{ table: string; label: string; warnIfEmpty: boolean }> = [
  { table: 'instagram_monthly',   label: 'instagram_monthly',   warnIfEmpty: true  },
  { table: 'instagram_posts',     label: 'instagram_posts',     warnIfEmpty: true  },
  { table: 'linkedin_monthly',    label: 'linkedin_monthly',    warnIfEmpty: true  },
  { table: 'linkedin_posts',      label: 'linkedin_posts',      warnIfEmpty: true  },
  { table: 'tiktok_monthly',      label: 'tiktok_monthly',      warnIfEmpty: true  },
  { table: 'youtube_monthly',     label: 'youtube_monthly',     warnIfEmpty: false },
  { table: 'newsletter_monthly',  label: 'newsletter_monthly',  warnIfEmpty: false },
  { table: 'newsletter_episodes', label: 'newsletter_episodes', warnIfEmpty: false },
  { table: 'web_monthly',         label: 'web_monthly',         warnIfEmpty: false },
  { table: 'web_utm_sources',     label: 'web_utm_sources',     warnIfEmpty: false },
  { table: 'objectives',          label: 'objectives',          warnIfEmpty: false },
  { table: 'monthly_notes',       label: 'monthly_notes',       warnIfEmpty: false },
  { table: 'featured_content',    label: 'featured_content',    warnIfEmpty: false },
]

export async function runSmokeTest(): Promise<SmokeCheck[]> {
  const settled = await Promise.allSettled(
    TABLES.map(t => countRows(t.table).then(r => ({ ...t, ...r })))
  )

  return settled.map((r, i) => {
    const def = TABLES[i]
    if (r.status === 'rejected') {
      return { name: def.label, status: 'fail' as CheckStatus, message: String(r.reason) }
    }
    const { label, count, error, warnIfEmpty } = r.value
    if (error) {
      return { name: label, status: 'fail' as CheckStatus, message: error }
    }
    if (count === 0 && warnIfEmpty) {
      return { name: label, status: 'warn' as CheckStatus, message: 'tabla vacía', rowCount: 0 }
    }
    return { name: label, status: 'ok' as CheckStatus, rowCount: count ?? undefined }
  })
}
