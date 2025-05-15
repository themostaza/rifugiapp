import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js' // Added for general Supabase client
import { getLocaleFromHeaders } from './i18n/request'

// Environment variables for the general Supabase client
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL for general client");
}
if (!SUPABASE_ANON_KEY) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY for general client");
}

// Initialize general Supabase client for non-auth tasks like basket lookup
const supabaseGeneralClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function middleware(req: NextRequest) {
  const { pathname, searchParams, origin } = req.nextUrl
  const res = NextResponse.next()

  // Handle cart localization - redirect /cart/[id] to /{locale}/cart/[id]
  if (pathname.startsWith('/cart/') && !pathname.match(/^\/[a-z]{2}\/cart\//)) {
    const cartIdMatch = pathname.match(/^\/cart\/([^\/]+)/)
    if (cartIdMatch && cartIdMatch[1]) {
      const cartId = cartIdMatch[1]
      
      // Get preferred locale from browser
      const acceptLanguage = req.headers.get('accept-language') || undefined
      const preferredLocale = getLocaleFromHeaders(acceptLanguage)
      
      const newUrl = new URL(`/${preferredLocale}/cart/${cartId}`, origin)
      
      // Preserve query parameters
      searchParams.forEach((value, key) => {
        newUrl.searchParams.append(key, value)
      })
      
      console.log(`Redirecting from ${pathname} to ${newUrl.toString()} (detected locale: ${preferredLocale})`)
      return NextResponse.redirect(newUrl)
    }
  }

  // Handle root path redirect to localized version
  if (pathname === '/') {
    // Get preferred locale from browser
    const acceptLanguage = req.headers.get('accept-language') || undefined
    const preferredLocale = getLocaleFromHeaders(acceptLanguage)
    
    const newUrl = new URL(`/${preferredLocale}`, origin)
    
    // Preserve query parameters
    searchParams.forEach((value, key) => {
      newUrl.searchParams.append(key, value)
    })
    
    console.log(`Redirecting from / to ${newUrl.toString()} (detected locale: ${preferredLocale})`)
    return NextResponse.redirect(newUrl)
  }

  // Handle /reservation_summary redirect first
  if (pathname === '/reservation_summary') {
    const bubbleBasketId = searchParams.get('basketId')

    if (bubbleBasketId) {
      try {
        const { data, error } = await supabaseGeneralClient
          .from('Basket') // Ensure your table name is correct
          .select('external_id')
          .eq('id', bubbleBasketId)
          .single()

        if (error) {
          console.error('Supabase error fetching external_id for bubbleBasketId:', bubbleBasketId, error.message)
          return NextResponse.redirect(new URL('/', origin)) // Redirect to home on error
        }

        if (data && data.external_id) {
          // Get preferred locale from browser
          const acceptLanguage = req.headers.get('accept-language') || undefined
          const preferredLocale = getLocaleFromHeaders(acceptLanguage)
          
          const newUrl = new URL(`/${preferredLocale}/cart/${data.external_id}`, origin)
          console.log(`Redirecting from /reservation_summary?basketId=${bubbleBasketId} to ${newUrl.toString()} (detected locale: ${preferredLocale})`)
          return NextResponse.redirect(newUrl)
        } else {
          console.warn(`bubbleBasketId '${bubbleBasketId}' not found. Redirecting to homepage.`)
          return NextResponse.redirect(new URL('/', origin)) // Redirect to home if not found
        }
      } catch (e: unknown) {
        console.error('Error in /reservation_summary redirect logic:', e instanceof Error ? e.message : String(e))
        return NextResponse.redirect(new URL('/', origin)) // Fallback redirect
      }
    } else {
      console.warn('Missing "basketId" for /reservation_summary. Redirecting to homepage.')
      return NextResponse.redirect(new URL('/', origin)) // Redirect to home if no basketId
    }
  }

  // Existing authentication logic
  // Create Supabase client specific to this middleware invocation for auth
  const supabaseAuthClient = createMiddlewareClient({ req, res })
  
  // Check if the user is authenticated
  const {
    data: { session },
  } = await supabaseAuthClient.auth.getSession()
  
  // Redirect authenticated users away from login page
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/admin_power/calendario', origin))
  }
  
  // Check if the request is for an admin route or contains admin_booking parameter
  const isAdminRoute = pathname.startsWith('/admin_power')
  const hasAdminBookingParam = searchParams.has('admin_booking')
  
  // If trying to access admin route without authentication, redirect to login
  if ((isAdminRoute || hasAdminBookingParam) && !session) {
    const redirectUrl = new URL('/login', req.url)
    // Add original URL as a query parameter to redirect after login
    redirectUrl.searchParams.set('redirectTo', pathname + req.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }
  
  return res
}

// Only run middleware on matching routes
export const config = {
  matcher: [
    '/admin_power/:path*',
    '/login',
    '/', 
    '/admin/x7k9m2p4v3',
    '/reservation_summary', // Added the new path
    '/cart/:id', // Add matcher for cart paths
  ],
} 