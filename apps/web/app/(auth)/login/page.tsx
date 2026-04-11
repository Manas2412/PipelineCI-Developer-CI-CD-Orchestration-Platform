import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Zap } from 'lucide-react'
import { authApi } from '../../../lib/api' 
import { useAuthStore, type AuthState } from '../../../lib/store' 
import { Button } from '../../../components/ui' 

export default function LoginPage(): React.ReactNode {
  const router   = useRouter()
  const setAuth  = useAuthStore((s: AuthState) => s.setAuth)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { token, user } = await authApi.login({ email, password })
      setAuth(token, user)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-2xl font-semibold text-white">PipelineCI</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
          <h1 className="text-lg font-semibold text-white mb-6">Sign in</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm
                           placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm
                           placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="w-full justify-center"
            >
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}