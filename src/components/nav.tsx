'use client'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Camera,
  Briefcase,
  Music2,
  Globe,
  Target,
  Upload,
  Star,
  Sparkles,
  Maximize2,
  Minimize2,
} from 'lucide-react'

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/instagram', label: 'Instagram', icon: Camera },
  { href: '/dashboard/linkedin', label: 'LinkedIn', icon: Briefcase },
  { href: '/dashboard/tiktok', label: 'TikTok & Shorts', icon: Music2 },
  { href: '/dashboard/medios', label: 'Newsletter & Web', icon: Globe },
  { href: '/dashboard/objectives', label: 'Objetivos Q', icon: Target },
  { href: '/dashboard/highlights', label: 'Destacados', icon: Star },
  { href: '/dashboard/insights', label: 'Insights', icon: Sparkles },
  { href: '/dashboard/upload', label: 'Cargar datos', icon: Upload },
]

// Thin component to read search params inside Suspense (required by Next.js App Router)
function PresentParamWatcher({ onActivate }: { onActivate: () => void }) {
  const params = useSearchParams()
  useEffect(() => {
    if (params.get('present') === '1') onActivate()
  }, [params, onActivate])
  return null
}

export function Nav() {
  const path = usePathname()

  const [presenting, setPresenting] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('seeds_present') === '1'
  })

  function activatePresenting() {
    sessionStorage.setItem('seeds_present', '1')
    setPresenting(true)
  }

  // Sync class to document.body
  useEffect(() => {
    document.body.classList.toggle('presentation-mode', presenting)
    return () => { document.body.classList.remove('presentation-mode') }
  }, [presenting])

  function togglePresenting() {
    setPresenting(v => {
      const next = !v
      if (next) sessionStorage.setItem('seeds_present', '1')
      else sessionStorage.removeItem('seeds_present')
      return next
    })
  }

  return (
    <aside className="w-56 shrink-0 bg-gray-950 min-h-screen flex flex-col py-6 px-3 print:hidden">
      <Suspense fallback={null}>
        <PresentParamWatcher onActivate={activatePresenting} />
      </Suspense>
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

      <div className="mt-auto px-3 flex flex-col gap-2">
        <button
          onClick={togglePresenting}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-colors w-full',
            presenting
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'text-gray-500 hover:text-white hover:bg-gray-800',
          )}
        >
          {presenting ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          {presenting ? 'Salir presentación' : 'Presentar'}
        </button>
        <div className="text-xs text-gray-600">Seeds · Internal</div>
      </div>
    </aside>
  )
}
