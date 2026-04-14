'use client'

// Temporary constant — replace with useAuthStore(s => s.user?.orgId)
// once organization membership is wired into the auth flow.
// All pages that need an orgId import from here so there's ONE place to change.
export const DEFAULT_ORG_ID = 'default-org'