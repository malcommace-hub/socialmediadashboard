// ── Domain types for the Supply Generation dashboard ──────────────────

export type Channel = "LinkedIn" | "Instagram" | "TikTok";
export const CHANNELS: Channel[] = ["LinkedIn", "Instagram", "TikTok"];

export type Seniority = "Junior" | "Semi-Senior" | "Senior";
export const SENIORITIES: Seniority[] = ["Junior", "Semi-Senior", "Senior"];

export interface Opportunity {
  id: string;
  week_id: string;
  role: string;
  company: string;
  seniority: Seniority;
  applications: number; // postulaciones
  presented: number; // candidatos presentados
  confirmed: number; // candidatos confirmados
  date: string | null; // optional ISO date
}

export interface Content {
  id: string;
  week_id: string;
  channel: Channel;
  title: string;
  views: number;
  url: string | null;
  // ids of the opportunities that appeared in this content (m:n)
  opportunity_ids: string[];
}

export interface Week {
  id: string;
  week_start: string; // ISO date of the Monday for this week
  insights: string;
  opportunities: Opportunity[];
  contents: Content[];
}

// Aggregated funnel for a single week (computed, never stored).
export interface WeekFunnel {
  contents: number;
  views: number;
  applications: number;
  presented: number;
  confirmed: number;
}

export function computeFunnel(week: Week): WeekFunnel {
  return {
    contents: week.contents.length,
    views: week.contents.reduce((s, c) => s + (c.views || 0), 0),
    applications: week.opportunities.reduce((s, o) => s + (o.applications || 0), 0),
    presented: week.opportunities.reduce((s, o) => s + (o.presented || 0), 0),
    confirmed: week.opportunities.reduce((s, o) => s + (o.confirmed || 0), 0),
  };
}
