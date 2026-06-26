"use client";

import { useEffect, useRef } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { nf } from "./ui";

export interface ChartDatum {
  label: string;
  views: number;
  applications: number;
}

const VISIBLE_WEEKS = 8;
const PX_PER_WEEK = 92;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-white">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-muted">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}: <span className="font-semibold text-white">{nf(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function WeekChart({ data }: { data: ChartDatum[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default to showing the most recent weeks (scroll to the right edge).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [data.length]);

  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-2xl border border-border bg-card text-sm text-muted">
        Todavía no hay semanas cargadas.
      </div>
    );
  }

  const innerWidth = Math.max(data.length * PX_PER_WEEK, VISIBLE_WEEKS * PX_PER_WEEK);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Views vs. Postulaciones por semana</h3>
        <span className="text-[11px] text-muted">Deslizá ↔ para ver más semanas</span>
      </div>
      <div ref={scrollRef} className="scroll-slim overflow-x-auto pb-2">
        <div style={{ width: innerWidth, height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#232a40" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8a93a8", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#232a40" }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#8a93a8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#8a93a8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar
                yAxisId="right"
                dataKey="applications"
                name="Postulaciones"
                fill="#2ecc71"
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="views"
                name="Views"
                stroke="#7aa2ff"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#7aa2ff" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
