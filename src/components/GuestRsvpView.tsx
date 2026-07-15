import { useEffect, useState } from 'react'
import type { GuestStatus } from '../types'
import { fetchPublicRsvpBoard, submitRsvp, type PublicRsvpBoard } from '../lib/rsvpApi'

function formatPartyDate(date: string, time: string): string {
  if (!date) return 'Ohne Datum'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  const datePart = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
  return time ? `${datePart}, ${time} Uhr` : datePart
}

function escapeCalendarText(value: string): string {
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

function buildCalendarDetails(details: NonNullable<PublicRsvpBoard['partyDetails']>): {
  title: string
  location: string
  description: string
  start: string | null
  end: string | null
} {
  const start = toIcsDateTime(details.date, details.time)
  if (!start) {
    return {
      title: details.forWhom.trim() || details.theme.trim() || 'Party',
      location: details.location.trim(),
      description: '',
      start: null,
      end: null,
    }
  }

  const startDate = new Date(`${details.date}T${details.time}`)
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const end =
    `${endDate.getFullYear()}${pad(endDate.getMonth() + 1)}${pad(endDate.getDate())}` +
    `T${pad(endDate.getHours())}${pad(endDate.getMinutes())}${pad(endDate.getSeconds())}`

  const description = [
    details.theme.trim() ? `Motto: ${details.theme.trim()}` : '',
    details.location.trim() ? `Ort: ${details.location.trim()}` : '',
    `Zeit: ${formatPartyDate(details.date, details.time)}`,
  ]
    .filter(Boolean)
    .join('\n')

  return {
    title: details.forWhom.trim() || details.theme.trim() || 'Party',
    location: details.location.trim(),
    description,
    start,
    end,
  }
}

function downloadIcs(details: NonNullable<PublicRsvpBoard['partyDetails']>) {
  const calendar = buildCalendarDetails(details)
  if (!calendar.start || !calendar.end) return
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PartyHost//Party Planner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}`,
    `DTSTAMP:${dtStamp}`,
    `SUMMARY:${escapeCalendarText(calendar.title)}`,
    calendar.location ? `LOCATION:${escapeCalendarText(calendar.location)}` : null,
    calendar.description ? `DESCRIPTION:${escapeCalendarText(calendar.description)}` : null,
    `DTSTART:${calendar.start}`,
    `DTEND:${calendar.end}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter((line): line is string => line !== null)
    .join('\r\n')

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const fileName = `${(calendar.title || 'party')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/gi, '-')}-einladung.ics`
  const link = document.createElement('a')
  link.href = url
  link.download = fileName.replace(/-+/g, '-').replace(/^-|-$/g, '') || 'party-einladung.ics'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function openGoogleCalendar(details: NonNullable<PublicRsvpBoard['partyDetails']>) {
  const calendar = buildCalendarDetails(details)
  if (!calendar.start || !calendar.end) return
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: calendar.title,
    dates: `${calendar.start}/${calendar.end}`,
    details: calendar.description,
    location: calendar.location,
  })
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer')
}

export function GuestRsvpView({ token, boardId }: { token: string; boardId?: string }) {
  const [board, setBoard] = useState<PublicRsvpBoard | null>(null)
  const [name, setName] = useState('')
  const [allergies, setAllergies] = useState('')
  const [personCount, setPersonCount] = useState('1')
  const [status, setStatus] = useState<GuestStatus>('zugesagt')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'PartyHost · Einladung'
    let cancelled = false
    void (async () => {
      try {
        const result = await fetchPublicRsvpBoard(token, boardId)
        if (!cancelled) setBoard(result)
      } catch {
        if (!cancelled) setError('Einladungslink konnte nicht geladen werden.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token, boardId])

  async function handleSubmit(nextStatus: GuestStatus) {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const nextCount = Number.parseInt(personCount, 10)
      const normalizedCount = Number.isFinite(nextCount) && nextCount > 0 ? nextCount : 1
      const result = await submitRsvp(
        token,
        trimmed,
        nextStatus,
        boardId,
        allergies.trim(),
        normalizedCount
      )
      setStatus(result.status)
      setSuccess(
        result.status === 'zugesagt'
          ? `Danke, ${result.name} ist jetzt als zugesagt eingetragen.`
          : `Danke, ${result.name} ist jetzt als abgesagt eingetragen.`
      )
    } catch {
      setError('Deine Antwort konnte gerade nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  const details = board?.partyDetails
  const canAddCalendar = Boolean(details?.date && details.time && status === 'zugesagt' && success)

  return (
    <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-xl flex-col gap-5">
        <header className="rounded-[2rem] border border-white/80 bg-white/80 p-6 shadow-[0_12px_35px_rgba(119,75,43,0.10)] backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">Einladung</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-stone-800">
            {details?.forWhom || 'Party'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">
            Hier kannst du deine Teilnahme an- oder abmelden. Nur die Gastgeberin sieht die
            Rückmeldung im Haupt-Board.
          </p>
        </header>

        <section className="rounded-[1.75rem] border border-orange-100 bg-white/85 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)]">
          {loading ? (
            <p className="text-sm text-stone-500">Lade Einladung …</p>
          ) : error ? (
            <p className="text-sm font-medium text-rose-700">{error}</p>
          ) : details ? (
            <div className="space-y-4">
              <InfoRow label="Motto" value={details.theme || 'Keins gesetzt'} />
              <InfoRow label="Ort" value={details.location || 'Nicht gesetzt'} />
              <InfoRow label="Datum" value={formatPartyDate(details.date, details.time)} />

              <div className="rounded-[1.35rem] border border-orange-100 bg-orange-50/60 p-4">
                <label className="mb-2 block text-sm font-semibold text-stone-700">
                  Dein Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Vor- und Nachname"
                  className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="rounded-[1.35rem] border border-orange-100 bg-orange-50/60 p-4">
                <label className="mb-2 block text-sm font-semibold text-stone-700">
                  Allergien / Unverträglichkeiten
                </label>
                <input
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="Optional, z. B. Nussallergie, vegan"
                  className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
              </div>

              <div className="rounded-[1.35rem] border border-orange-100 bg-orange-50/60 p-4">
                <label className="mb-2 block text-sm font-semibold text-stone-700">
                  Anzahl Personen
                </label>
                <input
                  type="number"
                  min="1"
                  value={personCount}
                  onChange={(e) => setPersonCount(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <p className="mt-2 text-xs font-medium text-stone-400">
                  Wie viele Personen inkl. dir kommen?
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => void handleSubmit('zugesagt')}
                  disabled={saving || !name.trim()}
                  className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40"
                >
                  Ich sage zu
                </button>
                <button
                  onClick={() => void handleSubmit('abgesagt')}
                  disabled={saving || !name.trim()}
                  className="rounded-2xl border border-rose-200 bg-white px-4 py-3 font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-40"
                >
                  Ich sage ab
                </button>
              </div>

              {success && (
                <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  {success} Der Status wurde im Haupt-Board gespeichert.
                </p>
              )}
              {canAddCalendar && details && (
                <div className="rounded-[1.4rem] border border-amber-100 bg-amber-50/70 p-4">
                  <p className="text-sm font-semibold text-stone-700">Zum Kalender hinzufügen</p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500">
                    Die Einladung kannst du jetzt direkt in deinen Kalender übernehmen.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => openGoogleCalendar(details)}
                      className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600"
                    >
                      Zu Google Kalender hinzufügen
                    </button>
                    <button
                      onClick={() => downloadIcs(details)}
                      className="rounded-2xl border border-amber-200 bg-white px-4 py-3 font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50"
                    >
                      Zu Apple/Outlook Kalender hinzufügen
                    </button>
                  </div>
                </div>
              )}
              {status && !success && name.trim() && (
                <p className="text-xs font-medium text-stone-500">
                  Aktueller Status zum Namen „{name.trim()}“: {status}.
                </p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3">
      <span className="text-sm font-medium text-stone-500">{label}</span>
      <span className="text-right text-sm font-semibold text-stone-800">{value}</span>
    </div>
  )
}
