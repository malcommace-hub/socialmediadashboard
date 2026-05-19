'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Nav } from '@/components/nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('seeds_auth')) {
      router.replace('/')
    }
  }, [router])

  return (
    <div className="flex min-h-screen">
      <Nav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
