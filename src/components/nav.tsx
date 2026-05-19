'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Camera,
  Briefcase,
  Music2,
  Clapperboard,
  Globe,
  Mail,
  Target,
  Upload,
  Star,
  Sparkles,
} from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/instagram', label: 'Instagram', icon: Camera },
  { href: '/dashboard/linkedin', label: 'LinkedIn', icon: Briefcase },
  { href: '/dashboard/tiktok', label: 'TikTok', icon: Music2 },
  { href: '/dashboard/youtube', label: 'YouTube', icon: Clapperboard },
  { href: '/dashboard/newsletter', label: 'Newsletter', icon: Mail },
  { href: '/dashboard/web', label: 'Web', icon: Globe },
  { href: '/dashboard/objectives', label: 'Objetivos Q', icon: Target },
  { href: '/dashboard/highlights', label: 'Destacados', icon: Star },
  { href: '/dashboard/insights', label: 'Insights', icon: Sparkles },
  { href: '/dashboard/upload', label: 'Cargar datos', icon: Upload },
]

export function Nav() {
  const path = usePathname()

  return (
    <aside className="w-56 shrink-0 bg-gray-950 min-h-screen flex flex-col py-6 px-3 print:hidden">
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">Seeds</div>
            <div className="text-gray-500 text-xs">Social Dashboard</div>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== '/dashboard' && path.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors',
                active
                  ? 'bg-emerald-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto px-3">
        <div className="text-xs text-gray-600">Seeds · Internal</div>
      </div>
    </aside>
  )
}
