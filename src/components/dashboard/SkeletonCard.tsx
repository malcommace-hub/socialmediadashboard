interface SkeletonCardProps {
  lines?: number
  chart?: boolean
  kpi?: boolean
  count?: number
}

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />
}

const BAR_HEIGHTS = ['30%', '65%', '45%', '85%', '55%', '70%', '40%', '90%']

export function SkeletonCard({ lines = 3, chart = false, kpi = false, count = 4 }: SkeletonCardProps) {
  if (kpi) {
    const cols = count <= 2 ? 'grid-cols-2' : count === 3 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'
    return (
      <div className={`grid gap-4 mb-6 ${cols}`}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 flex flex-col gap-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-7 w-20" />
            <Pulse className="h-3 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (chart) {
    return (
      <div className="bg-white rounded-2xl p-4 mb-6">
        <Pulse className="h-4 w-32 mb-4" />
        <div className="flex items-end gap-2 h-40">
          {BAR_HEIGHTS.map((h, i) => (
            <div key={i} className="flex-1 animate-pulse rounded bg-gray-200" style={{ height: h }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl p-4 mb-6">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
          <Pulse className="h-4 w-8 shrink-0" />
          <Pulse className="h-4 flex-1" />
          <Pulse className="h-4 w-16 shrink-0" />
          <Pulse className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  )
}
