'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Montserrat } from 'next/font/google'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Upload, ArrowLeft, Sprout } from 'lucide-react'

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

const links = [
  { href: '/supply', label: 'Funnel semanal', icon: LayoutDashboard },
  { href: '/supply/cargar', label: 'Cargar datos', icon: Upload },
]

export default function SupplyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const path = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('seeds_auth')) {
      router.replace('/')
    }
  }, [router])

  return (
    <div className={cn(montserrat.className, 'flex min-h-screen bg-[#0A0E1A] text-white')}>
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

        <div className="mt-auto px-1 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft size={13} /> Dashboard de redes
          </Link>
          <div className="px-3 text-xs text-gray-600">Seeds · Internal</div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
