'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const correct = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD || 'seeds2025'
    if (password === correct) {
      sessionStorage.setItem('seeds_auth', 'true')
      router.push('/dashboard')
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm px-4">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500 mb-5">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Seeds Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Acceso interno · Equipo de Marketing</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <label className="block text-sm text-gray-400 mb-2">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            placeholder="••••••••"
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-xs mt-2">Contraseña incorrecta</p>
          )}
          <button
            type="submit"
            className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  )
}
