import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de'
import en from './locales/en'

export const LANGUAGE_STORAGE_KEY = 'partyhost:language'

const savedLanguage =
  typeof window !== 'undefined' ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
const browserLanguage =
  typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('en')
    ? 'en'
    : 'de'

void i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    en: { translation: en },
  },
  lng: savedLanguage === 'en' || savedLanguage === 'de' ? savedLanguage : browserLanguage,
  fallbackLng: 'de',
  interpolation: {
    escapeValue: false,
  },
})

i18n.on('languageChanged', (lng) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng)
})

export default i18n

