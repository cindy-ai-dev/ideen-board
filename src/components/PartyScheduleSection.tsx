import { useMemo, useState } from 'react'
import type { PartyDetails, PartyScheduleBackupItem, PartyScheduleItem } from '../types'
import { formatPartyScheduleLabel, sortPartySchedule } from '../lib/schedule'

function parseMinutes(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

interface Props {
  items: PartyScheduleItem[]
  backupItems?: PartyScheduleBackupItem[]
  partyDetails: PartyDetails
  editable?: boolean
  generating?: boolean
  backupOpen?: boolean
  onToggleBackupOpen?: () => void
  onGenerate?: () => void
  onAddItem?: (item: { title: string; note?: string; minutesFromStart?: number | null }) => void
  onUpdateItem?: (id: string, patch: { title?: string; note?: string; minutesFromStart?: number | null }) => void
  onRemoveItem?: (id: string) => void
}

export function PartyScheduleSection({
  items,
  backupItems = [],
  partyDetails,
  editable = false,
  generating = false,
  backupOpen = false,
  onToggleBackupOpen,
  onGenerate,
  onAddItem,
  onUpdateItem,
  onRemoveItem,
}: Props) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [minutesFromStart, setMinutesFromStart] = useState('')

  const sorted = useMemo(() => sortPartySchedule(items), [items])
  const sortedBackup = useMemo(() => sortPartySchedule(backupItems), [backupItems])
  const hasPartyTime = Boolean(partyDetails.date && partyDetails.time)

  function handleAdd() {
    const nextTitle = title.trim()
    if (!nextTitle || !onAddItem) return
    onAddItem({
      title: nextTitle,
      note: note.trim() || undefined,
      minutesFromStart: parseMinutes(minutesFromStart),
    })
    setTitle('')
    setNote('')
    setMinutesFromStart('')
  }

  return (
    <section className="rounded-[1.75rem] border border-orange-100 bg-white/85 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] print:rounded-none print:border print:border-stone-300 print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 print:text-stone-500">
            Ablaufplan
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 print:text-black">
            Programm am Partytag
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 print:text-stone-700">
            Zeitlich strukturierter Vorschlag für den Partytag selbst – vom Ankommen bis zum Ausklang.
          </p>
        </div>

        {editable && onGenerate && (
          <button
            onClick={onGenerate}
            disabled={generating}
            className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40 print:hidden"
          >
            {generating ? 'Plant…' : items.length > 0 ? 'Ablaufplan aktualisieren' : 'Ablaufplan generieren'}
          </button>
        )}
      </div>

      {editable && (
        <div className="mt-4 rounded-[1.35rem] border border-amber-100 bg-amber-50/60 p-4 print:hidden">
          <div className="grid gap-2 lg:grid-cols-[1fr_180px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-stone-600">Programmpunkt</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Begrüßung & Ankommen"
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-stone-600">
                {hasPartyTime ? 'Minuten nach Start' : 'Minuten ab Start'}
              </span>
              <input
                value={minutesFromStart}
                onChange={(e) => setMinutesFromStart(e.target.value)}
                inputMode="numeric"
                placeholder="z.B. 30"
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto]">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Notiz / Hinweis (optional)"
              className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="rounded-2xl bg-stone-800 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-40"
            >
              Hinzufügen
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-stone-500">
            {hasPartyTime
              ? 'Wenn Datum und Uhrzeit gesetzt sind, zeigen wir die exakte Uhrzeit an.'
              : 'Ohne Party-Uhrzeit zeigen wir relative Angaben wie „nach 30 Min.“ an.'}
          </p>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center text-sm text-stone-500 print:border-stone-300 print:bg-white print:text-stone-700">
          Noch kein Ablaufplan generiert.
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-2 rounded-2xl border border-orange-100 bg-orange-50/40 px-3 py-3 print:border-stone-200 print:bg-white sm:flex-row sm:items-start"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-stone-800">{item.title}</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-orange-700 shadow-sm">
                    {formatPartyScheduleLabel(item, partyDetails)}
                  </span>
                </div>
                {editable && onUpdateItem ? (
                  <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_180px]">
                    <input
                      value={item.title}
                      onChange={(e) => onUpdateItem(item.id, { title: e.target.value })}
                      className="rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                    <input
                      value={typeof item.minutesFromStart === 'number' ? String(item.minutesFromStart) : ''}
                      onChange={(e) =>
                        onUpdateItem(item.id, {
                          minutesFromStart: parseMinutes(e.target.value),
                        })
                      }
                      inputMode="numeric"
                      className="rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                  </div>
                ) : (
                  item.note && (
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{item.note}</p>
                  )
                )}
                {editable && onUpdateItem && (
                  <textarea
                    value={item.note ?? ''}
                    onChange={(e) => onUpdateItem(item.id, { note: e.target.value })}
                    rows={2}
                    placeholder="Notiz / Hinweis (optional)"
                    className="mt-2 w-full rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                )}
              </div>
              {editable && onRemoveItem && (
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Entfernen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {sortedBackup.length > 0 && (
        <div className="mt-5">
          <button
            onClick={onToggleBackupOpen}
            className="flex w-full items-center justify-between rounded-[1.35rem] border border-amber-100 bg-amber-50/60 px-4 py-3 text-left transition hover:bg-amber-50 print:hidden"
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600 print:text-stone-500">
                Regen-/Backup-Plan
              </p>
              <p className="mt-1 text-sm font-medium text-stone-700">
                {backupOpen ? 'Backup-Plan ausblenden' : 'Regen-/Backup-Plan anzeigen'}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm print:border print:border-stone-300">
              {sortedBackup.length} Vorschläge
            </span>
          </button>

          {backupOpen && (
            <div className="mt-3 space-y-2 print:block">
              {sortedBackup.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 rounded-2xl border border-amber-100 bg-amber-50/40 px-3 py-3 print:border-stone-200 print:bg-white sm:flex-row sm:items-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-stone-800">{item.title}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                        {formatPartyScheduleLabel(item, partyDetails)}
                      </span>
                    </div>
                    {item.note && (
                      <p className="mt-1 text-sm leading-relaxed text-stone-600 print:text-stone-700">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
