'use client'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ReactNode
  className?: string
}

export function StatCard({ label, value, sub, trend, icon, className }: StatCardProps) {
  return (
    <div className={cn('bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-gray-300">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900 tracking-tight">{value}</div>
      {sub && (
        <div className={cn(
          'text-xs font-medium',
          trend === 'up' && 'text-emerald-600',
          trend === 'down' && 'text-red-500',
          !trend && 'text-gray-400',
        )}>
          {sub}
        </div>
      )}
    </div>
  )
}
