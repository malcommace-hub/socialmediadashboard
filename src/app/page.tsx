"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWeeks } from "@/lib/data";
import { computeFunnel, type Week } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase";
import { weekShortLabel } from "@/lib/week";
import { StatCard, ConfigNotice, nf } from "@/components/ui";
import { WeekChart, type ChartDatum } from "@/components/WeekChart";
import { WeekAccordion } from "@/components/WeekAccordion";

export default function FunnelPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchWeeks()
      .then(setWeeks)
      .catch((e) => setError(e.message ?? "Error al cargar datos"))
      .finally(() => setLoading(false));
  }, []);

  // Global accumulated totals.
  const totals = useMemo(() => {
    return weeks.reduce(
      (acc, w) => {
        const f = computeFunnel(w);
        acc.contents += f.contents;
        acc.views += f.views;
        acc.applications += f.applications;
        acc.presented += f.presented;
        acc.confirmed += f.confirmed;
        return acc;
      },
      { contents: 0, views: 0, applications: 0, presented: 0, confirmed: 0 }
    );
  }, [weeks]);

  const conversion =
    totals.applications > 0
      ? ((totals.confirmed / totals.applications) * 100).toFixed(1) + "%"
      : "—";

  // Chart wants oldest → newest (weeks arrive newest first).
  const chartData: ChartDatum[] = useMemo(
    () =>
      [...weeks].reverse().map((w) => {
        const f = computeFunnel(w);
        return {
          label: weekShortLabel(w.week_start),
          views: f.views,
          applications: f.applications,
        };
      }),
    [weeks]
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
      <header className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">Funnel semanal</h1>
        <p className="mt-1 text-sm text-muted">
          Generación de talento calificado · Marketing × Attraction
        </p>
      </header>

      {!isSupabaseConfigured ? (
        <ConfigNotice />
      ) : loading ? (
        <div className="grid h-64 place-items-center text-sm text-muted">Cargando…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-sm text-red-200">
          {error}
        </div>
      ) : (
        <>
          {/* Accumulated metric cards */}
          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Contenidos" value={nf(totals.contents)} />
            <StatCard label="Views" value={nf(totals.views)} />
            <StatCard label="Postulaciones" value={nf(totals.applications)} />
            <StatCard label="Presentados" value={nf(totals.presented)} />
            <StatCard label="Confirmados" value={nf(totals.confirmed)} accent />
            <StatCard
              label="Conversión"
              value={conversion}
              hint="confirmados / postulaciones"
              accent
            />
          </section>

          {/* Combined chart */}
          <section className="mb-8">
            <WeekChart data={chartData} />
          </section>

          {/* Weekly accordion */}
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              Semanas
            </h2>
            {weeks.length ? (
              <WeekAccordion weeks={weeks} />
            ) : (
              <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted">
                Todavía no cargaste ninguna semana. Andá a{" "}
                <a href="/cargar" className="text-accent hover:underline">
                  Cargar datos
                </a>{" "}
                para empezar.
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
