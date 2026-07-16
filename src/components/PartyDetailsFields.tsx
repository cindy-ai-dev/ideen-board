import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GuestStatus, PartyDetails } from '../types'
import { formatPartyAddress } from '../lib/location'
import i18n from '../i18n'

interface Props {
  value: PartyDetails
  onChange: (next: PartyDetails) => void
  onShareRsvpLink?: () => void
  onShareRsvpLinkWhatsApp?: () => void
  shareLabel?: string
  shareWhatsAppLabel?: string
  showDetails?: boolean
  showGuestList?: boolean
  showCalendar?: boolean
}

type ThemeTemplateKey =
  | 'none'
  | 'dinosaur'
  | 'princess'
  | 'football'
  | 'space'
  | 'pirates'
  | 'zoo'

const THEME_TEMPLATES: Array<{
  key: ThemeTemplateKey
  emoji: string
  labelDe: string
  labelEn: string
}> = [
  {
    key: 'dinosaur',
    emoji: '🦖',
    labelDe: 'Dinosaurier',
    labelEn: 'Dinosaurs',
  },
  {
    key: 'princess',
    emoji: '👑',
    labelDe: 'Prinzessin / Einhorn',
    labelEn: 'Princess / unicorn',
  },
  {
    key: 'football',
    emoji: '⚽',
    labelDe: 'Fußball',
    labelEn: 'Football',
  },
  {
    key: 'space',
    emoji: '🚀',
    labelDe: 'Weltraum',
    labelEn: 'Space',
  },
  {
    key: 'pirates',
    emoji: '🏴‍☠️',
    labelDe: 'Piraten',
    labelEn: 'Pirates',
  },
  {
    key: 'zoo',
    emoji: '🦁',
    labelDe: 'Tiere / Zoo',
    labelEn: 'Animals / zoo',
  },
]

function normalizeThemeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isThemeTemplateMatch(theme: string, template: (typeof THEME_TEMPLATES)[number]): boolean {
  const normalized = normalizeThemeLabel(theme)
  if (!normalized) return template.key === 'none'
  return (
    normalized === normalizeThemeLabel(template.labelDe) ||
    normalized === normalizeThemeLabel(template.labelEn)
  )
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function toIcsDateTime(date: string, time: string): string | null {
  if (!date || !time) return null
  const local = new Date(`${date}T${time}`)
  if (Number.isNaN(local.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${local.getFullYear()}${pad(local.getMonth() + 1)}${pad(local.getDate())}` +
    `T${pad(local.getHours())}${pad(local.getMinutes())}${pad(local.getSeconds())}`
  )
}

function toGoogleCalendarDateTime(date: string, time: string): string | null {
  const parsed = new Date(`${date}T${time}`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function buildCalendarFile(value: PartyDetails): string | null {
  const start = toIcsDateTime(value.date, value.time)
  if (!start) return null
  const startDate = new Date(`${value.date}T${value.time}`)
  if (Number.isNaN(startDate.getTime())) return null
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const end =
    `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}` +
    `T${pad(endDate.getHours())}${pad(endDate.getMinutes())}${pad(endDate.getSeconds())}`

  const title = escapeIcsText(value.forWhom.trim() || value.theme.trim() || 'Party')
  const location = escapeIcsText(formatPartyAddress(value.streetAddress, value.city))
  const descriptionParts = [
    value.theme.trim() ? `${i18n.t('details.theme')}: ${value.theme.trim()}` : '',
    `${i18n.t('details.guestCount')}: ${value.guestCount ?? i18n.t('plan.noneSet')}`,
  ]
    .filter(Boolean)
    .join('\\n')
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PartyHost//Party Planner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${dtStamp}`,
    `SUMMARY:${title}`,
    location ? `LOCATION:${location}` : null,
    descriptionParts ? `DESCRIPTION:${escapeIcsText(descriptionParts)}` : null,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter((line): line is string => line !== null)
    .join('\r\n')
}

function downloadCalendar(value: PartyDetails) {
  const content = buildCalendarFile(value)
  if (!content) return
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const fileName = `${(value.forWhom.trim() || value.theme.trim() || 'party')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')}-termin.ics`
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'party-termin.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildGoogleCalendarUrl(value: PartyDetails): string | null {
  if (!value.date || !value.time) return null
  const start = toGoogleCalendarDateTime(value.date, value.time)
  if (!start) return null
  const startDate = new Date(`${value.date}T${value.time}`)
  if (Number.isNaN(startDate.getTime())) return null
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000)
  const end = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const title = value.forWhom.trim() || value.theme.trim() || 'Party'
  const location = formatPartyAddress(value.streetAddress, value.city)
  const details = [
    value.theme.trim() ? `${i18n.t('details.theme')}: ${value.theme.trim()}` : '',
    value.preferences.trim() ? `${i18n.t('details.preferences')}: ${value.preferences.trim()}` : '',
    `${i18n.t('details.guestCount')}: ${value.guestCount ?? i18n.t('plan.noneSet')}`,
  ]
    .filter(Boolean)
    .join('\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${start}/${end}`,
    details,
    location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

function openGoogleCalendar(value: PartyDetails) {
  const url = buildGoogleCalendarUrl(value)
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function formatEuroInput(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value).replace('.', ',') : ''
}

function formatPersonCount(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return '1'
  return String(Math.max(1, Math.round(value)))
}

function formatAge(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(Math.round(value)) : ''
}

export function PartyDetailsFields({
  value,
  onChange,
  onShareRsvpLink,
  onShareRsvpLinkWhatsApp,
  shareLabel,
  shareWhatsAppLabel,
  showDetails = true,
  showGuestList = true,
  showCalendar = true,
}: Props) {
  const { t } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'de'
  const [guestName, setGuestName] = useState('')
  const [guestAllergies, setGuestAllergies] = useState('')
  const [guestPersonCount, setGuestPersonCount] = useState('1')
  const [guestStatus, setGuestStatus] = useState<GuestStatus>('eingeladen')
  const calendarReady = Boolean(value.date && value.time)

  function updateField<K extends keyof PartyDetails>(key: K, nextValue: PartyDetails[K]) {
    onChange({ ...value, [key]: nextValue })
  }

  function handleGuestCount(nextValue: string) {
    if (!nextValue.trim()) {
      updateField('guestCount', null)
      return
    }
    const parsed = Number.parseInt(nextValue, 10)
    updateField('guestCount', Number.isFinite(parsed) && parsed >= 0 ? parsed : null)
  }

  function handleBudgetLimit(nextValue: string) {
    const normalized = nextValue.trim().replace(',', '.')
    if (!normalized) {
      updateField('budgetLimitEuro', null)
      return
    }
    const parsed = Number.parseFloat(normalized)
    updateField('budgetLimitEuro', Number.isFinite(parsed) && parsed >= 0 ? parsed : null)
  }

  function getTemplateLabel(template: (typeof THEME_TEMPLATES)[number]): string {
    return currentLanguage === 'en' ? template.labelEn : template.labelDe
  }

  function selectTheme(template: (typeof THEME_TEMPLATES)[number] | null) {
    updateField('theme', template ? getTemplateLabel(template) : '')
  }

  function handleAge(nextValue: string) {
    const trimmed = nextValue.trim()
    if (!trimmed) {
      updateField('age', null)
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    updateField('age', Number.isFinite(parsed) && parsed > 0 ? parsed : null)
  }

  function addGuest() {
    const name = guestName.trim()
    if (!name) return
    const allergies = guestAllergies.trim()
    const count = Number.parseInt(guestPersonCount, 10)
    const personCount = Number.isFinite(count) && count > 0 ? count : 1
    onChange({
      ...value,
      guests: [
        ...value.guests,
        {
          id: crypto.randomUUID(),
          name,
          status: guestStatus,
          personCount,
          allergies: allergies || undefined,
        },
      ],
    })
    setGuestName('')
    setGuestAllergies('')
    setGuestPersonCount('1')
    setGuestStatus('eingeladen')
  }

  function removeGuest(id: string) {
    onChange({ ...value, guests: value.guests.filter((guest) => guest.id !== id) })
  }

  function updateGuestField(
    id: string,
    field: 'status' | 'allergies' | 'personCount',
    nextValue: string
  ) {
    onChange({
      ...value,
      guests: value.guests.map((guest) =>
        guest.id === id
          ? {
              ...guest,
              [field]:
                field === 'status'
                  ? (nextValue as GuestStatus)
                  : field === 'personCount'
                    ? (() => {
                        const parsed = Number.parseInt(nextValue, 10)
                        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
                      })()
                    : nextValue.trim() || undefined,
            }
          : guest
      ),
    })
  }

  return (
    <div className="space-y-5">
      {showDetails && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.forWhom')}</span>
            <input
              value={value.forWhom}
              onChange={(e) => updateField('forWhom', e.target.value)}
              placeholder={t('details.partyNamePlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-stone-600">{t('details.themePickerTitle')}</span>
              <span className="text-xs text-stone-400">{t('details.themePickerHint')}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                onClick={() => selectTheme(null)}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  !value.theme.trim()
                    ? 'border-orange-400 bg-orange-500 text-white shadow-sm shadow-orange-200'
                    : 'border-orange-100 bg-orange-50/50 text-stone-700 hover:border-orange-200 hover:bg-orange-50'
                }`}
              >
                <span className="text-xl">✨</span>
                <span className="text-sm font-semibold leading-tight">{t('details.themeTemplateNone')}</span>
              </button>
              {THEME_TEMPLATES.map((template) => {
                const active = isThemeTemplateMatch(value.theme, template)
                return (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => selectTheme(template)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-orange-400 bg-orange-500 text-white shadow-sm shadow-orange-200'
                        : 'border-orange-100 bg-orange-50/50 text-stone-700 hover:border-orange-200 hover:bg-orange-50'
                    }`}
                  >
                    <span className="text-xl">{template.emoji}</span>
                    <span className="text-sm font-semibold leading-tight">{getTemplateLabel(template)}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-sm font-semibold text-stone-600">{t('details.theme')}</span>
            <input
              value={value.theme}
              onChange={(e) => updateField('theme', e.target.value)}
              placeholder={t('details.themePlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.age')}</span>
            <input
              type="number"
              min="1"
              value={formatAge(value.age)}
              onChange={(e) => handleAge(e.target.value)}
              placeholder={t('details.agePlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <span className="text-xs text-stone-400">{t('details.ageHint')}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.streetAddress')}</span>
            <input
              value={value.streetAddress}
              onChange={(e) => updateField('streetAddress', e.target.value)}
              placeholder={t('details.streetPlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <span className="text-xs text-stone-400">{t('details.streetHint')}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.city')}</span>
            <input
              value={value.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder={t('details.cityPlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <span className="text-xs text-stone-400">{t('details.cityHint')}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.date')}</span>
            <input
              type="date"
              value={value.date}
              onChange={(e) => updateField('date', e.target.value)}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.time')}</span>
            <input
              type="time"
              value={value.time}
              onChange={(e) => updateField('time', e.target.value)}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.guestCount')}</span>
            <input
              type="number"
              min="0"
              value={value.guestCount ?? ''}
              onChange={(e) => handleGuestCount(e.target.value)}
              placeholder={t('details.guestCountPlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.budgetLimit')}</span>
            <input
              inputMode="decimal"
              value={formatEuroInput(value.budgetLimitEuro)}
              onChange={(e) => handleBudgetLimit(e.target.value)}
              placeholder={t('details.budgetPlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <span className="text-xs text-stone-400">{t('details.budgetHint')}</span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-stone-600">{t('details.responseDeadline')}</span>
            <input
              type="date"
              value={value.responseDeadline}
              onChange={(e) => updateField('responseDeadline', e.target.value)}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <span className="text-xs text-stone-400">{t('details.responseDeadlineHint')}</span>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <span className="text-sm font-semibold text-stone-600">{t('details.preferences')}</span>
            <textarea
              value={value.preferences}
              onChange={(e) => updateField('preferences', e.target.value)}
              placeholder={t('details.preferencesPlaceholder')}
              rows={3}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <span className="text-xs text-stone-400">{t('details.preferencesHint')}</span>
          </label>
        </div>
      )}

      {showCalendar && (
        <div className="rounded-[1.5rem] border border-amber-100 bg-amber-50/70 px-4 py-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-stone-700">{t('details.calendarTitle')}</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                {t('details.calendarHint')}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => downloadCalendar(value)}
                disabled={!calendarReady}
                className="rounded-2xl bg-amber-500 px-4 py-2.5 font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('details.calendarAppleButton')}
              </button>
              <button
                onClick={() => openGoogleCalendar(value)}
                disabled={!calendarReady}
                className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t('details.calendarGoogleButton')}
              </button>
            </div>
          </div>
          {!calendarReady && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              {t('details.calendarMissing')}
            </p>
          )}
        </div>
      )}

      {showGuestList && (
        <div className="rounded-[1.5rem] border border-orange-100 bg-white/75 p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-orange-600">
                {t('details.guestListTitle')}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                {t('details.guestListHint')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onShareRsvpLink && (
                <button
                  onClick={onShareRsvpLink}
                  className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
                >
                  {shareLabel ?? t('details.guestLink')}
                </button>
              )}
              {onShareRsvpLinkWhatsApp && (
                <button
                  onClick={onShareRsvpLinkWhatsApp}
                  className="rounded-full border border-green-200 bg-white px-3 py-1 text-xs font-semibold text-green-700 transition hover:bg-green-50"
                >
                  {shareWhatsAppLabel ?? t('details.guestWhatsapp')}
                </button>
              )}
              {value.guests.length > 0 && (
                <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  {t('details.guestEntries', { count: value.guests.length })}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[1.2fr_1fr_auto]">
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder={t('details.guestNamePlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
            <select
              value={guestStatus}
              onChange={(e) => setGuestStatus(e.target.value as GuestStatus)}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-700 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            >
              <option value="eingeladen">{t('details.guestStatusInvited')}</option>
              <option value="zugesagt">{t('details.guestStatusAccepted')}</option>
              <option value="abgesagt">{t('details.guestStatusDeclined')}</option>
            </select>
            <button
              onClick={addGuest}
              disabled={!guestName.trim()}
              className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600 disabled:opacity-40"
            >
              {t('details.guestAdd')}
            </button>
            <input
              value={guestAllergies}
              onChange={(e) => setGuestAllergies(e.target.value)}
              placeholder={t('details.guestAllergiesPlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100 lg:col-span-3"
            />
            <input
              type="number"
              min="1"
              value={guestPersonCount}
              onChange={(e) => setGuestPersonCount(e.target.value)}
              placeholder={t('details.guestPersonCountPlaceholder')}
              className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100 lg:col-span-3"
            />
          </div>

          {value.guests.length === 0 ? (
            <p className="mt-4 text-sm text-stone-400">{t('details.guestNone')}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {value.guests.map((guest) => (
                <div
                  key={guest.id}
                  className="flex flex-col gap-3 rounded-2xl border border-orange-100 bg-orange-50/40 px-3 py-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-stone-800">{guest.name}</p>
                        <p className="mt-0.5 text-xs text-stone-500">
                        {guest.status === 'zugesagt'
                          ? t('details.guestStatusAccepted')
                          : guest.status === 'abgesagt'
                            ? t('details.guestStatusDeclined')
                            : t('details.guestStatusInvited')}
                        {guest.status === 'zugesagt' && (
                          <>
                            {`, ${formatPersonCount(guest.personCount)} ${
                              formatPersonCount(guest.personCount) === '1'
                                ? t('details.guestPeopleSingular')
                                : t('details.guestPeoplePlural')
                            }`}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={guest.status}
                        onChange={(e) => updateGuestField(guest.id, 'status', e.target.value)}
                        className="rounded-full border border-orange-100 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      >
                        <option value="eingeladen">{t('details.guestStatusInvited')}</option>
                        <option value="zugesagt">{t('details.guestStatusAccepted')}</option>
                        <option value="abgesagt">{t('details.guestStatusDeclined')}</option>
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={formatPersonCount(guest.personCount)}
                        onChange={(e) => updateGuestField(guest.id, 'personCount', e.target.value)}
                        className="w-24 rounded-full border border-orange-100 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                        aria-label={`${guest.name}: ${t('details.guestPersonCountPlaceholder')}`}
                      />
                      <button
                        onClick={() => removeGuest(guest.id)}
                        className="rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        {t('common.remove')}
                      </button>
                    </div>
                  </div>
                  <input
                    value={guest.allergies ?? ''}
                    onChange={(e) => updateGuestField(guest.id, 'allergies', e.target.value)}
                    placeholder={t('details.guestAllergiesPlaceholder')}
                    className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
