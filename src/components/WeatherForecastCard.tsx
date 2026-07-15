import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartyDetails } from '../types'
import {
  canShowWeatherForecast,
  fetchPartyWeather,
  formatWeatherTemperature,
  weatherAvailabilityMessage,
  type WeatherForecast,
} from '../lib/weather'

interface Props {
  partyDetails: PartyDetails
}

export function WeatherForecastCard({ partyDetails }: Props) {
  const { t } = useTranslation()
  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const availabilityMessage = weatherAvailabilityMessage(partyDetails)
    if (availabilityMessage) {
      setWeather(null)
      setError(availabilityMessage)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    if (!canShowWeatherForecast(partyDetails)) {
      setWeather(null)
      setError(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    setError(null)
    void (async () => {
      const result = await fetchPartyWeather({
        city: partyDetails.city,
        date: partyDetails.date,
      })
      if (cancelled) return
      if (result) {
        setWeather(result)
        setError(null)
      } else {
        setWeather(null)
        setError(t('weather.unavailable'))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [partyDetails.date, partyDetails.city])

  if (!partyDetails.city.trim() || !partyDetails.date) return null

  if (error && !loading && !weather) {
    if (error === t('weather.from7Days')) {
      return (
        <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-stone-700">{t('weather.title')}</p>
          <p className="mt-1 text-sm text-stone-500">{error}</p>
        </div>
      )
    }

    return (
      <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-4 shadow-sm">
        <p className="text-sm font-semibold text-stone-700">{t('weather.title')}</p>
        <p className="mt-1 text-sm text-stone-500">{error}</p>
      </div>
    )
  }

  if (loading && !weather) {
    return (
      <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-4 shadow-sm">
        <p className="text-sm font-semibold text-stone-700">{t('weather.title')}</p>
        <p className="mt-1 text-sm text-stone-500">{t('weather.loading')}</p>
      </div>
    )
  }

  if (!weather) return null

  const highRain = weather.precipitationProbabilityMax > 50

  return (
    <div className="rounded-[1.5rem] border border-orange-100 bg-orange-50/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            {t('weather.title')}
          </p>
          <h3 className="mt-2 text-lg font-extrabold tracking-tight text-stone-800">
            {weather.emoji} {weather.label}
          </h3>
          <p className="mt-1 text-sm text-stone-500">{partyDetails.city}</p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-600 shadow-sm">
          {partyDetails.date}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoStat label={t('weather.minTemp')} value={formatWeatherTemperature(weather.temperatureMin)} />
        <InfoStat label={t('weather.maxTemp')} value={formatWeatherTemperature(weather.temperatureMax)} />
        <InfoStat
          label={t('weather.rainProbability')}
          value={`${Math.round(weather.precipitationProbabilityMax)}%`}
        />
      </div>

      {highRain && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-3 text-sm leading-relaxed text-stone-700">
          {t('weather.rainLikely')}
          <div className="mt-2">
            <a
              href="?view=schedule#backup-plan"
              className="inline-flex rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
            >
              {t('weather.backupLink')}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-stone-800">{value}</p>
    </div>
  )
}
