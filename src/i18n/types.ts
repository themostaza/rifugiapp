export type Locale = 'it' | 'en' | 'fr' | 'es' | 'de'

export type Namespaces = 
  | 'navigation'
  | 'booking'
  | 'cart'
  | 'confirmation'
  | 'common'

export interface TranslationDictionary {
  [locale: string]: {
    [key: string]: string | TranslationDictionary
  }
} 