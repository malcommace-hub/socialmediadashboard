const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export function getCached<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`qc:${key}`)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry<T>
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(`qc:${key}`)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

export function setCached<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
    sessionStorage.setItem(`qc:${key}`, JSON.stringify(entry))
  } catch {
    // sessionStorage full or unavailable — skip silently
  }
}

export function clearCache(): void {
  if (typeof window === 'undefined') return
  try {
    const keys = Object.keys(sessionStorage).filter(k => k.startsWith('qc:'))
    keys.forEach(k => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}
