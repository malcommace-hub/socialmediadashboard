import { cn } from '@/lib/utils'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'default' | 'reel' | 'post' | 'collab' | 'story' | 'manual'
  className?: string
}

const variants = {
  default: 'bg-gray-100 text-gray-700',
  reel: 'bg-purple-100 text-purple-700',
  post: 'bg-blue-100 text-blue-700',
  collab: 'bg-orange-100 text-orange-700',
  story: 'bg-pink-100 text-pink-700',
  manual: 'bg-yellow-100 text-yellow-700',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
