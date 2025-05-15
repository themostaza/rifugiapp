import { headers } from 'next/headers'
import { match } from '@formatjs/intl-localematcher'
import Negotiator from 'negotiator'
import { locales, defaultLocale } from './routing'
import type { Locale } from './types'

/**
 * Get the preferred locale based on the request headers
 */
export function getLocaleFromHeaders(acceptLanguage?: string): Locale {
  // If no Accept-Language header is provided, return the default locale
  if (!acceptLanguage) {
    return defaultLocale
  }

  const negotiator = new Negotiator({
    headers: { 'accept-language': acceptLanguage }
  })

  // Use formatjs matcher to find the best match
  try {
    const matchedLocale = match(
      negotiator.languages(),
      locales as string[],
      defaultLocale
    )
    return matchedLocale as Locale
  } catch {
    return defaultLocale
  }
}

/**
 * Get the preferred locale from the request for server components
 */
export async function getLocaleFromRequest(): Promise<Locale> {
  try {
    // Get the Accept-Language header from the request
    const headersList = await headers()
    const acceptLanguage = headersList.get('accept-language') || undefined
    
    return getLocaleFromHeaders(acceptLanguage)
  } catch {
    return defaultLocale
  }
}

/**
 * Get translations for the current locale and namespace
 */
export async function getTranslations(locale: string, namespace: string) {
  try {
    // Use dynamic import to load only the translations we need
    const translations = await import(`../../messages/${locale}.json`)
      .then(module => module.default?.[namespace])
      .catch(() => null)
    
    if (!translations) {
      // Fallback to default locale if translations not found
      return import(`../../messages/${defaultLocale}.json`)
        .then(module => module.default?.[namespace])
        .catch(() => ({}))
    }
    
    return translations
  } catch (error) {
    console.error(`Failed to load translations for ${locale}.${namespace}`, error)
    return {}
  }
} 