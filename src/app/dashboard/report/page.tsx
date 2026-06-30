'use client'
import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import {
  getOverviewHistory, getInstagramCollabComparison, getContentPerformanceComparison,
} from '@/lib/queries'
import { formatNumber, formatPercent, MONTH_NAMES } from '@/lib/utils'
import { FileText, Printer, PencilLine, Check, TrendingUp, Megaphone } from 'lucide-react'

type HistoryPoint = Awaited<ReturnType<typeof getOverviewHistory>>[0]
type CollabComparison = Awaited<ReturnType<typeof getInstagramCollabComparison>>
type ContentComparison = Awaited<ReturnType<typeof getContentPerformanceComparison>>

// ─── Aggregation ──────────────────────────────
function aggregate(points: HistoryPoint[]) {
  const sum = (f: (p: HistoryPoint) => number) => points.reduce((a, p) => a + f(p), 0)
  const last = points[points.length - 1]
  const avgNonZero = (f: (p: HistoryPoint) => number) => {
    const v = points.map(f).filter(x => x > 0)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0
  }
  return {
    months: points.length,
    igViews: sum(p => p.igImpressions),
    igInteractions: sum(p => p.igInteractions),
    igNewFollowers: sum(p => p.igNewFollowers),
    igEndFollowers: last?.igTotalFollowers ?? 0,
    igER: avgNonZero(p => p.igER),
    igPosts: sum(p => p.igPostCount),
    liImpressions: sum(p => p.liImpressions),
    liInteractions: sum(p => p.liInteractions),
    liNewFollowers: sum(p => p.liNewFollowers),
    liEndFollowers: last?.liTotalFollowers ?? 0,
    liER: avgNonZero(p => p.liER),
    liPosts: sum(p => p.liPostCount),
    ttViews: sum(p => p.ttViews),
    ttInteractions: sum(p => p.ttInteractions),
    ttNewFollowers: sum(p => p.ttNewFollowers),
    ttEndFollowers: last?.ttTotalFollowers ?? 0,
    ytViews: sum(p => p.ytViews),
    nlViews: sum(p => p.newsletterViews),
  }
}
type Agg = ReturnType<typeof aggregate>

function yoyText(cur: number, prev: number | null | undefined, prevYear: number): { sub: string | null; color: string } {
  if (prev == null || prev === 0) return { sub: null, color: '' }
  const c = ((cur - prev) / prev) * 100
  return { sub: `${c >= 0 ? '+' : ''}${c.toFixed(0)}% vs H1 ${prevYear}`, color: c >= 0 ? 'text-emerald-600' : 'text-red-500' }
}

// ─── Editable, persisted text block ───────────
function EditableBlock({
  id, title, placeholder, defaultText = '', accent = 'border-gray-200',
}: { id: string; title: string; placeholder: string; defaultText?: string; accent?: string }) {
  const storageKey = `seeds_report_h1_${id}`
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    try {
      const s = localStorage.getItem(storageKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate persisted text post-mount to avoid SSR mismatch
      setText(s != null ? s : defaultText)
    } catch { setText(defaultText) }
  }, [storageKey, defaultText])

  function save(v: string) {
    setText(v)
    try { localStorage.setItem(storageKey, v) } catch { /* ignore */ }
  }

  return (
    <div className={`border-l-2 ${accent} pl-3`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{title}</div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-gray-300 hover:text-gray-600 print:hidden"
          title={editing ? 'Listo' : 'Editar'}
        >
          {editing ? <Check size={13} /> : <PencilLine size={12} />}
        </button>
      </div>
      {editing ? (
        <textarea
          value={text}
          onChange={e => save(e.target.value)}
          rows={4}
          placeholder={placeholder}
          autoFocus
          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-y"
        />
      ) : text.trim() ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{text}</p>
      ) : (
        <p className="text-sm text-gray-300 italic leading-relaxed">{placeholder}</p>
      )}
    </div>
  )
}

function Stat({ label, value, sub, subColor }: { label: string; value: string; sub?: string | null; subColor?: string }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
      <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900 leading-none">{value}</div>
      {sub && <div className={`text-[11px] mt-1.5 font-medium ${subColor ?? 'text-gray-400'}`}>{sub}</div>}
    </div>
  )
}

