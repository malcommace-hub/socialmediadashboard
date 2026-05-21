import { formatNumber } from '@/lib/utils'

// Recharts injects cx/cy/value/payload via cloneElement when used as <Line dot={<FollowerDot color="…"/>}/>
export function FollowerDot(props: {
  color: string
  cx?: number; cy?: number; value?: number
  payload?: { pctChange?: number | null }
  [k: string]: unknown
}) {
  const { color, cx, cy, value, payload } = props
  if (!value || !cx || !cy) return <g />
  const pct = payload?.pctChange ?? null
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill={color} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#374151">
        {formatNumber(value)}
      </text>
      {pct !== null && (
        <text x={cx} y={cy - 19} textAnchor="middle" fontSize={9} fill={pct >= 0 ? '#10b981' : '#ef4444'}>
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </text>
      )}
    </g>
  )
}
