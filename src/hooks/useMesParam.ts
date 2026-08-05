'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { currentYearMonth } from '@/lib/utils'
import { getStoredMonth, setStoredMonth } from '@/lib/monthStore'
import { getLatestDataMonth } from '@/lib/queries'

export function useMesParam() {
  const { year: cy, month: cm } = currentYearMonth()
  const [year, setYear] = useState(cy)
  const [month, setMonth] = useState(cm)
  const router = useRouter()
  const firstRun = useRef(true)

  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      const p = new URLSearchParams(window.location.search)
      const y = parseInt(p.get('year') ?? '')
      const m = parseInt(p.get('month') ?? '')
      if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
        setYear(y)
        setMonth(m)
        return
      }
      // Otherwise adopt the shared selected month so switching tabs keeps it.
      const stored = getStoredMonth()
      if (stored) {
        setYear(stored.year)
        setMonth(stored.month)
        return
      }
      // No URL param and no stored month (fresh visit): default to the latest
      // month that actually has data, not today's (likely empty) calendar month.
      getLatestDataMonth().then(latest => {
        if (latest) { setYear(latest.year); setMonth(latest.month) }
      }).catch(() => {})
      return
    }
    setStoredMonth(year, month)
    const url = new URL(window.location.href)
    url.searchParams.set('year', String(year))
    url.searchParams.set('month', String(month))
    router.replace(url.pathname + '?' + url.searchParams.toString(), { scroll: false })
  }, [year, month, router])

  return { year, month, setYear, setMonth }
}
