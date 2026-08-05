'use client'
import { Nav } from '@/components/nav'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
