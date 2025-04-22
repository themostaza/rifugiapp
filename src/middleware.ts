import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  
  // Create Supabase client specific to this middleware invocation
  const supabase = createMiddlewareClient({ req, res })
  
  // Check if the user is authenticated
  const {
    data: { session },
  } = await supabase.auth.getSession()
  
  // Check if the request is for an admin route
  const isAdminRoute = req.nextUrl.pathname.startsWith('/admin_power')
  
  // If trying to access admin route without authentication, redirect to login
  if (isAdminRoute && !session) {
    const redirectUrl = new URL('/login', req.url)
    // Add original URL as a query parameter to redirect after login
    redirectUrl.searchParams.set('redirectTo', req.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }
  
  return res
}

// Only run middleware on matching routes
export const config = {
  matcher: [
    '/admin_power/:path*',
    '/login',
  ],
} 