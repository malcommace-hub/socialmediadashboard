'use client'
import { useEffect, useState } from 'react'
import { StatCard } from '@/components/ui/stat-card'
import { MonthSelector } from '@/components/ui/month-selector'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { getInstagramStats, getLinkedInStats, getTikTokStats, getYouTubeMonthly } from '@/lib/queries'
import { formatNumber, formatPercent, currentYearMonth, monthLabel } from '@/lib/utils'
import type { InstagramStats, LinkedInStats, TikTokStats, YouTubeMonthly } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from 'recharts'

export default function OverviewPage() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const [ig, setIg] = useState<InstagramStats | null>(null)
  const [li, setLi] = useState<LinkedInStats | null>(null)
  const [tt, setTt] = useState<TikTokStats | null>(null)
  const [yt, setYt] = useState<YouTubeMonthly | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const f = { year, month }
    Promise.all([
      getInstagramStats(f),
      getLinkedInStats(f),
      getTikTokStats(f),
      getYouTubeMonthly(f),
    ]).then(([igData, liData, ttData, ytRes]) => {
      setIg(igData)
      setLi(liData)
      setTt(ttData)
      setYt(ytRes.data ?? null)
      setLoading(false)
    })
  }, [year, month])

  const totalImpressions = (ig?.totalImpressions ?? 0) + (li?.totalImpressions ?? 0) + (tt?.totalViews ?? 0) + (yt?.shorts_views ?? 0)
  const totalInteractions = (ig?.totalInteractions ?? 0) + (li?.totalInteractions ?? 0) + (tt?.totalInteractions ?? 0)
  const totalFollowers = (ig?.monthly?.total_followers ?? 0) + (li?.monthly?.total_followers ?? 0) + (tt?.monthly?.total_followers ?? 0)

  const channelImpressions = [
    { channel: 'Instagram', value: ig?.totalImpressions ?? 0, fill: '#e11d48' },
    { channel: 'LinkedIn', value: li?.totalImpressions ?? 0, fill: '#0a66c2' },
    { channel: 'TikTok', value: tt?.totalViews ?? 0, fill: '#111827' },
    { channel: 'YouTube', value: yt?.shorts_views ?? 0, fill: '#dc2626' },
  ]

  const erByChannel = [
    { channel: 'IG', er: ig?.avgER ?? 0 },
    { channel: 'LI', er: li?.avgER ?? 0 },
    { channel: 'TT', er: 0 }, // TikTok ER not standard
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">{monthLabel(year, month)} · Todas las redes</p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m) }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Cargando datos...</div>
      ) : (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Impresiones totales"
              value={formatNumber(totalImpressions)}
              sub="Todas las redes"
            />
            <StatCard
              label="Interacciones totales"
              value={formatNumber(totalInteractions)}
              sub="Likes + Comments + Shares + Saves"
            />
            <StatCard
              label="Seguidores totales"
              value={formatNumber(totalFollowers)}
              sub="IG + LI + TT"
            />
            <StatCard
              label="ER promedio IG"
              value={formatPercent(ig?.avgER ?? 0)}
              sub="Engagement Rate Instagram"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Impresiones por canal</CardTitle>
              </CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={channelImpressions} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => formatNumber(v)} />
                  <Tooltip formatter={(v) => formatNumber(Number(v))} />
                  <Bar dataKey="value" name="Impresiones" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ER% por canal</CardTitle>
              </CardHeader>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={erByChannel} barSize={36}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v.toFixed(1)}%`} />
                  <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
                  <Bar dataKey="er" name="ER%" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Per channel summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-rose-500">
              <CardHeader><CardTitle>Instagram</CardTitle></CardHeader>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Impresiones</span>
                  <span className="font-semibold">{formatNumber(ig?.totalImpressions ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ER%</span>
                  <span className="font-semibold text-emerald-600">{formatPercent(ig?.avgER ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Seguidores</span>
                  <span className="font-semibold">{formatNumber(ig?.monthly?.total_followers ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Posts</span>
                  <span className="font-semibold">{ig?.posts.length ?? 0}</span>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-blue-600">
              <CardHeader><CardTitle>LinkedIn</CardTitle></CardHeader>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Impresiones</span>
                  <span className="font-semibold">{formatNumber(li?.totalImpressions ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">ER%</span>
                  <span className="font-semibold text-emerald-600">{formatPercent(li?.avgER ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Seguidores</span>
                  <span className="font-semibold">{formatNumber(li?.monthly?.total_followers ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Posts</span>
                  <span className="font-semibold">{li?.posts.length ?? 0}</span>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-gray-900">
              <CardHeader><CardTitle>TikTok</CardTitle></CardHeader>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Views totales</span>
                  <span className="font-semibold">{formatNumber(tt?.totalViews ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Interacciones</span>
                  <span className="font-semibold">{formatNumber(tt?.totalInteractions ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Seguidores</span>
                  <span className="font-semibold">{formatNumber(tt?.monthly?.total_followers ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Videos</span>
                  <span className="font-semibold">{tt?.videos.length ?? 0}</span>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-l-red-600">
              <CardHeader><CardTitle>YouTube Shorts</CardTitle></CardHeader>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Views totales</span>
                  <span className="font-semibold">{formatNumber(yt?.shorts_views ?? 0)}</span>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
