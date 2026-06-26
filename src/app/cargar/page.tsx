"use client";

import { useEffect, useState } from "react";
import { fetchWeeks, saveWeek, deleteWeek } from "@/lib/data";
import {
  CHANNELS,
  SENIORITIES,
  type Week,
  type Opportunity,
  type Content,
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase";
import { mondayOfISO, weekRangeLabel, todayISO } from "@/lib/week";
import { ConfigNotice } from "@/components/ui";

function newId(): string {
  return crypto.randomUUID();
}

const inputCls =
  "w-full rounded-lg border border-border bg-card-2 px-3 py-2 text-sm text-white placeholder:text-muted focus:border-accent focus:outline-none";
const labelCls = "mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted";

export default function CargarPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  // Currently edited week.
  const [weekStart, setWeekStart] = useState<string>("");
  const [insights, setInsights] = useState("");
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [contents, setContents] = useState<Content[]>([]);

  const [datePick, setDatePick] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function reload() {
    const data = await fetchWeeks();
    setWeeks(data);
    return data;
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchWeeks()
      .then(setWeeks)
      .catch((e) => setToast({ kind: "err", msg: e.message ?? "Error al cargar" }))
      .finally(() => setLoading(false));
  }, []);

  function loadWeek(w: Week) {
    setWeekStart(w.week_start);
    setInsights(w.insights);
    setOpportunities(w.opportunities.map((o) => ({ ...o })));
    setContents(w.contents.map((c) => ({ ...c, opportunity_ids: [...c.opportunity_ids] })));
  }

  function startBlank(monday: string) {
    setWeekStart(monday);
    setInsights("");
    setOpportunities([]);
    setContents([]);
  }

  function onSelectExisting(weekId: string) {
    const w = weeks.find((x) => x.id === weekId);
    if (w) loadWeek(w);
  }

  function onPickDate(iso: string) {
    setDatePick(iso);
    const monday = mondayOfISO(iso);
    const existing = weeks.find((w) => w.week_start === monday);
    if (existing) loadWeek(existing);
    else startBlank(monday);
  }

  // ── Opportunity editing ──────────────────────────────────────────
  function addOpportunity() {
    setOpportunities((prev) => [
      ...prev,
      {
        id: newId(),
        week_id: "",
        role: "",
        company: "",
        seniority: "Junior",
        applications: 0,
        presented: 0,
        confirmed: 0,
        date: null,
      },
    ]);
  }
  function updateOpportunity(id: string, patch: Partial<Opportunity>) {
    setOpportunities((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function removeOpportunity(id: string) {
    setOpportunities((prev) => prev.filter((o) => o.id !== id));
    // also unlink from any content
    setContents((prev) =>
      prev.map((c) => ({ ...c, opportunity_ids: c.opportunity_ids.filter((x) => x !== id) }))
    );
  }

  // ── Content editing ──────────────────────────────────────────────
  function addContent() {
    setContents((prev) => [
      ...prev,
      {
        id: newId(),
        week_id: "",
        channel: "LinkedIn",
        title: "",
        views: 0,
        url: null,
        opportunity_ids: [],
      },
    ]);
  }
  function updateContent(id: string, patch: Partial<Content>) {
    setContents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }
  function removeContent(id: string) {
    setContents((prev) => prev.filter((c) => c.id !== id));
  }
  function toggleLink(contentId: string, oppId: string) {
    setContents((prev) =>
      prev.map((c) => {
        if (c.id !== contentId) return c;
        const has = c.opportunity_ids.includes(oppId);
        return {
          ...c,
          opportunity_ids: has
            ? c.opportunity_ids.filter((x) => x !== oppId)
            : [...c.opportunity_ids, oppId],
        };
      })
    );
  }

  async function onSave() {
    if (!weekStart) {
      setToast({ kind: "err", msg: "Elegí o creá una semana primero." });
      return;
    }
    setSaving(true);
    setToast(null);
    try {
      await saveWeek(weekStart, insights, opportunities, contents);
      const data = await reload();
      const fresh = data.find((w) => w.week_start === weekStart);
      if (fresh) loadWeek(fresh);
      setToast({ kind: "ok", msg: "Guardado correctamente." });
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message ?? "Error al guardar" });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    const w = weeks.find((x) => x.week_start === weekStart);
    if (!w) return;
    if (!confirm(`¿Eliminar la semana ${weekRangeLabel(w.week_start)} y todos sus datos?`)) return;
    setSaving(true);
    try {
      await deleteWeek(w.id);
      await reload();
      setWeekStart("");
      setInsights("");
      setOpportunities([]);
      setContents([]);
      setToast({ kind: "ok", msg: "Semana eliminada." });
    } catch (e) {
      setToast({ kind: "err", msg: (e as Error).message ?? "Error al eliminar" });
    } finally {
      setSaving(false);
    }
  }

  const isExisting = weeks.some((w) => w.week_start === weekStart);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
      <header className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight">Cargar datos</h1>
        <p className="mt-1 text-sm text-muted">
          Carga manual semana por semana. El funnel se calcula solo a partir de este detalle.
        </p>
      </header>

      {!isSupabaseConfigured ? (
        <ConfigNotice />
      ) : loading ? (
        <div className="grid h-64 place-items-center text-sm text-muted">Cargando…</div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Week selector */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              Semana
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Elegir semana existente</label>
                <select
                  className={inputCls}
                  value={weeks.find((w) => w.week_start === weekStart)?.id ?? ""}
                  onChange={(e) => onSelectExisting(e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {weekRangeLabel(w.week_start)} ({w.week_start})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>O crear/abrir por fecha</label>
                <input
                  type="date"
                  className={inputCls}
                  value={datePick}
                  onChange={(e) => onPickDate(e.target.value)}
                />
              </div>
            </div>
            {weekStart && (
              <p className="mt-3 text-sm text-accent">
                Editando la semana <strong>{weekRangeLabel(weekStart)}</strong> (lunes {weekStart})
                {isExisting ? " · existente" : " · nueva"}
              </p>
            )}
          </section>

          {weekStart && (
            <>
              {/* Insights */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
                  Insights de la semana
                </h2>
                <textarea
                  className={`${inputCls} min-h-[96px] resize-y`}
                  placeholder="Ej: esta semana no hubo oportunidades buenas, por eso menos postulaciones…"
                  value={insights}
                  onChange={(e) => setInsights(e.target.value)}
                />
              </section>

              {/* Opportunities */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Oportunidades ({opportunities.length})
                  </h2>
                  <button
                    onClick={addOpportunity}
                    className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25"
                  >
                    + Agregar
                  </button>
                </div>

                {opportunities.length === 0 && (
                  <p className="text-sm italic text-muted">Sin oportunidades. Agregá una.</p>
                )}

                <div className="flex flex-col gap-4">
                  {opportunities.map((o, i) => (
                    <div key={o.id} className="rounded-xl border border-border bg-card-2 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted">#{i + 1}</span>
                        <button
                          onClick={() => removeOpportunity(o.id)}
                          className="text-xs text-red-300 hover:text-red-200"
                        >
                          Eliminar
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Rol</label>
                          <input
                            className={inputCls}
                            value={o.role}
                            onChange={(e) => updateOpportunity(o.id, { role: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Empresa</label>
                          <input
                            className={inputCls}
                            value={o.company}
                            onChange={(e) => updateOpportunity(o.id, { company: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Seniority</label>
                          <select
                            className={inputCls}
                            value={o.seniority}
                            onChange={(e) =>
                              updateOpportunity(o.id, { seniority: e.target.value as Opportunity["seniority"] })
                            }
                          >
                            {SENIORITIES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Fecha (opcional)</label>
                          <input
                            type="date"
                            className={inputCls}
                            value={o.date ?? ""}
                            onChange={(e) =>
                              updateOpportunity(o.id, { date: e.target.value || null })
                            }
                          />
                        </div>
                        <div>
                          <label className={labelCls}>Postulaciones</label>
                          <input
                            type="number"
                            min={0}
                            className={inputCls}
                            value={o.applications}
                            onChange={(e) =>
                              updateOpportunity(o.id, { applications: Number(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Presentados</label>
                            <input
                              type="number"
                              min={0}
                              className={inputCls}
                              value={o.presented}
                              onChange={(e) =>
                                updateOpportunity(o.id, { presented: Number(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Confirmados</label>
                            <input
                              type="number"
                              min={0}
                              className={inputCls}
                              value={o.confirmed}
                              onChange={(e) =>
                                updateOpportunity(o.id, { confirmed: Number(e.target.value) || 0 })
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Contents */}
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                    Contenidos ({contents.length})
                  </h2>
                  <button
                    onClick={addContent}
                    className="rounded-lg bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/25"
                  >
                    + Agregar
                  </button>
                </div>

                {contents.length === 0 && (
                  <p className="text-sm italic text-muted">Sin contenidos. Agregá uno.</p>
                )}

                <div className="flex flex-col gap-4">
                  {contents.map((c, i) => (
                    <div key={c.id} className="rounded-xl border border-border bg-card-2 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted">#{i + 1}</span>
                        <button
                          onClick={() => removeContent(c.id)}
                          className="text-xs text-red-300 hover:text-red-200"
                        >
                          Eliminar
                        </button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className={labelCls}>Canal</label>
                          <select
                            className={inputCls}
                            value={c.channel}
                            onChange={(e) =>
                              updateContent(c.id, { channel: e.target.value as Content["channel"] })
                            }
                          >
                            {CHANNELS.map((ch) => (
                              <option key={ch} value={ch}>
                                {ch}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Views</label>
                          <input
                            type="number"
                            min={0}
                            className={inputCls}
                            value={c.views}
                            onChange={(e) =>
                              updateContent(c.id, { views: Number(e.target.value) || 0 })
                            }
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Título</label>
                          <input
                            className={inputCls}
                            value={c.title}
                            onChange={(e) => updateContent(c.id, { title: e.target.value })}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>URL (opcional)</label>
                          <input
                            className={inputCls}
                            placeholder="https://…"
                            value={c.url ?? ""}
                            onChange={(e) => updateContent(c.id, { url: e.target.value || null })}
                          />
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className={labelCls}>¿Qué oportunidades aparecieron?</label>
                        {opportunities.length === 0 ? (
                          <p className="text-xs italic text-muted">
                            Agregá oportunidades arriba para poder vincularlas.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {opportunities.map((o) => {
                              const checked = c.opportunity_ids.includes(o.id);
                              return (
                                <label
                                  key={o.id}
                                  className={[
                                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
                                    checked
                                      ? "border-accent/50 bg-accent/15 text-accent"
                                      : "border-border bg-card text-white/80 hover:border-white/20",
                                  ].join(" ")}
                                >
                                  <input
                                    type="checkbox"
                                    className="accent-accent"
                                    checked={checked}
                                    onChange={() => toggleLink(c.id, o.id)}
                                  />
                                  {o.role || "(sin rol)"}{" "}
                                  <span className="text-muted">· {o.company || "—"}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Actions */}
              <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur">
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-[#06210f] hover:bg-accent/90 disabled:opacity-50"
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
                {isExisting && (
                  <button
                    onClick={onDelete}
                    disabled={saving}
                    className="rounded-lg border border-red-500/40 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Eliminar semana
                  </button>
                )}
                {toast && (
                  <span
                    className={[
                      "text-sm",
                      toast.kind === "ok" ? "text-accent" : "text-red-300",
                    ].join(" ")}
                  >
                    {toast.msg}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
