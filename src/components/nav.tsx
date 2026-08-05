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
    <header className="w-full bg-gray-950 print:hidden sticky top-0 z-40">
      <Suspense fallback={null}>
        <PresentParamWatcher onActivate={activatePresenting} />
      </Suspense>
      <div className="flex items-center gap-4 px-6 h-14">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <div className="hidden sm:block text-white font-semibold text-sm leading-none">Seeds</div>
        </div>

        {/* Tabs */}
        <nav className="flex items-center gap-1 flex-1 overflow-x-auto no-scrollbar">
          {links.map(({ href, label, icon: Icon }) => {
            const active = path === href || (href !== '/dashboard' && path.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
                  active
                    ? 'bg-emerald-600 text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800',
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Presentation toggle */}
        <button
          onClick={togglePresenting}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0',
            presenting
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'text-gray-500 hover:text-white hover:bg-gray-800',
          )}
        >
          {presenting ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          <span className="hidden md:inline">{presenting ? 'Salir presentación' : 'Presentar'}</span>
        </button>
      </div>
    </header>
  )
}
