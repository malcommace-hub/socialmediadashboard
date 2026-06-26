'use client'
import { useState } from 'react'
import { ChevronDown, FileText, Eye, Send, UserCheck, CheckCircle2, ExternalLink, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/utils'
import { weekLabel, type SupplyWeekFull, type Seniority } from '@/lib/supply'

const seniorityStyles: Record<Seniority, string> = {
  Junior: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  'Semi-Senior': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Senior: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
}

const channelStyles: Record<string, string> = {
  LinkedIn: 'bg-blue-500/15 text-blue-300',
  Instagram: 'bg-pink-500/15 text-pink-300',
  TikTok: 'bg-white/10 text-gray-200',
}

function FunnelStat({ icon: Icon, value, label, accent }: { icon: React.ElementType; value: number; label: string; accent?: string }) {
  return (
    <div className="flex flex-col items-center min-w-[64px]">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={accent ?? 'text-gray-500'} />
        <span className="text-base font-bold text-white tabular-nums">{formatNumber(value)}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{label}</span>
    </div>
  )
}

export function WeekRow({ week, defaultOpen = false }: { week: SupplyWeekFull; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const f = week.funnel
  const oppById = new Map(week.opportunities.map(o => [o.id, o]))

  return (
    <div className="rounded-2xl bg-[#141929] border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors text-left"
      >
        <ChevronDown size={18} className={cn('text-gray-500 transition-transform shrink-0', open && 'rotate-180')} />
        <div className="min-w-[150px]">
          <div className="text-sm font-semibold text-white">{weekLabel(week.week_start)}</div>
          <div className="text-xs text-gray-500">{week.week_start}</div>
        </div>
        <div className="flex items-center gap-5 ml-auto flex-wrap justify-end">
          <FunnelStat icon={FileText} value={f.contents} label="Contenidos" />
          <FunnelStat icon={Eye} value={f.views} label="Views" accent="text-sky-400" />
          <FunnelStat icon={Send} value={f.applications} label="Postulac." accent="text-emerald-400" />
          <FunnelStat icon={UserCheck} value={f.presented} label="Present." />
          <FunnelStat icon={CheckCircle2} value={f.confirmed} label="Confirm." accent="text-emerald-400" />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-white/5 space-y-5">
          {week.insights && (
            <div className="flex gap-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 p-3.5 mt-4">
              <Lightbulb size={15} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{week.insights}</p>
            </div>
          )}

          {/* Oportunidades */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2 mt-3">Oportunidades ({week.opportunities.length})</h4>
            {week.opportunities.length === 0 ? (
              <p className="text-sm text-gray-600">Sin oportunidades cargadas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 text-xs">
                      <th className="py-1.5 pr-3 font-medium">Búsqueda</th>
                      <th className="py-1.5 pr-3 font-medium">Empresa</th>
                      <th className="py-1.5 pr-3 font-medium">Seniority</th>
                      <th className="py-1.5 px-3 font-medium text-right">Postulac.</th>
                      <th className="py-1.5 px-3 font-medium text-right">Present.</th>
                      <th className="py-1.5 pl-3 font-medium text-right">Confirm.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.opportunities.map(o => (
                      <tr key={o.id} className="border-t border-white/5">
                        <td className="py-2 pr-3 text-white font-medium">{o.name}</td>
                        <td className="py-2 pr-3 text-gray-400">{o.company ?? '—'}</td>
                        <td className="py-2 pr-3">
                          {o.seniority ? (
                            <span className={cn('text-[11px] px-2 py-0.5 rounded-full border', seniorityStyles[o.seniority])}>{o.seniority}</span>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-200 tabular-nums">{o.applications}</td>
                        <td className="py-2 px-3 text-right text-gray-200 tabular-nums">{o.presented}</td>
                        <td className="py-2 pl-3 text-right tabular-nums font-semibold text-emerald-400">{o.confirmed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Contenidos */}
          <div>
            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">Contenidos ({week.contents.length})</h4>
            {week.contents.length === 0 ? (
              <p className="text-sm text-gray-600">Sin contenidos cargados.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {week.contents.map(c => {
                  const linked = c.opportunityIds.map(id => oppById.get(id)?.name).filter(Boolean)
                  return (
                    <div key={c.id} className="rounded-xl bg-[#0A0E1A] border border-white/5 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        {c.channel && <span className={cn('text-[11px] px-2 py-0.5 rounded-full', channelStyles[c.channel])}>{c.channel}</span>}
                        <span className="ml-auto flex items-center gap-1 text-sm text-sky-300 tabular-nums">
                          <Eye size={12} /> {formatNumber(c.views)}
                        </span>
                      </div>
                      <div className="text-sm text-white flex items-center gap-1.5">
                        {c.title ?? 'Sin título'}
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-emerald-400">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      {linked.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1.5">
                          Oportunidades: <span className="text-gray-400">{linked.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
