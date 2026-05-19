'use client'
import { useEffect, useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { getOverviewHistory } from '@/lib/queries'
import { formatNumber, formatPercent, shortMonthLabel, pctChange } from '@/lib/utils'
import { Sparkles, Copy, Check, RefreshCw } from 'lucide-react'

type HistoryPoint = Awaited<ReturnType<typeof getOverviewHistory>>[0]

const STORAGE_KEY = 'seeds_insights_v1'

interface SavedInsights {
  month: string
  text: string
  savedAt: string
}

export default function InsightsPage() {
  const [history, setHistory] = useState<HistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [savedInsights, setSavedInsights] = useState<SavedInsights[]>([])
  const [customInsights, setCustomInsights] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getOverviewHistory().then(data => {
      setHistory(data)
      setLoading(false)
    })
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setSavedInsights(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  const current = history[history.length - 1]
  const prev = history[history.length - 2]
  const threeBack = history[history.length - 4]

  function buildPrompt(): string {
    if (!current) return ''
    const cur = current
    const p = prev
    const curLabel = shortMonthLabel(cur.year, cur.month)

    const lines = [
      `Soy el director de marketing de Seeds (empresa de HR tech en Argentina). Analizá los siguientes datos del dashboard de redes sociales para ${curLabel} y generame 8 insights concretos y accionables en español para presentar en reunión de equipo. Cada insight debe empezar con un número (1. 2. etc.) y ser de 1-2 oraciones.`,
      '',
      `## Datos ${curLabel}`,
      '',
      '### Instagram (@weareseeds_)',
      `- Views/Impresiones: ${formatNumber(cur.igImpressions)}${p ? ` (${pctChange(cur.igImpressions, p.igImpressions)?.toFixed(1)}% vs mes anterior)` : ''}`,
      `- Interacciones: ${formatNumber(cur.igInteractions)}${p ? ` (${pctChange(cur.igInteractions, p.igInteractions)?.toFixed(1)}% vs mes anterior)` : ''}`,
      `- ER%: ${formatPercent(cur.igER)}`,
      `- Nuevos seguidores: ${formatNumber(cur.igNewFollowers)}`,
      '',
      '### LinkedIn (weareseeders)',
      `- Impresiones: ${formatNumber(cur.liImpressions)}${p ? ` (${pctChange(cur.liImpressions, p.liImpressions)?.toFixed(1)}% vs mes anterior)` : ''}`,
      `- Interacciones: ${formatNumber(cur.liInteractions)}${p ? ` (${pctChange(cur.liInteractions, p.liInteractions)?.toFixed(1)}% vs mes anterior)` : ''}`,
      `- ER%: ${formatPercent(cur.liER)}`,
      `- Nuevos seguidores: ${formatNumber(cur.liNewFollowers)}`,
      '',
      '### TikTok (@weareseeds_)',
      `- Views: ${formatNumber(cur.ttViews)}${p ? ` (${pctChange(cur.ttViews, p.ttViews)?.toFixed(1)}% vs mes anterior)` : ''}`,
      `- Interacciones: ${formatNumber(cur.ttInteractions)}`,
      `- Nuevos seguidores: ${formatNumber(cur.ttNewFollowers)}`,
      '',
      '### Totales del mes',
      `- Impresiones totales: ${formatNumber(cur.igImpressions + cur.liImpressions + cur.ttViews + cur.ytViews)}`,
      `- Interacciones totales: ${formatNumber(cur.igInteractions + cur.liInteractions + cur.ttInteractions)}`,
      `- Nuevos seguidores totales: ${formatNumber(cur.igNewFollowers + cur.liNewFollowers + cur.ttNewFollowers)}`,
    ]

    if (threeBack) {
      const tb = threeBack
      lines.push('', '### Contexto trimestral (vs 3 meses atrás)')
      lines.push(`- Impresiones IG: ${pctChange(cur.igImpressions, tb.igImpressions)?.toFixed(1)}%`)
      lines.push(`- Impresiones LI: ${pctChange(cur.liImpressions, tb.liImpressions)?.toFixed(1)}%`)
      lines.push(`- Views TT: ${pctChange(cur.ttViews, tb.ttViews)?.toFixed(1)}%`)
    }

    lines.push('', 'Generá 8 insights numerados, concisos y útiles para la reunión.')

    return lines.join('\n')
  }

  async function copyPrompt() {
    const prompt = buildPrompt()
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function saveInsights() {
    if (!customInsights.trim() || !current) return
    const item: SavedInsights = {
      month: shortMonthLabel(current.year, current.month),
      text: customInsights,
      savedAt: new Date().toISOString(),
    }
    const updated = [item, ...savedInsights].slice(0, 12)
    setSavedInsights(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setCustomInsights('')
  }

  function deleteInsights(i: number) {
    const updated = savedInsights.filter((_, idx) => idx !== i)
    setSavedInsights(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 p-8">Cargando datos...</div>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles size={22} className="text-amber-400" />
          Insights
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Análisis del mes para presentar en reuniones de equipo
        </p>
      </div>

      {/* Resumen rápido */}
      {current && (
        <Card className="mb-6 bg-gray-50 border-gray-200">
          <CardTitle className="mb-3">Resumen {shortMonthLabel(current.year, current.month)}</CardTitle>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            {[
              ['Imp. totales', formatNumber(current.igImpressions + current.liImpressions + current.ttViews + current.ytViews), prev ? pctChange(current.igImpressions + current.liImpressions + current.ttViews + current.ytViews, prev.igImpressions + prev.liImpressions + prev.ttViews + prev.ytViews) : null],
              ['Interacciones', formatNumber(current.igInteractions + current.liInteractions + current.ttInteractions), prev ? pctChange(current.igInteractions + current.liInteractions + current.ttInteractions, prev.igInteractions + prev.liInteractions + prev.ttInteractions) : null],
              ['Nuevos segs.', formatNumber(current.igNewFollowers + current.liNewFollowers + current.ttNewFollowers), prev ? pctChange(current.igNewFollowers + current.liNewFollowers + current.ttNewFollowers, prev.igNewFollowers + prev.liNewFollowers + prev.ttNewFollowers) : null],
              ['IG ER%', formatPercent(current.igER), prev ? pctChange(current.igER, prev.igER) : null],
              ['LI ER%', formatPercent(current.liER), prev ? pctChange(current.liER, prev.liER) : null],
              ['Views TikTok', formatNumber(current.ttViews), prev ? pctChange(current.ttViews, prev.ttViews) : null],
            ].map(([label, value, trend]) => (
              <div key={String(label)} className="bg-white rounded-xl border border-gray-100 p-3">
                <div className="text-xs text-gray-500 mb-0.5">{label}</div>
                <div className="font-bold text-gray-900">{value}</div>
                {trend !== null && trend !== undefined && (
                  <div className={`text-xs font-medium ${Number(trend) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Number(trend) >= 0 ? '+' : ''}{Number(trend).toFixed(1)}% vs mes ant.
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Prompt generator */}
      <Card className="mb-6 border-amber-200 bg-amber-50">
        <div className="flex items-start justify-between mb-3">
          <div>
            <CardTitle className="text-amber-800">Generar insights con IA</CardTitle>
            <p className="text-xs text-amber-700 mt-1">
              Copiá el prompt generado y pegalo en Claude.ai o ChatGPT para obtener 8 insights del mes.
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-3 text-xs font-mono text-gray-600 max-h-48 overflow-y-auto whitespace-pre-wrap mb-3">
          {buildPrompt()}
        </div>
        <button
          onClick={copyPrompt}
          className="flex items-center gap-2 bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-400 transition-colors"
        >
          {copied ? <><Check size={15} /> Copiado!</> : <><Copy size={15} /> Copiar prompt</>}
        </button>
      </Card>

      {/* Paste insights back */}
      <Card className="mb-6">
        <CardTitle className="mb-3">Pegar insights generados</CardTitle>
        <p className="text-xs text-gray-500 mb-2">Después de generar los insights con IA, pegálos acá para guardarlos en el dashboard.</p>
        <textarea
          value={customInsights}
          onChange={e => setCustomInsights(e.target.value)}
          rows={6}
          placeholder="1. Insight sobre el rendimiento de Instagram...&#10;2. Insight sobre LinkedIn...&#10;..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
        <button
          onClick={saveInsights}
          disabled={!customInsights.trim()}
          className="mt-2 bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-400 disabled:opacity-40"
        >
          Guardar insights del mes
        </button>
      </Card>

      {/* Saved insights history */}
      {savedInsights.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Insights guardados</h2>
          <div className="space-y-3">
            {savedInsights.map((item, i) => (
              <Card key={i}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">{item.month}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{new Date(item.savedAt).toLocaleDateString('es')}</span>
                    <button onClick={() => deleteInsights(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <RefreshCw size={12} />
                    </button>
                  </div>
                </div>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{item.text}</pre>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
