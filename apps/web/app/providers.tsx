'use client'

import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/lib/store'
import { authApi } from '@/lib/api'

function UserSync() {
  const { token, setAuth, logout } = useAuthStore()

  useEffect(() => {
    if (!token) return

    // Refresh user data (especially orgId) on mount
    authApi.me()
      .then(user => {
        if (user) setAuth(token, user)
      })
      .catch(err => {
        console.error('[UserSync] Failed to refresh profile:', err)
        // If 401, we might want to logout, but let's be conservative
        if (err.message?.includes('401')) logout()
      })
  }, [token, setAuth, logout])

  return null
}

export function Providers({ children }: { children: React.ReactNode }): React.ReactNode {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:        30_000,
            retry:            1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={qc}>
      <UserSync />
      {children}
      <Toaster richColors position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}