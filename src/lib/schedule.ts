import type { PartyDetails, PartyScheduleBackupItem, PartyScheduleItem } from '../types'
import i18n from '../i18n'

const MS_PER_MINUTE = 60 * 1000

function isEnglishLocale(): boolean {
  return (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
}

function parsePartyStart(details: PartyDetails): Date | null {
  if (!details.date || !details.time) return null
  const start = new Date(`${details.date}T${details.time}`)
  return Number.isNaN(start.getTime()) ? null : start
}

function formatClock(date: Date): string {
  return new Intl.DateTimeFormat(isEnglishLocale() ? 'en-US' : 'de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatRelative(minutes?: number | null): string {
  const english = isEnglishLocale()
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return english ? 'No time' : 'Ohne Zeit'
  if (minutes <= 0) return english ? 'Start' : 'Start'
  if (minutes < 60) return english ? `${minutes} min after start` : `nach ${minutes} Min.`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (rest === 0) return english ? `${hours} h after start` : `nach ${hours} Std.`
  return english ? `${hours} h ${rest} min after start` : `nach ${hours} Std. ${rest} Min.`
}

type SortableScheduleItem = Pick<
  PartyScheduleItem,
  'id' | 'title' | 'note' | 'minutesFromStart' | 'source' | 'createdAt'
> &
  Partial<Pick<PartyScheduleBackupItem, 'id' | 'title' | 'note' | 'minutesFromStart' | 'source' | 'createdAt'>>

export function sortPartySchedule<T extends SortableScheduleItem>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftHas = typeof left.minutesFromStart === 'number' && Number.isFinite(left.minutesFromStart)
    const rightHas = typeof right.minutesFromStart === 'number' && Number.isFinite(right.minutesFromStart)
    if (leftHas && rightHas && left.minutesFromStart !== right.minutesFromStart) {
      return (left.minutesFromStart as number) - (right.minutesFromStart as number)
    }
    if (leftHas !== rightHas) return leftHas ? -1 : 1
    return left.createdAt - right.createdAt
  })
}

export function formatPartyScheduleLabel(
  item: PartyScheduleItem,
  partyDetails: PartyDetails
): string {
  const start = parsePartyStart(partyDetails)
  const minutes = typeof item.minutesFromStart === 'number' && Number.isFinite(item.minutesFromStart)
    ? Math.max(0, Math.round(item.minutesFromStart))
    : null

  if (start && minutes !== null) {
    return formatClock(new Date(start.getTime() + minutes * MS_PER_MINUTE))
  }
  return formatRelative(minutes)
}

export function normalizePartyScheduleMinutes(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
  }
  return null
}
