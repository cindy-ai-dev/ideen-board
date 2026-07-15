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
