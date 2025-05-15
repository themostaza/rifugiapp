import type { Locale } from './types'

// Routes that don't require internationalization
export const NON_I18N_ROUTES = [
  '/api',
  '/admin',
  '/login'
]

export const defaultLocale: Locale = 'it'
export const locales: Locale[] = ['it', 'en', 'fr', 'es', 'de']

// Returns true if a route doesn't need internationalization
export function isNonI18nRoute(pathname: string): boolean {
  return NON_I18N_ROUTES.some(route => pathname.startsWith(route))
}

// Get the locale from a pathname
export function extractLocaleFromPathname(pathname: string): Locale | undefined {
  const pathSegments = pathname.split('/')
  const firstSegment = pathSegments[1] as Locale
  
  if (locales.includes(firstSegment)) {
    return firstSegment
  }
  
  return undefined
}

// Create a new path with locale
export function createLocalizedPath(pathname: string, locale: Locale): string {
  // Remove the current locale from the path, if it exists
  const currentLocale = extractLocaleFromPathname(pathname)
  let newPath = pathname
  
  if (currentLocale) {
    newPath = pathname.replace(`/${currentLocale}`, '')
  }
  
  // If the path is empty after removing the locale, use '/'
  if (newPath === '') {
    newPath = '/'
  }
  
  // Add the new locale
  if (newPath === '/') {
    return `/${locale}`
  }
  
  return `/${locale}${newPath}`
}

// Get the current locale from the pathname or default to 'it'
export function getLocaleFromPathname(pathname: string): Locale {
  const locale = extractLocaleFromPathname(pathname)
  return locale || defaultLocale
} 