// ─── Per-network qualitative block (Funcionó / No / Aprendizajes / Accionables) ──
function Qualitative({ idPrefix, accionablesDefault = '' }: { idPrefix: string; accionablesDefault?: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 mt-5">
      <EditableBlock id={`${idPrefix}_ok`} title="✅ Qué funcionó" accent="border-emerald-300"
        placeholder="Formatos, temas y publicaciones que mejor rindieron este semestre…" />
      <EditableBlock id={`${idPrefix}_bad`} title="⚠️ Qué no funcionó" accent="border-red-300"
        placeholder="Qué no traccionó, qué bajó respecto al año pasado, qué frenó el crecimiento…" />
      <EditableBlock id={`${idPrefix}_learn`} title="💡 Aprendizajes" accent="border-amber-300"
        placeholder="Conclusiones del semestre que cambian cómo trabajamos esta red…" />
      <EditableBlock id={`${idPrefix}_todo`} title="🎯 Accionables Q3" accent="border-violet-300"
        defaultText={accionablesDefault}
        placeholder="Acciones concretas para los próximos meses…" />
    </div>
  )
}

export default function ReportPage() {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [collabs, setCollabs] = useState<CollabComparison | null>(null)
  const [content, setContent] = useState<ContentComparison | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getOverviewHistory(),
      getInstagramCollabComparison(),
      getContentPerformanceComparison(),
    ]).then(([h, c, cc]) => {
      setHistory(h)
      setCollabs(c)
      setContent(cc)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 p-8">Cargando datos…</div>

  const years = [...new Set(history.map(p => p.year))]
  const reportYear = years.length ? Math.max(...years) : new Date().getFullYear()
  const prevYear = reportYear - 1

  const inH1 = (y: number) => history.filter(p => p.year === y && p.month >= 1 && p.month <= 6)
  const h1Pts = inH1(reportYear)
  const cur = aggregate(h1Pts)
  const prevPts = inH1(prevYear)
  const prev: Agg | null = prevPts.length ? aggregate(prevPts) : null

  const q1 = aggregate(history.filter(p => p.year === reportYear && p.month >= 1 && p.month <= 3))
  const q2 = aggregate(history.filter(p => p.year === reportYear && p.month >= 4 && p.month <= 6))

  const lastMonth = h1Pts[h1Pts.length - 1]
  const periodLabel = h1Pts.length
    ? `${MONTH_NAMES[h1Pts[0].month - 1]} – ${MONTH_NAMES[lastMonth.month - 1]} ${reportYear}`
    : `H1 ${reportYear}`

  const totalReach = cur.igViews + cur.liImpressions + cur.ttViews + cur.ytViews
  const totalInteractions = cur.igInteractions + cur.liInteractions + cur.ttInteractions
  const totalNewFollowers = cur.igNewFollowers + cur.liNewFollowers + cur.ttNewFollowers
  const prevReach = prev ? prev.igViews + prev.liImpressions + prev.ttViews + prev.ytViews : null

  const freq = (posts: number, months: number) => months > 0 ? (posts / months).toFixed(1) : '0'

  return (
    <div className="p-8 max-w-5xl mx-auto print:p-0 print:max-w-none">
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-emerald-500" />
            Reporte Semestral · H1 {reportYear}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Análisis de los primeros 6 meses ({periodLabel}) · por red, qué funcionó, aprendizajes y accionables
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors print:hidden"
        >
          <Printer size={15} /> Exportar PDF
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-6 print:hidden">
        Los números se calculan en vivo desde el dashboard. El análisis cualitativo es editable (✎) y se guarda en este navegador — completalo antes de la reunión.
      </p>

      {/* ── Totales del semestre ── */}
      <Card className="mb-6">
        <CardTitle className="mb-4">Resumen del semestre · todas las redes</CardTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(() => {
            const r = yoyText(totalReach, prevReach, prevYear)
            return <Stat label="Alcance / Views totales" value={formatNumber(totalReach)} sub={r.sub} subColor={r.color} />
          })()}
          <Stat label="Interacciones totales" value={formatNumber(totalInteractions)} />
          <Stat label="Nuevos seguidores" value={formatNumber(totalNewFollowers)} sub="IG + LI + TikTok" />
          <Stat label="Newsletter / show views" value={formatNumber(cur.nlViews)} />
        </div>
        <div className="mt-5">
          <EditableBlock id="exec" title="📋 Resumen ejecutivo" accent="border-emerald-400"
            placeholder="3-5 líneas para abrir la reunión: el titular del semestre, hacia dónde va cada red, y la apuesta de Q3 (iniciativas + budget)." />
        </div>
      </Card>

      {/* ── Influencers vs Streaming vs Orgánico ── */}
      {content && (
        <Card className="mb-6">
          <CardTitle className="mb-1">Rendimiento por tipo de contenido · views promedio</CardTitle>
          <p className="text-xs text-gray-400 mb-4">Histórico sobre todo el contenido cargado. &quot;Streaming&quot; = episodios del newsletter/show.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <div className="text-[11px] text-violet-600 uppercase tracking-wide font-semibold mb-1">🤝 Con influencers (Collabs)</div>
              <div className="text-2xl font-bold text-violet-900">{formatNumber(Math.round(content.influencer.avg))}</div>
              <div className="text-xs text-violet-500 mt-1">views promedio · {content.influencer.count} piezas</div>
            </div>
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
              <div className="text-[11px] text-sky-600 uppercase tracking-wide font-semibold mb-1">🎬 Streaming (show)</div>
              <div className="text-2xl font-bold text-sky-900">{formatNumber(Math.round(content.streaming.avg))}</div>
              <div className="text-xs text-sky-500 mt-1">views promedio · {content.streaming.count} episodios</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="text-[11px] text-gray-500 uppercase tracking-wide font-semibold mb-1">🌱 Orgánico propio (IG)</div>
              <div className="text-2xl font-bold text-gray-900">{formatNumber(Math.round(content.organic.avg))}</div>
              <div className="text-xs text-gray-400 mt-1">views promedio · {content.organic.count} piezas</div>
            </div>
          </div>
          {content.influencer.avg > 0 && content.streaming.avg > 0 && (
            <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              {content.influencer.avg >= content.streaming.avg
                ? <>El contenido con influencers rinde <b>{(content.influencer.avg / content.streaming.avg).toFixed(1)}×</b> las views promedio del streaming.</>
                : <>El streaming rinde <b>{(content.streaming.avg / content.influencer.avg).toFixed(1)}×</b> las views promedio del contenido con influencers.</>}
            </div>
          )}
          <div className="mt-5">
            <EditableBlock id="content_analysis" title="Lectura del equipo" accent="border-violet-300"
              placeholder="¿Por qué rinde lo que rinde? ¿Qué replicamos en Q3? ¿El costo del influencer se justifica vs el alcance orgánico/streaming?" />
          </div>
        </Card>
      )}

      {/* ── Instagram ── */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <CardTitle className="!text-base !normal-case !tracking-normal text-gray-900">Instagram</CardTitle>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(() => { const r = yoyText(cur.igViews, prev?.igViews, prevYear); return <Stat label="Views / Impr." value={formatNumber(cur.igViews)} sub={r.sub} subColor={r.color} /> })()}
          {(() => { const r = yoyText(cur.igInteractions, prev?.igInteractions, prevYear); return <Stat label="Interacciones" value={formatNumber(cur.igInteractions)} sub={r.sub} subColor={r.color} /> })()}
          <Stat label="Nuevos seguidores" value={formatNumber(cur.igNewFollowers)} sub={`${formatNumber(cur.igEndFollowers)} totales`} />
          <Stat label="ER% promedio" value={formatPercent(cur.igER)} />
          <Stat label="Frecuencia" value={`${freq(cur.igPosts, cur.months)}/mes`} sub={`${cur.igPosts} posts`} />
        </div>
        <Qualitative idPrefix="ig" />
      </Card>

      {/* ── LinkedIn ── */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
          <CardTitle className="!text-base !normal-case !tracking-normal text-gray-900">LinkedIn</CardTitle>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {(() => { const r = yoyText(cur.liImpressions, prev?.liImpressions, prevYear); return <Stat label="Impresiones" value={formatNumber(cur.liImpressions)} sub={r.sub} subColor={r.color} /> })()}
          {(() => { const r = yoyText(cur.liInteractions, prev?.liInteractions, prevYear); return <Stat label="Interacciones" value={formatNumber(cur.liInteractions)} sub={r.sub} subColor={r.color} /> })()}
          <Stat label="Nuevos seguidores" value={formatNumber(cur.liNewFollowers)} sub={`${formatNumber(cur.liEndFollowers)} totales`} />
          <Stat label="ER% promedio" value={formatPercent(cur.liER)} />
          <Stat label="Frecuencia" value={`${freq(cur.liPosts, cur.months)}/mes`} sub={`${cur.liPosts} posts`} />
        </div>
        <Qualitative idPrefix="li" />
      </Card>

      {/* ── TikTok ── */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-900" />
          <CardTitle className="!text-base !normal-case !tracking-normal text-gray-900">TikTok &amp; Shorts</CardTitle>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(() => { const r = yoyText(cur.ttViews, prev?.ttViews, prevYear); return <Stat label="Views" value={formatNumber(cur.ttViews)} sub={r.sub} subColor={r.color} /> })()}
          <Stat label="Interacciones" value={formatNumber(cur.ttInteractions)} />
          <Stat label="Nuevos seguidores" value={formatNumber(cur.ttNewFollowers)} sub={`${formatNumber(cur.ttEndFollowers)} totales`} />
          <Stat label="Shorts (YT) views" value={formatNumber(cur.ytViews)} />
        </div>
        <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Megaphone size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            <b>La red menos explotada — y la mayor oportunidad.</b> Hay espacio claro para crecer subiendo cadencia y apostando a formatos orgánicos y de tendencia.
          </p>
        </div>
        <Qualitative idPrefix="tt"
          accionablesDefault={'• Más videos de oportunidades / búsquedas (ops).\n• Contenido de tendencia, aprovechando audios y formatos del momento.\n• Más orgánico y espontáneo, menos producido.\n• Subir la cadencia de publicación como objetivo central de Q3.'} />
      </Card>

      {/* ── Newsletter & Web ── */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
          <CardTitle className="!text-base !normal-case !tracking-normal text-gray-900">Newsletter &amp; Web</CardTitle>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <Stat label="Views del show / newsletter" value={formatNumber(cur.nlViews)} />
          <Stat label="Streaming · views prom." value={content ? formatNumber(Math.round(content.streaming.avg)) : '—'} sub={content ? `${content.streaming.count} episodios` : undefined} />
          <Stat label="Meses con datos" value={`${cur.months}`} sub={periodLabel} />
        </div>
        <Qualitative idPrefix="nl" />
      </Card>

      {/* ── Streaming subsection ── */}
      <Card className="mb-6 border-sky-200 bg-sky-50/40">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp size={18} className="text-sky-600" />
          <CardTitle className="!text-base !normal-case !tracking-normal text-sky-900">Análisis de Streaming</CardTitle>
        </div>
        <p className="text-xs text-gray-500 mb-4">Qué publicamos en el show, qué funcionó, qué no, y cómo estamos vs el año pasado.</p>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          <EditableBlock id="stream_what" title="📺 Qué publicamos" accent="border-sky-300"
            placeholder="Formato del show, frecuencia, temas / invitados del semestre…" />
          <EditableBlock id="stream_ok" title="✅ Qué funcionó" accent="border-emerald-300"
            placeholder="Episodios / temas con mejor performance, qué generó más views o leads…" />
          <EditableBlock id="stream_bad" title="⚠️ Qué no funcionó" accent="border-red-300"
            placeholder="Qué no traccionó, dónde caímos…" />
          <EditableBlock id="stream_yoy" title="📊 Vs el año pasado" accent="border-amber-300"
            placeholder="Cómo viene el streaming respecto a H1 del año anterior…" />
        </div>
      </Card>

      {/* ── Influencers detail ── */}
      {collabs && collabs.comparison.length > 0 && (
        <Card className="mb-6">
          <CardTitle className="mb-1">Colaboraciones con influencers</CardTitle>
          <p className="text-xs text-gray-400 mb-4">Views y ER promedio por cuenta · histórico de Collabs cargados.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400">
                  <th className="text-left py-2 px-3 font-medium">Cuenta</th>
                  <th className="text-right py-2 px-3 font-medium">Collabs</th>
                  <th className="text-right py-2 px-3 font-medium">Views prom.</th>
                  <th className="text-right py-2 px-3 font-medium">ER prom.</th>
                </tr>
              </thead>
              <tbody>
                {collabs.comparison.slice(0, 10).map(c => (
                  <tr key={c.account} className="border-b border-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-800">{c.account}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{c.count}</td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">{formatNumber(Math.round(c.avgViews))}</td>
                    <td className="py-2 px-3 text-right text-gray-600">{formatPercent(c.avgER)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {collabs.withoutAccount > 0 && (
              <p className="text-xs text-gray-400 mt-2 px-1">{collabs.withoutAccount} collab(s) sin cuenta asignada — no aparecen en la tabla.</p>
            )}
          </div>
          <div className="mt-5">
            <EditableBlock id="influencer_analysis" title="Lectura y decisiones" accent="border-violet-300"
              placeholder="¿Qué perfiles de influencer nos dieron mejor retorno? ¿Con quién repetimos en Q3? ¿Vale la inversión vs el alcance que generan?" />
          </div>
        </Card>
      )}

      {/* ── Cierre de Q: Q1 vs Q2 ── */}
      <Card className="mb-6">
        <CardTitle className="mb-4">Cierre de trimestre · Q1 vs Q2 {reportYear}</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400">
                <th className="text-left py-2 px-3 font-medium">Métrica</th>
                <th className="text-right py-2 px-3 font-medium">Q1</th>
                <th className="text-right py-2 px-3 font-medium">Q2</th>
                <th className="text-right py-2 px-3 font-medium">Var.</th>
              </tr>
            </thead>
            <tbody>
              {([
                ['IG · Views', q1.igViews, q2.igViews],
                ['IG · Interacciones', q1.igInteractions, q2.igInteractions],
                ['LI · Impresiones', q1.liImpressions, q2.liImpressions],
                ['LI · Interacciones', q1.liInteractions, q2.liInteractions],
                ['TikTok · Views', q1.ttViews, q2.ttViews],
                ['Nuevos seguidores (total)', q1.igNewFollowers + q1.liNewFollowers + q1.ttNewFollowers, q2.igNewFollowers + q2.liNewFollowers + q2.ttNewFollowers],
                ['Newsletter / show views', q1.nlViews, q2.nlViews],
              ] as [string, number, number][]).map(([label, a, b]) => {
                const v = a > 0 ? ((b - a) / a) * 100 : null
                return (
                  <tr key={label} className="border-b border-gray-50">
                    <td className="py-2 px-3 text-gray-700">{label}</td>
                    <td className="py-2 px-3 text-right text-gray-500">{formatNumber(a)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-gray-900">{formatNumber(b)}</td>
                    <td className={`py-2 px-3 text-right font-medium ${v == null ? 'text-gray-300' : v >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 grid md:grid-cols-2 gap-x-6 gap-y-4">
          <EditableBlock id="q1_learn" title="Aprendizajes de Q1" accent="border-amber-300"
            placeholder="Qué nos dejó Q1 que aplicamos en Q2…" />
          <EditableBlock id="q2_conclusion" title="Conclusión de Q2" accent="border-emerald-300"
            placeholder="Cierre de Q2: qué contenidos funcionaron y se replican en Q3…" />
        </div>
      </Card>

      {/* ── Q3: las dos patas ── */}
      <Card className="mb-6 border-emerald-200">
        <CardTitle className="mb-1 text-emerald-800">Hacia Q3 · iniciativas y budget</CardTitle>
        <p className="text-xs text-gray-500 mb-4">Las dos patas de Q3: qué vamos a hacer y qué plata pedimos para hacerlo.</p>
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-4">
          <EditableBlock id="q3_initiatives" title="🚀 Iniciativas" accent="border-emerald-400"
            placeholder="Apuestas de contenido por red para Q3 (qué replicamos de lo que funcionó, qué probamos nuevo — ej: empuje fuerte en TikTok)…" />
          <EditableBlock id="q3_budget" title="💰 Budget a pedir" accent="border-emerald-400"
            placeholder="Inversión que pedimos y para qué: influencers, producción de streaming, pauta, herramientas…" />
        </div>
      </Card>

      <p className="text-xs text-gray-400 text-center mt-8 print:mt-4">
        Seeds · Reporte interno H1 {reportYear} · datos en vivo del dashboard
      </p>
    </div>
  )
}
