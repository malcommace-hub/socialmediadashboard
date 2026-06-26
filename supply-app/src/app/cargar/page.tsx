'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Loader2, CalendarPlus, CheckCircle, FileText, Briefcase } from 'lucide-react'
import {
  getWeeks, ensureWeek, updateInsights, deleteWeek,
  addOpportunity, deleteOpportunity, addContent, deleteContent,
  weekLabel, mondayOf, SENIORITIES, CHANNELS,
  type SupplyWeekFull, type Seniority, type Channel,
} from '@/lib/supply'

const inputCls = 'w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500'
const labelCls = 'block text-xs text-gray-400 mb-1'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function CargarPage() {
  const [weeks, setWeeks] = useState<SupplyWeekFull[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newWeekDate, setNewWeekDate] = useState(todayISO())

  async function reload(keepId?: string) {
    const w = await getWeeks()
    setWeeks(w)
    if (keepId) setSelectedId(keepId)
    else if (!selectedId && w.length) setSelectedId(w[w.length - 1].id)
    setLoading(false)
  }

  useEffect(() => { reload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const week = weeks.find(w => w.id === selectedId) ?? null

  async function handleCreateWeek() {
    setBusy(true)
    const w = await ensureWeek(newWeekDate)
    await reload(w.id)
    setBusy(false)
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white">Cargar datos</h1>
        <p className="text-gray-500 text-sm mt-1">Cargá semana por semana. El funnel se calcula solo.</p>
      </header>

      {loading ? (
        <div className="flex justify-center py-10 text-gray-500"><Loader2 className="animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          {/* Selección / creación de semana */}
          <div className="rounded-2xl bg-[#141929] border border-white/5 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <label className={labelCls}>Semana</label>
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className={inputCls}>
                  <option value="">— Elegí una semana —</option>
                  {[...weeks].reverse().map(w => (
                    <option key={w.id} value={w.id}>{weekLabel(w.week_start)}</option>
                  ))}
                </select>
              </div>
              <div className="text-gray-600 text-sm pb-2">o</div>
              <div>
                <label className={labelCls}>Nueva semana (cualquier día)</label>
                <input type="date" value={newWeekDate} onChange={e => setNewWeekDate(e.target.value)} className={inputCls} />
                <p className="text-[11px] text-gray-600 mt-1">Se agrupa por el lunes: {mondayOf(newWeekDate)}</p>
              </div>
              <button onClick={handleCreateWeek} disabled={busy} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-[#0A0E1A] font-semibold rounded-lg px-4 py-2 text-sm">
                <CalendarPlus size={15} /> Crear / abrir
              </button>
            </div>
          </div>

          {week && (
            <>
              <InsightsEditor week={week} onSaved={() => reload(week.id)} />
              <OpportunitiesEditor week={week} onChange={() => reload(week.id)} />
              <ContentsEditor week={week} onChange={() => reload(week.id)} />

              <button
                onClick={async () => {
                  if (!confirm(`¿Eliminar la semana ${weekLabel(week.week_start)} y todo su detalle?`)) return
                  await deleteWeek(week.id)
                  setSelectedId('')
                  reload()
                }}
                className="flex items-center gap-2 text-red-400/70 hover:text-red-400 text-xs"
              >
                <Trash2 size={13} /> Eliminar esta semana
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Insights ────────────────────────────────
function InsightsEditor({ week, onSaved }: { week: SupplyWeekFull; onSaved: () => void }) {
  const [text, setText] = useState(week.insights ?? '')
  const [saved, setSaved] = useState(false)
  useEffect(() => { setText(week.insights ?? ''); setSaved(false) }, [week.id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl bg-[#141929] border border-white/5 p-5">
      <h3 className="text-sm font-semibold text-white mb-3">Insights de la semana</h3>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setSaved(false) }}
        rows={4}
        placeholder="Características o eventualidades de la semana: calidad de oportunidades, estacionalidad, campañas especiales…"
        className={inputCls + ' resize-y'}
      />
      <button
        onClick={async () => { await updateInsights(week.id, text); setSaved(true); onSaved() }}
        className="mt-3 flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white rounded-lg px-3 py-1.5 text-sm"
      >
        {saved ? <CheckCircle size={14} className="text-emerald-400" /> : <Save size={14} />}
        {saved ? 'Guardado' : 'Guardar insights'}
      </button>
    </div>
  )
}

// ─── Oportunidades ───────────────────────────
const emptyOpp = { name: '', company: '', seniority: '' as Seniority | '', applications: 0, presented: 0, confirmed: 0 }

function OpportunitiesEditor({ week, onChange }: { week: SupplyWeekFull; onChange: () => void }) {
  const [form, setForm] = useState(emptyOpp)
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!form.name.trim()) return
    setBusy(true)
    await addOpportunity({
      week_id: week.id,
      name: form.name.trim(),
      company: form.company.trim() || null,
      seniority: (form.seniority || null) as Seniority | null,
      opp_date: null,
      applications: Number(form.applications) || 0,
      presented: Number(form.presented) || 0,
      confirmed: Number(form.confirmed) || 0,
    })
    setForm(emptyOpp)
    setBusy(false)
    onChange()
  }

  return (
    <div className="rounded-2xl bg-[#141929] border border-white/5 p-5">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Briefcase size={15} className="text-emerald-400" /> Oportunidades</h3>

      {week.opportunities.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {week.opportunities.map(o => (
            <div key={o.id} className="flex items-center gap-2 text-sm bg-[#0A0E1A] rounded-lg px-3 py-2">
              <span className="text-white font-medium">{o.name}</span>
              <span className="text-gray-500">{o.company}</span>
              {o.seniority && <span className="text-xs text-gray-400">· {o.seniority}</span>}
              <span className="ml-auto text-gray-400 tabular-nums text-xs">{o.applications} post · {o.presented} pres · {o.confirmed} conf</span>
              <button onClick={async () => { await deleteOpportunity(o.id); onChange() }} className="text-red-400/60 hover:text-red-400"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="col-span-2 md:col-span-1">
          <label className={labelCls}>Búsqueda / rol *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Data Engineer Sr" />
        </div>
        <div>
          <label className={labelCls}>Empresa</label>
          <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={inputCls} placeholder="Acme" />
        </div>
        <div>
          <label className={labelCls}>Seniority</label>
          <select value={form.seniority} onChange={e => setForm({ ...form, seniority: e.target.value as Seniority })} className={inputCls}>
            <option value="">—</option>
            {SENIORITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Postulaciones</label>
          <input type="number" min={0} value={form.applications} onChange={e => setForm({ ...form, applications: +e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Presentados</label>
          <input type="number" min={0} value={form.presented} onChange={e => setForm({ ...form, presented: +e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Confirmados</label>
          <input type="number" min={0} value={form.confirmed} onChange={e => setForm({ ...form, confirmed: +e.target.value })} className={inputCls} />
        </div>
      </div>
      <button onClick={add} disabled={busy || !form.name.trim()} className="mt-3 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#0A0E1A] font-semibold rounded-lg px-4 py-2 text-sm">
        <Plus size={15} /> Agregar oportunidad
      </button>
    </div>
  )
}

// ─── Contenidos ──────────────────────────────
const emptyContent = { channel: 'LinkedIn' as Channel, title: '', views: 0, url: '', oppIds: [] as string[] }

function ContentsEditor({ week, onChange }: { week: SupplyWeekFull; onChange: () => void }) {
  const [form, setForm] = useState(emptyContent)
  const [busy, setBusy] = useState(false)
  const oppById = new Map(week.opportunities.map(o => [o.id, o]))

  function toggleOpp(id: string) {
    setForm(f => ({ ...f, oppIds: f.oppIds.includes(id) ? f.oppIds.filter(x => x !== id) : [...f.oppIds, id] }))
  }

  async function add() {
    setBusy(true)
    await addContent({
      week_id: week.id,
      channel: form.channel,
      title: form.title.trim() || null,
      views: Number(form.views) || 0,
      url: form.url.trim() || null,
      content_date: null,
    }, form.oppIds)
    setForm(emptyContent)
    setBusy(false)
    onChange()
  }

  return (
    <div className="rounded-2xl bg-[#141929] border border-white/5 p-5">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><FileText size={15} className="text-sky-400" /> Contenidos</h3>

      {week.contents.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {week.contents.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-sm bg-[#0A0E1A] rounded-lg px-3 py-2">
              <span className="text-xs text-gray-400">{c.channel}</span>
              <span className="text-white">{c.title}</span>
              {c.opportunityIds.length > 0 && (
                <span className="text-[11px] text-gray-600">({c.opportunityIds.map(id => oppById.get(id)?.name).filter(Boolean).join(', ')})</span>
              )}
              <span className="ml-auto text-sky-300 tabular-nums text-xs">{c.views.toLocaleString()} views</span>
              <button onClick={async () => { await deleteContent(c.id); onChange() }} className="text-red-400/60 hover:text-red-400"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className={labelCls}>Canal</label>
          <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value as Channel })} className={inputCls}>
            {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Título</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="Reel ‘3 búsquedas de Data’" />
        </div>
        <div>
          <label className={labelCls}>Views</label>
          <input type="number" min={0} value={form.views} onChange={e => setForm({ ...form, views: +e.target.value })} className={inputCls} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <label className={labelCls}>URL (opcional)</label>
          <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} className={inputCls} placeholder="https://…" />
        </div>
      </div>

      {week.opportunities.length > 0 && (
        <div className="mt-3">
          <label className={labelCls}>Oportunidades mostradas en este contenido</label>
          <div className="flex flex-wrap gap-2">
            {week.opportunities.map(o => (
              <button
                key={o.id}
                type="button"
                onClick={() => toggleOpp(o.id)}
                className={'text-xs px-3 py-1.5 rounded-full border transition-colors ' + (form.oppIds.includes(o.id) ? 'bg-emerald-500 border-emerald-500 text-[#0A0E1A] font-medium' : 'border-white/15 text-gray-400 hover:border-white/30')}
              >
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={add} disabled={busy} className="mt-4 flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-[#0A0E1A] font-semibold rounded-lg px-4 py-2 text-sm">
        <Plus size={15} /> Agregar contenido
      </button>
    </div>
  )
}
