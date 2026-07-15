import type { PartyDetails } from '../types'
import i18n from '../i18n'

export interface WeatherForecast {
  date: string
  temperatureMax: number
  temperatureMin: number
  precipitationProbabilityMax: number
  weatherCode: number
  emoji: string
  label: string
}

interface GeocodingResult {
  latitude: number
  longitude: number
  name?: string
  admin1?: string
  country?: string
}

const geocodeCache = new Map<string, GeocodingResult | null>()
const weatherCache = new Map<string, WeatherForecast | null>()

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function isDateString(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isEnglishLocale(): boolean {
  return (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
}

export function dateDifferenceInDays(date: string): number | null {
  if (!isDateString(date)) return null
  const target = new Date(`${date}T12:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const diff = target.getTime() - today.getTime()
  return Math.round(diff / (24 * 60 * 60 * 1000))
}

export function canShowWeatherForecast(details: PartyDetails): boolean {
  const diff = dateDifferenceInDays(details.date)
  return Boolean(details.city.trim() && diff !== null && diff >= 0 && diff <= 7)
}

export function weatherAvailabilityMessage(details: PartyDetails): string | null {
  if (!details.city.trim() || !details.date) return null
  const diff = dateDifferenceInDays(details.date)
  if (diff === null || diff < 0) return null
  if (diff > 7) {
    return isEnglishLocale()
      ? 'Weather forecast becomes available 7 days before the party.'
      : 'Wettervorhersage ist ab 7 Tage vor der Party verfügbar.'
  }
  return null
}

function weatherEmojiForCode(code: number): string {
  if (code === 0) return '☀️'
  if ([1, 2].includes(code)) return '⛅'
  if (code === 3) return '☁️'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'
  if ([56, 57, 66, 67].includes(code)) return '🌦️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌤️'
}

function weatherLabelForCode(code: number): string {
  const english = isEnglishLocale()
  if (code === 0) return english ? 'Clear' : 'Klar'
  if ([1, 2].includes(code)) return english ? 'Partly cloudy' : 'Leicht bewölkt'
  if (code === 3) return english ? 'Cloudy' : 'Bewölkt'
  if ([45, 48].includes(code)) return english ? 'Fog' : 'Nebel'
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return english ? 'Rain' : 'Regen'
  if ([56, 57, 66, 67].includes(code)) return english ? 'Freezing rain' : 'Gefrierender Regen'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return english ? 'Snow' : 'Schnee'
  if ([95, 96, 99].includes(code)) return english ? 'Thunderstorm' : 'Gewitter'
  return english ? 'Weather' : 'Wetter'
}

async function geocodeLocation(city: string): Promise<GeocodingResult | null> {
  const key = normalizeKey(city)
  if (!key) return null
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null

  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
    url.searchParams.set('name', city)
    url.searchParams.set('count', '1')
    url.searchParams.set('language', 'de')
    url.searchParams.set('format', 'json')

    const res = await fetch(url)
    if (!res.ok) {
      geocodeCache.set(key, null)
      return null
    }

    const json = (await res.json()) as {
      results?: Array<{
        latitude?: number
        longitude?: number
        name?: string
        admin1?: string
        country?: string
      }>
    }
    const result = json.results?.[0]
    if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') {
      geocodeCache.set(key, null)
      return null
    }

    const next = {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name,
      admin1: result.admin1,
      country: result.country,
    }
    geocodeCache.set(key, next)
    return next
  } catch {
    geocodeCache.set(key, null)
    return null
  }
}

export async function fetchPartyWeather(
  details: Pick<PartyDetails, 'city' | 'date'>
): Promise<WeatherForecast | null> {
  const city = details.city.trim()
  if (!city || !details.date) return null
  const diff = dateDifferenceInDays(details.date)
  if (diff === null || diff < 0 || diff > 7) return null

  const cacheKey = `${normalizeKey(city)}::${details.date}`
  if (weatherCache.has(cacheKey)) return weatherCache.get(cacheKey) ?? null

  try {
    const geocoded = await geocodeLocation(city)
    if (!geocoded) {
      weatherCache.set(cacheKey, null)
      return null
    }

    const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast')
    forecastUrl.searchParams.set('latitude', String(geocoded.latitude))
    forecastUrl.searchParams.set('longitude', String(geocoded.longitude))
    forecastUrl.searchParams.set(
      'daily',
      'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
    )
    forecastUrl.searchParams.set('forecast_days', '7')
    forecastUrl.searchParams.set('timezone', 'auto')

    const res = await fetch(forecastUrl)
    if (!res.ok) {
      weatherCache.set(cacheKey, null)
      return null
    }

    const json = (await res.json()) as {
      daily?: {
        time?: string[]
        temperature_2m_max?: number[]
        temperature_2m_min?: number[]
        precipitation_probability_max?: number[]
        weather_code?: number[]
      }
    }
    const daily = json.daily
    if (!daily?.time?.length) {
      weatherCache.set(cacheKey, null)
      return null
    }

    const index = daily.time.indexOf(details.date)
    if (index < 0) {
      weatherCache.set(cacheKey, null)
      return null
    }

    const max = daily.temperature_2m_max?.[index]
    const min = daily.temperature_2m_min?.[index]
    const probability = daily.precipitation_probability_max?.[index]
    const code = daily.weather_code?.[index]
    if (
      typeof max !== 'number' ||
      typeof min !== 'number' ||
      typeof probability !== 'number' ||
      typeof code !== 'number'
    ) {
      weatherCache.set(cacheKey, null)
      return null
    }

    const next: WeatherForecast = {
      date: details.date,
      temperatureMax: max,
      temperatureMin: min,
      precipitationProbabilityMax: probability,
      weatherCode: code,
      emoji: weatherEmojiForCode(code),
      label: weatherLabelForCode(code),
    }
    weatherCache.set(cacheKey, next)
    return next
  } catch {
    weatherCache.set(cacheKey, null)
    return null
  }
}

export function formatWeatherTemperature(value: number): string {
  return `${Math.round(value)}°`
}
