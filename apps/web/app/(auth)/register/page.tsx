'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Zap, Eye, EyeOff } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store'
import { Button } from '@/components/ui'

export default function RegisterPage() {
  const router  = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  const passwordStrength = (() => {
    if (password.length === 0) return null
    let score = 0
    if (password.length >= 8)               score++
    if (password.length >= 12)              score++
    if (/[A-Z]/.test(password))            score++
    if (/[0-9]/.test(password))            score++
    if (/[^A-Za-z0-9]/.test(password))    score++
    if (score <= 1) return { label: 'Weak',   color: '#ef4444', width: '25%'  }
    if (score <= 2) return { label: 'Fair',   color: '#f59e0b', width: '50%'  }
    if (score <= 3) return { label: 'Good',   color: '#3b82f6', width: '75%'  }
    return                  { label: 'Strong', color: '#22c55e', width: '100%' }
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const { token, user } = await authApi.register({ name, email, password })
      setAuth(token, user)
      toast.success(`Welcome, ${user.name ?? user.email}!`)
      router.push('/dashboard')
    } catch (err: any) {
      toast.error(err.message ?? 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <Zap size={20} className="text-white" />
          </div>
          <span className="text-2xl font-semibold text-white">PipelineCI</span>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
          <div className="mb-6">
            <h1 className="text-lg font-semibold text-white">Create an account</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Start running pipelines in minutes
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm
                           placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="Ada Lovelace"
              />
            </div>

            {/* Email */}
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

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-zinc-800 border border-zinc-700 text-white text-sm
                             placeholder:text-zinc-500 focus:outline-none focus:border-brand-500 transition-colors"
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Strength meter */}
              {passwordStrength && (
                <div className="mt-2">
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: passwordStrength.width,
                        background: passwordStrength.color,
                      }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Confirm password
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className={`w-full px-3 py-2 rounded-lg bg-zinc-800 border text-white text-sm
                           placeholder:text-zinc-500 focus:outline-none transition-colors
                           ${
                             confirm && confirm !== password
                               ? 'border-red-600 focus:border-red-500'
                               : confirm && confirm === password
                               ? 'border-green-600 focus:border-green-500'
                               : 'border-zinc-700 focus:border-brand-500'
                           }`}
                placeholder="Repeat your password"
              />
              {confirm && confirm !== password && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              disabled={!name || !email || !password || password !== confirm}
              className="w-full justify-center mt-2"
            >
              Create account
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-zinc-900 px-3 text-xs text-zinc-500">
                Already have an account?
              </span>
            </div>
          </div>

          <Link href="/login">
            <Button variant="secondary" className="w-full justify-center">
              Sign in instead
            </Button>
          </Link>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          By registering you agree to our{' '}
          <a href="#" className="text-zinc-500 hover:text-zinc-400 underline underline-offset-2">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  )
}