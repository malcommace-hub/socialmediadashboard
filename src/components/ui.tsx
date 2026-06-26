import type { Seniority, Channel } from "@/lib/types";

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={[
          "mt-2 text-3xl font-bold tabular-nums",
          accent ? "text-accent" : "text-white",
        ].join(" ")}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const SENIORITY_STYLES: Record<Seniority, string> = {
  Junior: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  "Semi-Senior": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Senior: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

export function SeniorityBadge({ value }: { value: Seniority }) {
  return (
    <span
      className={[
        "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        SENIORITY_STYLES[value] ?? SENIORITY_STYLES.Junior,
      ].join(" ")}
    >
      {value}
    </span>
  );
}

const CHANNEL_STYLES: Record<Channel, string> = {
  LinkedIn: "bg-[#0a66c2]/20 text-[#4ea3ff] border-[#0a66c2]/40",
  Instagram: "bg-[#e1306c]/15 text-[#ff7eb0] border-[#e1306c]/40",
  TikTok: "bg-white/10 text-white border-white/25",
};

export function ChannelBadge({ value }: { value: Channel }) {
  return (
    <span
      className={[
        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        CHANNEL_STYLES[value] ?? CHANNEL_STYLES.LinkedIn,
      ].join(" ")}
    >
      {value}
    </span>
  );
}

export function ConfigNotice() {
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-sm text-amber-200">
      <p className="font-semibold">Falta configurar Supabase</p>
      <p className="mt-1 text-amber-200/80">
        Definí las variables de entorno{" "}
        <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
        <code className="rounded bg-black/30 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
        (localmente en <code className="rounded bg-black/30 px-1">.env.local</code> y
        en Vercel) y recargá la página.
      </p>
    </div>
  );
}

export function nf(n: number): string {
  return new Intl.NumberFormat("es-AR").format(n);
}
