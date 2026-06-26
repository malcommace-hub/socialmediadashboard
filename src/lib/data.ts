import { supabase } from "./supabase";
import type { Week, Opportunity, Content, Seniority, Channel } from "./types";

// ── Reads ─────────────────────────────────────────────────────────────

interface RawWeek {
  id: string;
  week_start: string;
  insights: string | null;
  opportunities: {
    id: string;
    week_id: string;
    role: string | null;
    company: string | null;
    seniority: string | null;
    applications: number | null;
    presented: number | null;
    confirmed: number | null;
    date: string | null;
  }[];
  contents: {
    id: string;
    week_id: string;
    channel: string | null;
    title: string | null;
    views: number | null;
    url: string | null;
    content_opportunities: { opportunity_id: string }[];
  }[];
}

/** Fetches every week with its opportunities, contents and m:n links, newest first. */
export async function fetchWeeks(): Promise<Week[]> {
  const { data, error } = await supabase
    .from("weeks")
    .select(
      `id, week_start, insights,
       opportunities ( id, week_id, role, company, seniority, applications, presented, confirmed, date ),
       contents ( id, week_id, channel, title, views, url, content_opportunities ( opportunity_id ) )`
    )
    .order("week_start", { ascending: false });

  if (error) throw error;

  return (data as RawWeek[]).map((w) => ({
    id: w.id,
    week_start: w.week_start,
    insights: w.insights ?? "",
    opportunities: (w.opportunities ?? [])
      .map((o) => ({
        id: o.id,
        week_id: o.week_id,
        role: o.role ?? "",
        company: o.company ?? "",
        seniority: (o.seniority as Seniority) ?? "Junior",
        applications: o.applications ?? 0,
        presented: o.presented ?? 0,
        confirmed: o.confirmed ?? 0,
        date: o.date,
      }))
      .sort((a, b) => a.role.localeCompare(b.role)),
    contents: (w.contents ?? []).map((c) => ({
      id: c.id,
      week_id: c.week_id,
      channel: (c.channel as Channel) ?? "LinkedIn",
      title: c.title ?? "",
      views: c.views ?? 0,
      url: c.url,
      opportunity_ids: (c.content_opportunities ?? []).map((l) => l.opportunity_id),
    })),
  }));
}

// ── Writes ────────────────────────────────────────────────────────────

/**
 * Persists a whole week (insights + full opportunity & content lists).
 * Entity ids are client-generated UUIDs, so we can upsert everything and
 * rebuild the m:n links deterministically. Rows removed in the UI are deleted.
 */
export async function saveWeek(
  weekStart: string,
  insights: string,
  opportunities: Opportunity[],
  contents: Content[]
): Promise<void> {
  // 1) Upsert the week itself (unique on week_start) and get its id.
  const { data: weekRow, error: weekErr } = await supabase
    .from("weeks")
    .upsert({ week_start: weekStart, insights }, { onConflict: "week_start" })
    .select("id")
    .single();
  if (weekErr) throw weekErr;
  const weekId = (weekRow as { id: string }).id;

  // 2) Delete opportunities & contents that were removed in the UI.
  const oppIds = opportunities.map((o) => o.id);
  const contentIds = contents.map((c) => c.id);

  const delOpps = supabase
    .from("opportunities")
    .delete()
    .eq("week_id", weekId)
    .not("id", "in", `(${oppIds.length ? oppIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  const delContents = supabase
    .from("contents")
    .delete()
    .eq("week_id", weekId)
    .not("id", "in", `(${contentIds.length ? contentIds.join(",") : "00000000-0000-0000-0000-000000000000"})`);
  const [{ error: e1 }, { error: e2 }] = await Promise.all([delOpps, delContents]);
  if (e1) throw e1;
  if (e2) throw e2;

  // 3) Upsert opportunities.
  if (opportunities.length) {
    const { error } = await supabase.from("opportunities").upsert(
      opportunities.map((o) => ({
        id: o.id,
        week_id: weekId,
        role: o.role,
        company: o.company,
        seniority: o.seniority,
        applications: o.applications,
        presented: o.presented,
        confirmed: o.confirmed,
        date: o.date,
      }))
    );
    if (error) throw error;
  }

  // 4) Upsert contents.
  if (contents.length) {
    const { error } = await supabase.from("contents").upsert(
      contents.map((c) => ({
        id: c.id,
        week_id: weekId,
        channel: c.channel,
        title: c.title,
        views: c.views,
        url: c.url,
      }))
    );
    if (error) throw error;
  }

  // 5) Rebuild m:n links: clear existing links for these contents, re-insert.
  if (contentIds.length) {
    const { error: clearErr } = await supabase
      .from("content_opportunities")
      .delete()
      .in("content_id", contentIds);
    if (clearErr) throw clearErr;
  }
  const links = contents.flatMap((c) =>
    c.opportunity_ids
      .filter((oid) => oppIds.includes(oid)) // guard against stale ids
      .map((oid) => ({ content_id: c.id, opportunity_id: oid }))
  );
  if (links.length) {
    const { error } = await supabase.from("content_opportunities").insert(links);
    if (error) throw error;
  }
}

/** Deletes a whole week (cascades to opportunities, contents and links). */
export async function deleteWeek(weekId: string): Promise<void> {
  const { error } = await supabase.from("weeks").delete().eq("id", weekId);
  if (error) throw error;
}
