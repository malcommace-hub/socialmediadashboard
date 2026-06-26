'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatNumber } from '@/lib/utils'

export interface ChartPoint {
  label: string
  views: number
  applications: number
}

export function FunnelChart({ data }: { data: ChartPoint[] }) {
  // Ancho mínimo por semana para permitir scroll horizontal cuando hay muchas
  const minWidth = Math.max(data.length * 96, 640)

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }} className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e2738" vertical={false} />
            <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#1e2738' }} />
            <YAxis
              yAxisId="left"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ background: '#141929', border: '1px solid #1e2738', borderRadius: 12, color: '#fff', fontSize: 12 }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
            <Bar
              yAxisId="right"
              dataKey="applications"
              name="Postulaciones"
              fill="#2ECC71"
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="views"
              name="Views"
              stroke="#60a5fa"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#60a5fa' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
