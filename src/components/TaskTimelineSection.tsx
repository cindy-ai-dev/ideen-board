import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartyDetails, PlanningTaskItem } from '../types'
import {
  formatRelativeTaskLabel,
  formatTaskAbsoluteDate,
  normalizeTaskDaysBeforeParty,
  sortPlanningTasks,
} from '../lib/tasks'

function normalizeTitle(value: string): string {
  return value.trim()
}

function parseDaysBeforeParty(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

interface Props {
  items: PlanningTaskItem[]
  partyDetails: PartyDetails
  editable?: boolean
  generating?: boolean
  selectedIdeasCount?: number
  onGenerate?: () => void
  onToggleItem?: (id: string) => void
  onAddItem?: (item: { title: string; note?: string; daysBeforeParty?: number | null; dueDate?: string | null }) => void
  onRemoveItem?: (id: string) => void
}

export function TaskTimelineSection({
  items,
  partyDetails,
  editable = false,
  generating = false,
  selectedIdeasCount = 0,
  onGenerate,
  onToggleItem,
  onAddItem,
  onRemoveItem,
}: Props) {
  const { t } = useTranslation()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [daysBeforeParty, setDaysBeforeParty] = useState('')
  const [dueDate, setDueDate] = useState('')

  const sorted = useMemo(() => sortPlanningTasks(items, partyDetails), [items, partyDetails])
  const canGenerate = selectedIdeasCount > 0 && typeof onGenerate === 'function'
  const hasPartyDate = Boolean(partyDetails.date)

  function handleAdd() {
    const nextTitle = normalizeTitle(title)
    if (!nextTitle || !onAddItem) return
    onAddItem({
      title: nextTitle,
      note: note.trim() || undefined,
      daysBeforeParty: parseDaysBeforeParty(daysBeforeParty),
      dueDate: dueDate.trim() || null,
    })
    setTitle('')
    setNote('')
    setDaysBeforeParty('')
    setDueDate('')
  }

  return (
    <section className="rounded-[1.75rem] border border-orange-100 bg-white/85 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] print:rounded-none print:border print:border-stone-300 print:bg-white print:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500 print:text-stone-500">
            {t('timeline.title')}
          </p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 print:text-black">
            {t('timeline.subtitle')}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 print:text-stone-700">
            {t('timeline.description')}
          </p>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              onClick={onGenerate}
              disabled={!canGenerate || generating}
              className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40"
            >
              {generating ? t('timeline.generating') : items.length > 0 ? t('timeline.update') : t('timeline.generate')}
            </button>
          </div>
        )}
      </div>

      {editable && (
        <div className="mt-4 rounded-[1.35rem] border border-amber-100 bg-amber-50/60 p-4 print:hidden">
          <div className="grid gap-2 lg:grid-cols-[1fr_170px_170px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-stone-600">{t('timeline.taskLabel')}</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('timeline.taskPlaceholder')}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-stone-600">{t('timeline.daysBeforeLabel')}</span>
              <input
                value={daysBeforeParty}
                onChange={(e) => setDaysBeforeParty(e.target.value)}
                inputMode="numeric"
                placeholder={t('timeline.daysBeforePlaceholder')}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-stone-600">{t('timeline.dateLabel')}</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
              />
            </label>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto]">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('timeline.notePlaceholder')}
              className="rounded-2xl border border-orange-100 bg-white px-4 py-3 text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
            <button
              onClick={handleAdd}
              disabled={!title.trim()}
              className="rounded-2xl bg-stone-800 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-stone-700 disabled:opacity-40"
            >
              {t('timeline.add')}
            </button>
          </div>
          <p className="mt-2 text-xs font-medium text-stone-500">
            {hasPartyDate
              ? t('timeline.withDateHint')
              : t('timeline.withoutDateHint')}
          </p>
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center text-sm text-stone-500 print:border-stone-300 print:bg-white print:text-stone-700">
          {t('timeline.noTasks')}
        </p>
      ) : (
        <div className="mt-5 space-y-2">
          {sorted.map((task) => {
            const absoluteDate = formatTaskAbsoluteDate(task, partyDetails.date)
            const relative = formatRelativeTaskLabel(normalizeTaskDaysBeforeParty(task, partyDetails.date))
            const showAbsolute = Boolean(partyDetails.date) && Boolean(absoluteDate)
            return (
              <div
                key={task.id}
                className="flex flex-col gap-2 rounded-2xl border border-orange-100 bg-orange-50/40 px-3 py-3 sm:flex-row sm:items-start"
              >
                {editable && onToggleItem ? (
                  <button
                    onClick={() => onToggleItem(task.id)}
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm transition ${
                      task.checked
                        ? 'border-amber-400 bg-amber-100 text-amber-700'
                        : 'border-stone-300 bg-white text-stone-400 hover:border-amber-300 hover:text-amber-600'
                    }`}
                    aria-label={task.checked ? t('timeline.markTodo') : t('timeline.markDone')}
                    title={task.checked ? t('timeline.markTodo') : t('timeline.markDone')}
                  >
                    {task.checked ? '✓' : ''}
                  </button>
                ) : (
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm ${
                      task.checked
                        ? 'border-amber-400 bg-amber-100 text-amber-700'
                        : 'border-stone-300 bg-white text-stone-400'
                    }`}
                    aria-hidden="true"
                  >
                    {task.checked ? '✓' : ''}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`font-semibold leading-snug ${
                        task.checked ? 'text-stone-400 line-through' : 'text-stone-800'
                      } print:text-black print:no-underline`}
                    >
                      {task.title}
                    </p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-orange-700 print:border print:border-stone-300 print:bg-white print:text-black">
                      {relative}
                    </span>
                    {showAbsolute && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 print:border print:border-stone-300 print:bg-white print:text-black">
                        {absoluteDate}
                      </span>
                    )}
                  </div>
                  {task.note && (
                    <p className="mt-1 text-sm leading-relaxed text-stone-500 print:text-stone-700">
                      {task.note}
                    </p>
                  )}
                </div>

                {editable && onRemoveItem && (
                <button
                  onClick={() => onRemoveItem(task.id)}
                  className="rounded-full px-2 py-1 text-sm font-medium text-rose-600 transition hover:bg-rose-50 print:hidden"
                >
                    {t('timeline.remove')}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
