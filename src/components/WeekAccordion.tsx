"use client";

import { useState } from "react";
import type { Week } from "@/lib/types";
import { computeFunnel } from "@/lib/types";
import { weekRangeLabel } from "@/lib/week";
import { SeniorityBadge, ChannelBadge, nf } from "./ui";

function FunnelPills({ week }: { week: Week }) {
  const f = computeFunnel(week);
  const pills = [
    { label: "Contenidos", value: f.contents },
    { label: "Views", value: f.views },
    { label: "Postulaciones", value: f.applications },
    { label: "Presentados", value: f.presented },
    { label: "Confirmados", value: f.confirmed },
  ];
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1">
      {pills.map((p) => (
        <div key={p.label} className="text-left">
          <div className="text-base font-bold tabular-nums">{nf(p.value)}</div>
          <div className="text-[10px] uppercase tracking-wide text-muted">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

function WeekRow({ week, defaultOpen }: { week: Week; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span
          className={[
            "grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-muted transition-transform",
            open ? "rotate-90" : "",
          ].join(" ")}
        >
          ›
        </span>
        <div className="w-40 shrink-0">
          <div className="text-sm font-semibold">{weekRangeLabel(week.week_start)}</div>
          <div className="text-[11px] text-muted">Semana del {week.week_start}</div>
        </div>
        <div className="min-w-0 flex-1">
          <FunnelPills week={week} />
        </div>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5">
          {/* Insights */}
          {week.insights?.trim() ? (
            <p className="mb-5 whitespace-pre-line rounded-xl bg-card-2 p-4 text-sm leading-relaxed text-white/85">
              {week.insights}
            </p>
          ) : (
            <p className="mb-5 text-sm italic text-muted">Sin insights para esta semana.</p>
          )}

          {/* Opportunities table */}
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Oportunidades ({week.opportunities.length})
          </h4>
          {week.opportunities.length ? (
            <div className="mb-6 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Rol</th>
                    <th className="py-2 pr-3 font-medium">Empresa</th>
                    <th className="py-2 pr-3 font-medium">Seniority</th>
                    <th className="py-2 pr-3 text-right font-medium">Postul.</th>
                    <th className="py-2 pr-3 text-right font-medium">Present.</th>
                    <th className="py-2 text-right font-medium">Confirm.</th>
                  </tr>
                </thead>
                <tbody>
                  {week.opportunities.map((o) => (
                    <tr key={o.id} className="border-t border-border/60">
                      <td className="py-2 pr-3 font-medium">{o.role || "—"}</td>
                      <td className="py-2 pr-3 text-white/80">{o.company || "—"}</td>
                      <td className="py-2 pr-3">
                        <SeniorityBadge value={o.seniority} />
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{nf(o.applications)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{nf(o.presented)}</td>
                      <td className="py-2 text-right tabular-nums text-accent">
                        {nf(o.confirmed)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-6 text-sm italic text-muted">Sin oportunidades.</p>
          )}

          {/* Content cards */}
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Contenidos ({week.contents.length})
          </h4>
          {week.contents.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {week.contents.map((c) => {
                const linked = week.opportunities.filter((o) =>
                  c.opportunity_ids.includes(o.id)
                );
                return (
                  <div
                    key={c.id}
                    className="flex flex-col rounded-xl border border-border bg-card-2 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <ChannelBadge value={c.channel} />
                      <span className="text-xs text-muted">{nf(c.views)} views</span>
                    </div>
                    <div className="mb-3 text-sm font-medium leading-snug">
                      {c.url ? (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-accent hover:underline"
                        >
                          {c.title || "Sin título"} ↗
                        </a>
                      ) : (
                        c.title || "Sin título"
                      )}
                    </div>
                    <div className="mt-auto">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted">
                        Oportunidades en el contenido
                      </div>
                      {linked.length ? (
                        <div className="flex flex-wrap gap-1">
                          {linked.map((o) => (
                            <span
                              key={o.id}
                              className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent"
                            >
                              {o.role}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] italic text-muted">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm italic text-muted">Sin contenidos.</p>
          )}
        </div>
      )}
    </div>
  );
}

export function WeekAccordion({ weeks }: { weeks: Week[] }) {
  return (
    <div className="flex flex-col gap-3">
      {weeks.map((w, i) => (
        <WeekRow key={w.id} week={w} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
