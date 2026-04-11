import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED = ['/dashboard', '/projects', '/runs', '/runners', '/pipelines']
const AUTH_ONLY = ['/login', '/register']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Read token from cookie (set by the client after login)
  const token = req.cookies.get('pipelineci-token')?.value

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p))
  const isAuthRoute  = AUTH_ONLY.some((p) => pathname.startsWith(p))

  if (isProtected && !token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && token) {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/runs/:path*',
    '/runners/:path*',
    '/pipelines/:path*',
    '/login',
    '/register',
  ],
}