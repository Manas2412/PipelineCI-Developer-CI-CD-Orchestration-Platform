import {create} from 'zustand'
import {persist} from 'zustand/middleware'
import type { SafeUser } from 'types'

export interface AuthState {
    token: string | null
    user: SafeUser | null
    setAuth: (token: string, user: SafeUser) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            setAuth: (token, user) => {
                localStorage.setItem('token', token)
                set({token, user})
            },
            logout: () => {
                localStorage.removeItem('token')
                set({token: null, user: null})
            }
        }),
        { name: 'pipeline-auth' }
    )
)