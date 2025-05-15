import { createLocalizedPath, defaultLocale } from './routing'
import type { Locale } from './types'

/**
 * Creates a localized URL for the given path and locale
 */
export function getLocalizedUrl(path: string, locale: Locale) {
  return createLocalizedPath(path, locale)
}

/**
 * Get params for Link component to create a localized link
 */
export function getLocalizedLinkProps(path: string, locale: Locale) {
  return {
    href: getLocalizedUrl(path, locale)
  }
}

/**
 * Creates a map of localized URLs for all supported locales
 */
export function getAlternateLinks(path: string, locales: Locale[]) {
  return locales.reduce((acc, locale) => {
    acc[locale] = getLocalizedUrl(path, locale)
    return acc
  }, {} as Record<Locale, string>)
}

/**
 * Redirect a user to the same page in a different locale
 */
export function redirectToLocale(path: string, locale: Locale) {
  const localizedPath = getLocalizedUrl(path, locale)
  window.location.href = localizedPath
}

/**
 * For canonical URLs (for SEO), get the default locale URL
 */
export function getCanonicalUrl(path: string, domain: string) {
  const localizedPath = getLocalizedUrl(path, defaultLocale)
  return `${domain}${localizedPath}`
} 