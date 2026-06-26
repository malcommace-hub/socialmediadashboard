'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, Sprout } from 'lucide-react'

const links = [
  { href: '/', label: 'Funnel semanal', icon: LayoutDashboard },
  { href: '/cargar', label: 'Cargar datos', icon: Upload },
]

export function SupplyNav() {
  const path = usePathname()

  return (
    <aside className="w-60 shrink-0 bg-[#0A0E1A] border-r border-white/5 min-h-screen flex flex-col py-6 px-3">
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
            <Sprout size={17} className="text-[#0A0E1A]" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">Supply Generation</div>
            <div className="text-gray-500 text-xs">Marketing × Attraction</div>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                active
                  ? 'bg-emerald-500 text-[#0A0E1A] font-semibold'
                  : 'text-gray-400 hover:text-white hover:bg-white/5',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-3 text-xs text-gray-600">Seeds · Internal</div>
    </aside>
  )
}
