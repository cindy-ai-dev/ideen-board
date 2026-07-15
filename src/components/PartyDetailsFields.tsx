import { useState } from 'react'
import type { PartyDetails, GuestStatus } from '../types'

interface Props {
  value: PartyDetails
  onChange: (next: PartyDetails) => void
  onShareRsvpLink?: () => void
  shareLabel?: string
}

function updateGuestStatus(current: PartyDetails, id: string, status: GuestStatus): PartyDetails {
  return {
    ...current,
    guests: current.guests.map((guest) => (guest.id === id ? { ...guest, status } : guest)),
  }
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
  const location = escapeIcsText(value.location.trim())
  const descriptionParts = [value.theme.trim() ? `Motto: ${value.theme.trim()}` : '', `Gäste: ${value.guestCount ?? 'unbekannt'}`]
    .filter(Boolean)
    .join('\\n')
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ideen-Board//Party Planner//DE',
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

function formatEuroInput(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value).replace('.', ',') : ''
}

export function PartyDetailsFields({ value, onChange, onShareRsvpLink, shareLabel }: Props) {
  const [guestName, setGuestName] = useState('')
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

  function addGuest() {
    const name = guestName.trim()
    if (!name) return
    onChange({
      ...value,
      guests: [...value.guests, { id: crypto.randomUUID(), name, status: guestStatus }],
    })
    setGuestName('')
    setGuestStatus('eingeladen')
  }

  function removeGuest(id: string) {
    onChange({ ...value, guests: value.guests.filter((guest) => guest.id !== id) })
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Für wen / Anlass</span>
          <input
            value={value.forWhom}
            onChange={(e) => updateField('forWhom', e.target.value)}
            placeholder='z.B. "Geburtstag für Mia, 8 Jahre"'
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Motto</span>
          <input
            value={value.theme}
            onChange={(e) => updateField('theme', e.target.value)}
            placeholder="z.B. Pokémon, Piraten, Einhörner (optional)"
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Ort</span>
          <input
            value={value.location}
            onChange={(e) => updateField('location', e.target.value)}
            placeholder="z.B. Zuhause, Park, Restaurant"
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Datum</span>
          <input
            type="date"
            value={value.date}
            onChange={(e) => updateField('date', e.target.value)}
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Uhrzeit</span>
          <input
            type="time"
            value={value.time}
            onChange={(e) => updateField('time', e.target.value)}
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Gästezahl</span>
          <input
            type="number"
            min="0"
            value={value.guestCount ?? ''}
            onChange={(e) => handleGuestCount(e.target.value)}
            placeholder="ca. 12"
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-stone-600">Budget-Limit</span>
          <input
            inputMode="decimal"
            value={formatEuroInput(value.budgetLimitEuro)}
            onChange={(e) => handleBudgetLimit(e.target.value)}
            placeholder="z.B. 50"
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
          <span className="text-xs text-stone-400">Optional, in Euro.</span>
        </label>
      </div>

      <div className="rounded-[1.5rem] border border-orange-100 bg-white/75 p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-orange-600">
              Gästeliste
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-stone-500">
              Namen hinzufügen und den Status direkt mitpflegen.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onShareRsvpLink && (
              <button
                onClick={onShareRsvpLink}
                className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
              >
                {shareLabel ?? 'Gäste-Link kopieren'}
              </button>
            )}
            {value.guests.length > 0 && (
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                {value.guests.length} Einträge
              </span>
            )}
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-stone-700">Kalender-Termin</p>
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                Datum und Uhrzeit eintragen, dann kannst du die Party als `.ics` herunterladen.
              </p>
            </div>
            <button
              onClick={() => downloadCalendar(value)}
              disabled={!calendarReady}
              className="rounded-2xl bg-amber-500 px-4 py-2.5 font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Zum Kalender hinzufügen
            </button>
          </div>
          {!calendarReady && (
            <p className="mt-2 text-xs font-medium text-amber-700">
              Dafür müssen Datum und Uhrzeit ausgefüllt sein.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Name hinzufügen"
            className="flex-1 rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          />
          <select
            value={guestStatus}
            onChange={(e) => setGuestStatus(e.target.value as GuestStatus)}
            className="rounded-2xl border border-orange-100 bg-orange-50/50 px-4 py-3 text-stone-700 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
          >
            <option value="eingeladen">eingeladen</option>
            <option value="zugesagt">zugesagt</option>
            <option value="abgesagt">abgesagt</option>
          </select>
          <button
            onClick={addGuest}
            disabled={!guestName.trim()}
            className="rounded-2xl bg-amber-500 px-4 py-3 font-semibold text-white shadow-sm shadow-amber-200 transition hover:bg-amber-600 disabled:opacity-40"
          >
            Hinzufügen
          </button>
        </div>

        {value.guests.length === 0 ? (
          <p className="mt-4 text-sm text-stone-400">Noch keine Gäste eingetragen.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {value.guests.map((guest) => (
              <div
                key={guest.id}
                className="flex flex-col gap-2 rounded-2xl border border-orange-100 bg-orange-50/40 px-3 py-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-stone-800">{guest.name}</p>
                </div>
                <select
                  value={guest.status}
                  onChange={(e) =>
                    onChange(updateGuestStatus(value, guest.id, e.target.value as GuestStatus))
                  }
                  className="rounded-full border border-orange-100 bg-white px-3 py-1.5 text-sm text-stone-700 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                >
                  <option value="eingeladen">eingeladen</option>
                  <option value="zugesagt">zugesagt</option>
                  <option value="abgesagt">abgesagt</option>
                </select>
                <button
                  onClick={() => removeGuest(guest.id)}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Entfernen
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
