'use client'
import { useEffect, useState } from 'react'
import { Eye, Send, UserCheck, CheckCircle2, FileText, TrendingUp, Loader2 } from 'lucide-react'
import { getWeeks, weekLabel, type SupplyWeekFull } from '@/lib/supply'
import { formatNumber, formatPercent } from '@/lib/utils'
import { FunnelChart, type ChartPoint } from '@/components/supply/FunnelChart'
import { WeekRow } from '@/components/supply/WeekRow'

function GlobalStat({ icon: Icon, value, label, accent }: { icon: React.ElementType; value: string; label: string; accent: string }) {
  return (
    <div className="rounded-2xl bg-[#141929] border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon size={15} />
        </div>
        <span className="text-xs uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
    </div>
  )
}

export default function SupplyOverview() {
  const [weeks, setWeeks] = useState<SupplyWeekFull[] | null>(null)

  useEffect(() => {
    getWeeks().then(setWeeks)
  }, [])

  if (!weeks) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  const totals = weeks.reduce(
    (a, w) => ({
      contents: a.contents + w.funnel.contents,
      views: a.views + w.funnel.views,
      applications: a.applications + w.funnel.applications,
      presented: a.presented + w.funnel.presented,
      confirmed: a.confirmed + w.funnel.confirmed,
    }),
    { contents: 0, views: 0, applications: 0, presented: 0, confirmed: 0 },
  )
  const convRate = totals.applications ? (totals.confirmed / totals.applications) * 100 : 0

  // Gráfico: cronológico (viejo → nuevo)
  const chartData: ChartPoint[] = weeks.map(w => ({
    label: weekLabel(w.week_start).split(' – ')[0],
    views: w.funnel.views,
    applications: w.funnel.applications,
  }))

  // Acordeón: más reciente primero
  const recent = [...weeks].reverse()

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Funnel semanal</h1>
        <p className="text-gray-500 text-sm mt-1">
          Generación de talento calificado · Data, Tech &amp; IA · {weeks.length} {weeks.length === 1 ? 'semana' : 'semanas'} cargadas
        </p>
      </header>

      {weeks.length === 0 ? (
        <div className="rounded-2xl bg-[#141929] border border-white/5 p-10 text-center">
          <p className="text-gray-400">Todavía no hay datos cargados.</p>
          <a href="/supply/cargar" className="inline-block mt-3 text-emerald-400 hover:text-emerald-300 text-sm font-medium">
            Cargar la primera semana →
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <GlobalStat icon={FileText} label="Contenidos" value={formatNumber(totals.contents)} accent="bg-gray-500/15 text-gray-300" />
            <GlobalStat icon={Eye} label="Views" value={formatNumber(totals.views)} accent="bg-sky-500/15 text-sky-300" />
            <GlobalStat icon={Send} label="Postulaciones" value={formatNumber(totals.applications)} accent="bg-emerald-500/15 text-emerald-300" />
            <GlobalStat icon={UserCheck} label="Presentados" value={formatNumber(totals.presented)} accent="bg-violet-500/15 text-violet-300" />
            <GlobalStat icon={CheckCircle2} label="Confirmados" value={formatNumber(totals.confirmed)} accent="bg-emerald-500/15 text-emerald-300" />
            <GlobalStat icon={TrendingUp} label="Conv. postul→conf" value={formatPercent(convRate)} accent="bg-amber-500/15 text-amber-300" />
          </div>

          <div className="rounded-2xl bg-[#141929] border border-white/5 p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Views vs. postulaciones por semana</h2>
              <span className="text-xs text-gray-500">scrolleá ← → para ver más semanas</span>
            </div>
            <FunnelChart data={chartData} />
          </div>

          <div className="space-y-3">
            {recent.map((w, i) => (
              <WeekRow key={w.id} week={w} defaultOpen={i === 0} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
