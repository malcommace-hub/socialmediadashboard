"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  {
    href: "/",
    label: "Funnel semanal",
    icon: (
      <path d="M3 4h18M6 9h12M9 14h6M11 19h2" strokeLinecap="round" />
    ),
  },
  {
    href: "/cargar",
    label: "Cargar datos",
    icon: (
      <>
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card/60 px-4 py-6">
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-lg">
          🌱
        </span>
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight">Supply Generation</div>
          <div className="text-[11px] text-muted">Seeds · interno</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/15 text-accent"
                  : "text-muted hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 text-[11px] leading-relaxed text-muted">
        Marketing × Attraction
        <br />
        Flujo constante de talento
      </div>
    </aside>
  );
}
