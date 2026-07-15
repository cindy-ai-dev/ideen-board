import type { PartyDetails, PlanningTaskItem } from '../types'
import i18n from '../i18n'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function isEnglishLocale(): boolean {
  return (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
}

function parsePartyDate(date: string): Date | null {
  if (!date) return null
  const parsed = new Date(`${date}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(isEnglishLocale() ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function normalizeTaskDaysBeforeParty(task: PlanningTaskItem, partyDate?: string): number | null {
  if (typeof task.daysBeforeParty === 'number' && Number.isFinite(task.daysBeforeParty)) {
    return task.daysBeforeParty
  }
  if (!partyDate || !task.dueDate) return null
  const party = parsePartyDate(partyDate)
  const due = parsePartyDate(task.dueDate)
  if (!party || !due) return null
  return Math.round((party.getTime() - due.getTime()) / MS_PER_DAY)
}

export function formatRelativeTaskLabel(daysBeforeParty: number | null | undefined): string {
  const english = isEnglishLocale()
  if (typeof daysBeforeParty !== 'number' || !Number.isFinite(daysBeforeParty)) {
    return english ? 'No date' : 'Ohne Termin'
  }
  if (daysBeforeParty <= 0) {
    if (daysBeforeParty === 0) return english ? 'today' : 'heute'
    return english
      ? `${Math.abs(daysBeforeParty)} days after the party`
      : `${Math.abs(daysBeforeParty)} Tage nach der Party`
  }
  if (daysBeforeParty === 1) return english ? '1 day before' : '1 Tag vorher'
  if (daysBeforeParty % 7 === 0) {
    const weeks = Math.round(daysBeforeParty / 7)
    return weeks === 1
      ? english
        ? '1 week before'
        : '1 Woche vorher'
      : english
        ? `${weeks} weeks before`
        : `${weeks} Wochen vorher`
  }
  return english ? `${daysBeforeParty} days before` : `${daysBeforeParty} Tage vorher`
}

export function formatTaskAbsoluteDate(
  task: PlanningTaskItem,
  partyDate?: string
): string | null {
  const daysBeforeParty = normalizeTaskDaysBeforeParty(task, partyDate)
  if (!partyDate || typeof daysBeforeParty !== 'number' || !Number.isFinite(daysBeforeParty)) return null
  const party = parsePartyDate(partyDate)
  if (!party) return null
  const absolute = new Date(party.getTime() - daysBeforeParty * MS_PER_DAY)
  return formatDate(absolute)
}

export function sortPlanningTasks(items: PlanningTaskItem[], partyDetails: PartyDetails): PlanningTaskItem[] {
  return [...items].sort((left, right) => {
    const leftDays = normalizeTaskDaysBeforeParty(left, partyDetails.date)
    const rightDays = normalizeTaskDaysBeforeParty(right, partyDetails.date)
    const leftHas = typeof leftDays === 'number' && Number.isFinite(leftDays)
    const rightHas = typeof rightDays === 'number' && Number.isFinite(rightDays)
    if (leftHas && rightHas && leftDays !== rightDays) return (rightDays as number) - (leftDays as number)
    if (leftHas !== rightHas) return leftHas ? -1 : 1
    return left.createdAt - right.createdAt
  })
}
