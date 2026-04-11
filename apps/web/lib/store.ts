import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SafeUser } from 'types'

interface AuthState {
  token: string | null
  user:  SafeUser | null
  setAuth: (token: string, user: SafeUser) => void
  logout:  () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user:  null,
      setAuth: (token, user) => {
        localStorage.setItem('token', token)
        // Write cookie so Next.js middleware can read it server-side
        document.cookie = `pipelineci-token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
        set({ token, user })
      },
      logout: () => {
        localStorage.removeItem('token')
        document.cookie = 'pipelineci-token=; path=/; max-age=0'
        set({ token: null, user: null })
      },
    }),
    { name: 'pipelineci-auth' }
  )
)