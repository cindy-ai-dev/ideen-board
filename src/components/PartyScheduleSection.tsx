import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  onGenerate?: (wishes: string) => void
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
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [minutesFromStart, setMinutesFromStart] = useState('')
  const [wishes, setWishes] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingNote, setEditingNote] = useState('')
  const [editingMinutesFromStart, setEditingMinutesFromStart] = useState('')

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
    setShowAddForm(false)
  }

  function beginEdit(item: PartyScheduleItem) {
    setEditingId(item.id)
    setEditingTitle(item.title)
    setEditingNote(item.note ?? '')
    setEditingMinutesFromStart(
      typeof item.minutesFromStart === 'number' ? String(item.minutesFromStart) : ''
    )
  }

  function saveEdit() {
    if (!editingId || !onUpdateItem) return
    const nextTitle = editingTitle.trim()
    if (!nextTitle) return
    onUpdateItem(editingId, {
      title: nextTitle,
      note: editingNote.trim() || undefined,
      minutesFromStart: parseMinutes(editingMinutesFromStart),
    })
    setEditingId(null)
    setEditingTitle('')
    setEditingNote('')
    setEditingMinutesFromStart('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingTitle('')
    setEditingNote('')
    setEditingMinutesFromStart('')
  }

  return (
    <section className="rounded-[1.75rem] border border-orange-100 bg-white/85 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] print:rounded-none print:border print:border-stone-300 print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 print:text-stone-500">
            {t('schedule.title')}
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 print:text-black">
            {t('schedule.subtitle')}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 print:text-stone-700">
            {t('schedule.description')}
          </p>
        </div>

        {editable && onGenerate && (
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <textarea
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder={t('schedule.wishesPlaceholder')}
              rows={3}
              className="w-full min-w-[min(100%,24rem)] rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100 print:hidden"
            />
            <button
              onClick={() => onGenerate(wishes.trim())}
              disabled={generating}
              className="self-start rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40 print:hidden"
            >
              {generating
                ? t('schedule.generating')
                : items.length > 0
                  ? t('schedule.update')
                  : t('schedule.generate')}
            </button>
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center text-sm text-stone-500 print:border-stone-300 print:bg-white print:text-stone-700">
          {t('schedule.noSchedule')}
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
                {editingId === item.id && editable && onUpdateItem ? (
                  <div className="mt-2 space-y-2">
                    <input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="w-full rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                    />
                    <div className="grid gap-2 lg:grid-cols-[1fr_180px]">
                      <input
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        placeholder={t('schedule.notePlaceholder')}
                        className="rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      />
                      <input
                        value={editingMinutesFromStart}
                        onChange={(e) => setEditingMinutesFromStart(e.target.value)}
                        inputMode="numeric"
                        placeholder={t('schedule.minutesFromStart', { value: '' }).trim()}
                        className="rounded-2xl border border-orange-100 bg-white px-4 py-2.5 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={saveEdit}
                        className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600"
                      >
                        {t('schedule.save')}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-stone-50"
                      >
                        {t('schedule.cancel')}
                      </button>
                    </div>
                  </div>
                ) : item.note ? (
                  <p className="mt-1 text-sm leading-relaxed text-stone-600">{item.note}</p>
                ) : null}
              </div>
              {editable && onUpdateItem && editingId !== item.id && (
                  <button
                    onClick={() => beginEdit(item)}
                    className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-orange-700 transition hover:bg-orange-50"
                  >
                  ✎ {t('overview.edit')}
                  </button>
                )}
                {editable && onRemoveItem && (
                  <button
                    onClick={() => onRemoveItem(item.id)}
                    className="self-start rounded-full px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    {t('schedule.remove')}
                  </button>
                )}
              </div>
          ))}
        </div>
      )}

      {editable && (
        <div className="mt-5 rounded-[1.35rem] border border-amber-100 bg-amber-50/60 p-4 print:hidden">
          {showAddForm ? (
            <>
              <div className="grid gap-2 lg:grid-cols-[1fr_180px]">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-stone-600">{t('schedule.programPoint')}</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('schedule.examplePoint')}
                    className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-stone-600">
                    {hasPartyTime ? t('schedule.hoursAfterStart', { value: '' }).trim() : t('schedule.minutesFromStart', { value: '' }).trim()}
                  </span>
                  <input
                    value={minutesFromStart}
                    onChange={(e) => setMinutesFromStart(e.target.value)}
                    inputMode="numeric"
                    placeholder={t('schedule.exampleMinutes')}
                    className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </label>
              </div>
              <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto]">
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('schedule.notePlaceholder')}
                  className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                />
                <button
                  onClick={handleAdd}
                  disabled={!title.trim()}
                  className="rounded-2xl bg-stone-800 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-40"
                >
                  {t('schedule.add')}
                </button>
              </div>
              <p className="mt-2 text-xs font-medium text-stone-500">
                {hasPartyTime
                  ? t('schedule.withDateHint')
                  : t('schedule.withoutDateHint')}
              </p>
            </>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full rounded-2xl border-2 border-dashed border-orange-200 px-4 py-3 text-sm font-semibold text-orange-700 transition hover:border-orange-400 hover:bg-orange-50"
            >
              {t('schedule.addPoint')}
            </button>
          )}
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
                {t('schedule.backupTitle')}
              </p>
              <p className="mt-1 text-sm font-medium text-stone-700">
                {backupOpen ? t('schedule.hideBackup') : t('schedule.showBackup')}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm print:border print:border-stone-300">
              {t('schedule.backupCount', { count: sortedBackup.length })}
            </span>
          </button>

          {backupOpen && (
            <div id="backup-plan" className="mt-3 space-y-2 print:block">
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
