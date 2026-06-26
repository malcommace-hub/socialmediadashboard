import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'
import { SupplyNav } from '@/components/SupplyNav'

const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: 'Supply Generation · Seeds',
  description: 'Funnel semanal de generación de talento — Marketing × Attraction · Seeds',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className={`${montserrat.className} h-full bg-[#0A0E1A] text-white`}>
        <div className="flex min-h-screen">
          <SupplyNav />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  )
}
