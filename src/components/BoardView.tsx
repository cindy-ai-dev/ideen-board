import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartyDetails, Tile } from '../types'
import { useBoard } from '../lib/storage'
import { saveBoard as saveBoardRemote } from '../lib/boardApi'
import {
  generateIdeas,
  generateInvitationText,
  generateMoreIdeas,
  generatePlanningTasks,
  generatePartySchedule,
  generateShoppingList,
} from '../lib/claude'
import { fetchLinkPreview } from '../lib/og'
import { formatPartyAddress } from '../lib/location'
import i18n from '../i18n'
import { TileCard, categoryColor } from './TileCard'
import { TileEditor } from './TileEditor'
import { WeatherForecastCard } from './WeatherForecastCard'
import { PartyDetailsFields } from './PartyDetailsFields'
import { PartyScheduleSection } from './PartyScheduleSection'
import { ShoppingListSection } from './ShoppingListSection'
import { TaskTimelineSection } from './TaskTimelineSection'
import type { RawShoppingItem, ShoppingSourceTile } from '../lib/prompts'
import { createRsvpToken, type PlanningTaskItem, type ShoppingListItem } from '../types'

function normalizeShoppingKey(section: string, label: string): string {
  return `${section.trim().toLowerCase()}::${label.trim().toLowerCase()}`
}

function isPartyDetailsEmpty(details: PartyDetails): boolean {
  return !(
    details.forWhom.trim() ||
    details.theme.trim() ||
    details.age !== null ||
    details.preferences.trim() ||
    details.streetAddress.trim() ||
    details.city.trim() ||
    details.date ||
    details.time ||
    details.guestCount !== null ||
    details.budgetLimitEuro !== null ||
    details.responseDeadline.trim()
  )
}

function formatResponseDeadline(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const english = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
  return new Intl.DateTimeFormat(english ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function isDeadlineExpired(value: string): boolean {
  if (!value) return false
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  parsed.setHours(0, 0, 0, 0)
  return parsed < today
}

function formatPartyDate(date: string, time: string): string {
  const english = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
  if (!date) return english ? 'No date' : 'Ohne Datum'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  const datePart = new Intl.DateTimeFormat(english ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
  return time ? (english ? `${datePart}, ${time}` : `${datePart}, ${time} Uhr`) : datePart
}

function formatDeadline(value: string): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  const english = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
  return new Intl.DateTimeFormat(english ? 'en-US' : 'de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function buildGuestReminderText(options: {
  partyName: string
  partyDate: string
  partyAddress?: string
  responseDeadline?: string
  rsvpUrl: string
}): string {
  const addressText = options.partyAddress ? i18n.t('overview.reminderAddress', { partyAddress: options.partyAddress }) : ''
  const deadlineText = options.responseDeadline ? i18n.t('overview.reminderDeadline', { deadline: options.responseDeadline }) : ''
  return i18n.t('overview.reminderText', {
    partyName: options.partyName,
    partyDate: options.partyDate,
    addressText,
    deadlineText,
    rsvpUrl: options.rsvpUrl,
  })
}

function buildRsvpShareText(options: {
  partyName: string
  partyDate: string
  partyAddress?: string
  rsvpUrl: string
}): string {
  const addressText = options.partyAddress ? i18n.t('overview.reminderAddress', { partyAddress: options.partyAddress }) : ''
  return i18n.t('overview.rsvpShareText', {
    partyName: options.partyName,
    partyDate: options.partyDate,
    addressText,
    rsvpUrl: options.rsvpUrl,
  })
}

function normalizePrice(price: number | string | null | undefined): number | null {
  if (typeof price === 'number') {
    return Number.isFinite(price) && price >= 0 ? price : null
  }
  if (typeof price === 'string') {
    const parsed = Number.parseFloat(price.trim().replace(',', '.'))
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  return null
}

function mergeShoppingSuggestions(
  current: ShoppingListItem[],
  suggestions: RawShoppingItem[]
): ShoppingListItem[] {
  const currentByKey = new Map(current.map((item) => [normalizeShoppingKey(item.section, item.label), item]))
  const manualItems = current.filter((item) => item.source === 'manual')
  const next: ShoppingListItem[] = [...manualItems]
  const seen = new Set(next.map((item) => normalizeShoppingKey(item.section, item.label)))

  for (const suggestion of suggestions) {
    const label = suggestion.label.trim()
    if (!label) continue
    const section = suggestion.section.trim() || 'Sonstiges'
    const key = normalizeShoppingKey(section, label)
    if (seen.has(key)) continue
    const existing = currentByKey.get(key)
    next.push({
      id: existing?.id ?? crypto.randomUUID(),
      section,
      label,
      note: suggestion.note.trim() || undefined,
      priceEuro: normalizePrice(suggestion.priceEuro),
      checked: existing?.checked ?? false,
      source: 'ai',
      createdAt: existing?.createdAt ?? Date.now(),
    })
    seen.add(key)
  }

  return next
}

function mergePlanningSuggestions(
  current: PlanningTaskItem[],
  suggestions: { title: string; note: string; daysBeforeParty: number }[]
): PlanningTaskItem[] {
  const currentByKey = new Map(current.map((item) => [item.title.trim().toLowerCase(), item]))
  const manualItems = current.filter((item) => item.source === 'manual')
  const next: PlanningTaskItem[] = [...manualItems]
  const seen = new Set(next.map((item) => item.title.trim().toLowerCase()))

  for (const suggestion of suggestions) {
    const title = suggestion.title.trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    const existing = currentByKey.get(key)
    next.push({
      id: existing?.id ?? crypto.randomUUID(),
      title,
      note: suggestion.note.trim() || undefined,
      daysBeforeParty:
        typeof suggestion.daysBeforeParty === 'number' && Number.isFinite(suggestion.daysBeforeParty)
          ? Math.max(0, Math.round(suggestion.daysBeforeParty))
          : existing?.daysBeforeParty ?? null,
      dueDate: existing?.dueDate ?? null,
      checked: existing?.checked ?? false,
      source: 'ai',
      createdAt: existing?.createdAt ?? Date.now(),
    })
    seen.add(key)
  }

  return next
}

type ScheduleLikeItem = {
  id: string
  title: string
  note?: string
  minutesFromStart?: number | null
  source: 'ai' | 'manual'
  createdAt: number
}

function mergeScheduleSuggestions(
  current: ScheduleLikeItem[],
  suggestions: { title: string; note: string; minutesFromStart: number }[]
): ScheduleLikeItem[] {
  const currentByKey = new Map(current.map((item) => [item.title.trim().toLowerCase(), item]))
  const manualItems = current.filter((item) => item.source === 'manual')
  const next: ScheduleLikeItem[] = [...manualItems]
  const seen = new Set(next.map((item) => item.title.trim().toLowerCase()))

  for (const suggestion of suggestions) {
    const title = suggestion.title.trim()
    if (!title) continue
    const key = title.toLowerCase()
    if (seen.has(key)) continue
    const existing = currentByKey.get(key)
    next.push({
      id: existing?.id ?? crypto.randomUUID(),
      title,
      note: suggestion.note.trim() || undefined,
      minutesFromStart:
        typeof suggestion.minutesFromStart === 'number' && Number.isFinite(suggestion.minutesFromStart)
          ? Math.max(0, Math.round(suggestion.minutesFromStart))
          : existing?.minutesFromStart ?? null,
      source: 'ai',
      createdAt: existing?.createdAt ?? Date.now(),
    })
    seen.add(key)
  }

  return next
}

// Die komplette Ansicht EINES Boards. Wird in App per key={boardId}
// eingebunden – beim Board-Wechsel baut React die Komponente neu auf
// und useBoard lädt sauber den Stand des neuen Boards.
export type BoardSection = 'overview' | 'guests' | 'ideas' | 'shopping' | 'timeline' | 'schedule'

export function BoardView({
  boardId,
  onOpenPlan,
  onDuplicateBoard,
  activeSection = 'overview',
}: {
  boardId: string
  onOpenPlan?: () => void
  onDuplicateBoard?: () => void | Promise<void>
  activeSection?: BoardSection
}) {
  const { t } = useTranslation()
  const [board, setBoard] = useBoard(boardId)
  const [urlInput, setUrlInput] = useState('')
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingLink, setLoadingLink] = useState(false)
  const [loadingShopping, setLoadingShopping] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [loadingInvitation, setLoadingInvitation] = useState(false)
  const [invitationText, setInvitationText] = useState('')
  const [invitationCopyState, setInvitationCopyState] = useState<'idle' | 'copied'>('idle')
  const [scheduleBackupOpen, setScheduleBackupOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.location.hash === '#backup-plan'
  })
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderCopyState, setReminderCopyState] = useState<'idle' | 'copied'>('idle')
  const [reminderText, setReminderText] = useState('')
  const [editingDetails, setEditingDetails] = useState(() => isPartyDetailsEmpty(board.partyDetails))
  const shareTimerRef = useRef<number | null>(null)
  const reminderTimerRef = useRef<number | null>(null)
  const invitationTimerRef = useRef<number | null>(null)
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'de'
  // Welche Kategorie gerade Nachschub lädt (null = keine)
  const [loadingMore, setLoadingMore] = useState<string | null>(null)
  // Editor: 'new' = neue eigene Kachel, Tile = diese Kachel bearbeiten
  const [editor, setEditor] = useState<'new' | Tile | null>(null)
  // Über welcher Kategorie gerade eine Kachel schwebt (fürs Aufleuchten)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Kacheln nach Kategorie gruppieren – Reihenfolge: wie sie zuerst auftauchen
  const grouped = useMemo(() => {
    const map = new Map<string, typeof board.tiles>()
    for (const tile of board.tiles) {
      const list = map.get(tile.category) ?? []
      list.push(tile)
      map.set(tile.category, list)
    }
    return map
  }, [board.tiles])

  const ideaCategoryOptions = useMemo(() => {
    const baseCategories = [
      t('ideas.linkCategory'),
      t('shopping.section.deco'),
      t('shopping.section.food'),
      t('shopping.section.drinks'),
      t('shopping.section.tableware'),
      t('shopping.section.baking'),
      t('shopping.section.partyFavours'),
      t('shopping.section.games'),
      t('shopping.section.entertainment'),
      t('shopping.section.invitation'),
      t('shopping.section.schedule'),
      t('shopping.section.shopping'),
      t('shopping.section.misc'),
    ]
    const seen = new Set<string>()
    const next: string[] = []
    for (const category of [...baseCategories, ...grouped.keys()]) {
      const trimmed = category.trim()
      const normalized = trimmed.toLowerCase()
      if (!trimmed || seen.has(normalized)) continue
      seen.add(normalized)
      next.push(trimmed)
    }
    return next
  }, [grouped, t])

  function updatePartyDetails(next: PartyDetails) {
    setBoard((current) => ({
      ...current,
      topic: next.forWhom.trim() || current.topic,
      partyDetails: next,
    }))
  }

  useEffect(() => {
    return () => {
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current)
      if (reminderTimerRef.current !== null) window.clearTimeout(reminderTimerRef.current)
      if (invitationTimerRef.current !== null) window.clearTimeout(invitationTimerRef.current)
    }
  }, [])

  async function ensureRsvpToken(): Promise<string> {
    let token = board.rsvpToken.trim()
    if (!token) {
      token = createRsvpToken()
      const nextBoard = { ...board, rsvpToken: token }
      setBoard(nextBoard)
      try {
        await saveBoardRemote(
          boardId,
          nextBoard.partyDetails.forWhom.trim() || nextBoard.topic.trim() || 'Neues Board',
          nextBoard
        )
      } catch {
        // Token bleibt lokal nutzbar und wird beim nächsten Autosave mitgespeichert.
      }
    }
    return token
  }

  async function buildRsvpUrl(token?: string) {
    const safeToken = token ?? (await ensureRsvpToken())
    const url = new URL(window.location.href)
    url.search = ''
    url.searchParams.set('rsvp', safeToken)
    url.searchParams.set('token', safeToken)
    url.searchParams.set('rsvpToken', safeToken)
    url.searchParams.set('board', boardId)
    url.searchParams.set('boardId', boardId)
    return url.toString()
  }

  async function buildRsvpShareTextForBoard(token?: string) {
    const partyName = board.partyDetails.forWhom.trim() || board.topic.trim() || 'deiner Party'
    const partyDate = formatPartyDate(board.partyDetails.date, board.partyDetails.time)
    const partyAddress = formatPartyAddress(board.partyDetails.streetAddress, board.partyDetails.city)
    const rsvpUrl = await buildRsvpUrl(token)
    return buildRsvpShareText({
      partyName,
      partyDate,
      partyAddress,
      rsvpUrl,
    })
  }

  async function openReminderDialog() {
    const token = await ensureRsvpToken()
    const partyName = board.partyDetails.forWhom.trim() || board.topic.trim() || 'deine Party'
    const partyDate = formatPartyDate(board.partyDetails.date, board.partyDetails.time)
    const partyAddress = formatPartyAddress(board.partyDetails.streetAddress, board.partyDetails.city)
    const deadline = formatDeadline(board.partyDetails.responseDeadline) ?? undefined
    const text = buildGuestReminderText({
      partyName,
      partyDate,
      partyAddress: partyAddress || undefined,
      responseDeadline: deadline,
      rsvpUrl: await buildRsvpUrl(token),
    })
    setReminderText(text)
    setReminderCopyState('idle')
    setReminderOpen(true)
  }

  async function handleGenerate() {
    if (loadingIdeas) return
    setError(null)
    setLoadingIdeas(true)
    try {
      const ideas = await generateIdeas(board.topic, board.partyDetails, boardId, language)
      setBoard((current) => ({
        ...current,
        topic: current.topic || current.partyDetails.forWhom.trim(),
        tiles: [...current.tiles, ...ideas],
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ideas.ideasError'))
    } finally {
      setLoadingIdeas(false)
    }
  }

  async function handleMoreIdeas(category: string) {
    if (loadingMore) return
    setError(null)
    setLoadingMore(category)
    try {
      const existing = board.tiles
        .filter((t) => t.category === category)
        .map((t) => t.title)
      const ideas = await generateMoreIdeas(board.topic, board.partyDetails, category, existing, boardId, language)
      setBoard((current) => ({
        ...current,
        tiles: [...current.tiles, ...ideas],
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ideas.ideasError'))
    } finally {
      setLoadingMore(null)
    }
  }

  async function handleAddLink() {
    let url = urlInput.trim()
    if (!url || loadingLink) return
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    setError(null)
    setLoadingLink(true)
    try {
      const tile = await fetchLinkPreview(url, boardId, t('ideas.linkPreviewFallback'))
      setBoard((current) => ({ ...current, tiles: [...current.tiles, tile] }))
      setUrlInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ideas.linkError'))
    } finally {
      setLoadingLink(false)
    }
  }

  async function handleShareRsvpLink() {
    const url = await buildRsvpUrl()
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current)
      shareTimerRef.current = window.setTimeout(() => {
        setShareState('idle')
        shareTimerRef.current = null
      }, 1800)
    } catch {
      window.prompt(t('overview.overviewGuestLink'), url)
      setShareState('copied')
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current)
      shareTimerRef.current = window.setTimeout(() => {
        setShareState('idle')
        shareTimerRef.current = null
      }, 1800)
    }
  }

  async function handleCopyReminderText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setReminderCopyState('copied')
      if (reminderTimerRef.current !== null) window.clearTimeout(reminderTimerRef.current)
      reminderTimerRef.current = window.setTimeout(() => {
        setReminderCopyState('idle')
        reminderTimerRef.current = null
      }, 1800)
    } catch {
      window.prompt(t('overview.reminderCopy'), text)
      setReminderCopyState('copied')
      if (reminderTimerRef.current !== null) window.clearTimeout(reminderTimerRef.current)
      reminderTimerRef.current = window.setTimeout(() => {
        setReminderCopyState('idle')
        reminderTimerRef.current = null
      }, 1800)
    }
  }

  function handleOpenWhatsApp(text: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  async function handleShareRsvpLinkWhatsApp() {
    handleOpenWhatsApp(await buildRsvpShareTextForBoard())
  }

  async function handleGenerateInvitation() {
    if (loadingInvitation) return
    setError(null)
    setLoadingInvitation(true)
    setInvitationCopyState('idle')
    try {
      const text = await generateInvitationText(board.topic, board.partyDetails, language)
      setInvitationText(text.trim())
    } catch {
      setError(t('overview.invitationError'))
    } finally {
      setLoadingInvitation(false)
    }
  }

  function handleShareInvitation() {
    handleOpenWhatsApp(invitationText)
  }

  async function handleCopyInvitation() {
    if (!invitationText.trim()) return
    try {
      await navigator.clipboard.writeText(invitationText)
    } catch {
      window.prompt(t('overview.invitationCopy'), invitationText)
    }
    setInvitationCopyState('copied')
    if (invitationTimerRef.current !== null) window.clearTimeout(invitationTimerRef.current)
    invitationTimerRef.current = window.setTimeout(() => {
      setInvitationCopyState('idle')
      invitationTimerRef.current = null
    }, 1800)
  }

  async function handleGenerateShoppingList() {
    if (loadingShopping) return
    const selectedTiles: ShoppingSourceTile[] = board.tiles
      .filter((tile) => tile.selected)
      .map((tile) => ({
        title: tile.title,
        description: tile.description,
        category: tile.category,
      }))

    if (selectedTiles.length === 0) {
      setError(t('shopping.selectedHint'))
      return
    }

    setError(null)
    setLoadingShopping(true)
    try {
      const suggestions = await generateShoppingList(board.topic, board.partyDetails, selectedTiles, language)
      setBoard((current) => ({
        ...current,
        shoppingList: mergeShoppingSuggestions(current.shoppingList, suggestions),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('shopping.loadError'))
    } finally {
      setLoadingShopping(false)
    }
  }

  async function handleGenerateTasks() {
    if (loadingTasks) return
    const selectedTiles: ShoppingSourceTile[] = board.tiles
      .filter((tile) => tile.selected)
      .map((tile) => ({
        title: tile.title,
        description: tile.description,
        category: tile.category,
      }))

    if (selectedTiles.length === 0) {
      setError(t('timeline.selectFirst'))
      return
    }

    setError(null)
    setLoadingTasks(true)
    try {
      const tasks = await generatePlanningTasks(board.topic, board.partyDetails, selectedTiles, language)
      setBoard((current) => ({
        ...current,
        planningTasks: mergePlanningSuggestions(current.planningTasks, tasks),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('timeline.loadError'))
    } finally {
      setLoadingTasks(false)
    }
  }

  async function handleGenerateScheduleWithWishes(wishes: string) {
    if (loadingSchedule) return
    const selectedTiles: ShoppingSourceTile[] = board.tiles
      .filter((tile) => tile.selected)
      .map((tile) => ({
        title: tile.title,
        description: tile.description,
        category: tile.category,
      }))

    setError(null)
    setLoadingSchedule(true)
    try {
      const { items, backupItems } = await generatePartySchedule(
        board.topic,
        board.partyDetails,
        selectedTiles,
        wishes,
        language
      )
      setBoard((current) => ({
        ...current,
        partySchedule: mergeScheduleSuggestions(current.partySchedule, items),
        partyScheduleBackup: mergeScheduleSuggestions(current.partyScheduleBackup, backupItems),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('schedule.loadError'))
    } finally {
      setLoadingSchedule(false)
    }
  }

  function handleDelete(id: string) {
    setBoard((current) => ({ ...current, tiles: current.tiles.filter((t) => t.id !== id) }))
  }

  function handleToggleSelected(id: string) {
    setBoard((current) => ({
      ...current,
      tiles: current.tiles.map((t) => (t.id === id ? { ...t, selected: !t.selected } : t)),
    }))
  }

  function handleToggleShoppingItem(id: string) {
    setBoard((current) => ({
      ...current,
      shoppingList: current.shoppingList.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      ),
    }))
  }

  function handleAddShoppingItem(item: { label: string; section: string; priceEuro?: number | null }) {
    setBoard((current) => ({
      ...current,
      shoppingList: [
        ...current.shoppingList,
        {
          id: crypto.randomUUID(),
          section: item.section,
          label: item.label,
          priceEuro: normalizePrice(item.priceEuro),
          checked: false,
          source: 'manual',
          createdAt: Date.now(),
        },
      ],
    }))
  }

  function handleTogglePlanningTask(id: string) {
    setBoard((current) => ({
      ...current,
      planningTasks: current.planningTasks.map((task) =>
        task.id === id ? { ...task, checked: !task.checked } : task
      ),
    }))
  }

  function handleAddPlanningTask(item: {
    title: string
    note?: string
    daysBeforeParty?: number | null
    dueDate?: string | null
  }) {
    setBoard((current) => ({
      ...current,
      planningTasks: [
        ...current.planningTasks,
        {
          id: crypto.randomUUID(),
          title: item.title,
          note: item.note,
          daysBeforeParty: typeof item.daysBeforeParty === 'number' ? item.daysBeforeParty : null,
          dueDate: item.dueDate ?? null,
          checked: false,
          source: 'manual',
          createdAt: Date.now(),
        },
      ],
    }))
  }

  function handleAddScheduleItem(item: {
    title: string
    note?: string
    minutesFromStart?: number | null
  }) {
    setBoard((current) => ({
      ...current,
      partySchedule: [
        ...current.partySchedule,
        {
          id: crypto.randomUUID(),
          title: item.title,
          note: item.note,
          minutesFromStart: typeof item.minutesFromStart === 'number' ? item.minutesFromStart : null,
          source: 'manual',
          createdAt: Date.now(),
        },
      ],
    }))
  }

  function handleUpdateScheduleItem(
    id: string,
    patch: { title?: string; note?: string; minutesFromStart?: number | null }
  ) {
    setBoard((current) => ({
      ...current,
      partySchedule: current.partySchedule.map((item) =>
        item.id === id
          ? {
              ...item,
              ...(typeof patch.title === 'string' ? { title: patch.title } : {}),
              ...(typeof patch.note === 'string' ? { note: patch.note } : {}),
              ...(patch.minutesFromStart === null ||
              typeof patch.minutesFromStart === 'number'
                ? { minutesFromStart: patch.minutesFromStart }
                : {}),
            }
          : item
      ),
    }))
  }

  function handleRemoveScheduleItem(id: string) {
    setBoard((current) => ({
      ...current,
      partySchedule: current.partySchedule.filter((item) => item.id !== id),
    }))
  }

  function handleToggleScheduleBackupSection() {
    setScheduleBackupOpen((current) => !current)
  }

  function handleRemovePlanningTask(id: string) {
    setBoard((current) => ({
      ...current,
      planningTasks: current.planningTasks.filter((task) => task.id !== id),
    }))
  }

  function handleRemoveShoppingItem(id: string) {
    setBoard((current) => ({
      ...current,
      shoppingList: current.shoppingList.filter((item) => item.id !== id),
    }))
  }

  // Beim Drop: Kachel-ID aus dem dataTransfer holen und die Kategorie
  // der Kachel umschreiben – mehr ist Verschieben nicht.
  function handleDrop(category: string, e: DragEvent) {
    e.preventDefault()
    setDragOver(null)
    const tileId = e.dataTransfer.getData('text/plain')
    if (!tileId) return
    setBoard((current) => ({
      ...current,
      tiles: current.tiles.map((t) => (t.id === tileId ? { ...t, category } : t)),
    }))
  }

  function handleEditorSave(values: {
    title: string
    description: string
    category: string
    image: string
  }) {
    if (editor === 'new') {
      const tile: Tile = {
        id: crypto.randomUUID(),
        boardId,
        kind: 'idea',
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        image: values.image || undefined,
        selected: false,
        createdAt: Date.now(),
      }
      setBoard((current) => ({ ...current, tiles: [...current.tiles, tile] }))
    } else if (editor) {
      setBoard((current) => ({
        ...current,
        tiles: current.tiles.map((t) =>
          t.id === editor.id
            ? {
                ...t,
                title: values.title,
                description: values.description || undefined,
                category: values.category,
                image: values.image || undefined,
                selected: editor.selected,
              }
            : t
        ),
      }))
    }
    setEditor(null)
  }

  const showOverview = activeSection === 'overview'
  const showGuests = activeSection === 'guests'
  const showIdeas = activeSection === 'ideas'
  const showShopping = activeSection === 'shopping'
  const showTimeline = activeSection === 'timeline'
  const showSchedule = activeSection === 'schedule'
  const hasPartyDetails = !isPartyDetailsEmpty(board.partyDetails)
  const showDetailsEditor = showOverview && (editingDetails || !hasPartyDetails)
  const showSummary = showOverview && hasPartyDetails && !editingDetails
  const respondedGuests = board.partyDetails.guests.filter(
    (guest) => guest.status === 'zugesagt' || guest.status === 'abgesagt'
  ).length
  const pendingGuests = board.partyDetails.guests.filter((guest) => guest.status === 'eingeladen')
  const responseDeadlineLabel = formatResponseDeadline(board.partyDetails.responseDeadline)
  const responseDeadlineExpired = isDeadlineExpired(board.partyDetails.responseDeadline)
  const canPrepareReminder = pendingGuests.length > 0
  const english = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('en')
  const currencyFormatter = new Intl.NumberFormat(english ? 'en-US' : 'de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  })
  const summaryCards = useMemo(() => {
    const details = board.partyDetails
    const cards: Array<{ label: string; value: string }> = []
    if (details.forWhom.trim()) cards.push({ label: t('details.forWhom'), value: details.forWhom.trim() })
    if (details.theme.trim()) cards.push({ label: t('details.theme'), value: details.theme.trim() })
    if (typeof details.age === 'number' && details.age > 0) {
      cards.push({
        label: t('details.age'),
        value: `${Math.round(details.age)} ${english ? 'years' : 'Jahre'}`,
      })
    }
    const address = formatPartyAddress(details.streetAddress, details.city)
    if (address) cards.push({ label: `${t('details.streetAddress')} / ${t('details.city')}`, value: address })
    if (details.date || details.time) {
      cards.push({ label: `${t('details.date')} / ${t('details.time')}`, value: formatPartyDate(details.date, details.time) })
    }
    if (details.guestCount !== null) {
      cards.push({
        label: t('details.guestCount'),
        value: String(details.guestCount),
      })
    }
    if (details.budgetLimitEuro !== null) {
      cards.push({
        label: t('details.budgetLimit'),
        value: currencyFormatter.format(details.budgetLimitEuro),
      })
    }
    if (details.responseDeadline.trim()) {
      cards.push({ label: t('details.responseDeadline'), value: formatResponseDeadline(details.responseDeadline) ?? details.responseDeadline })
    }
    if (details.preferences.trim()) {
      cards.push({ label: t('details.preferences'), value: details.preferences.trim() })
    }
    return cards
  }, [board.partyDetails, currencyFormatter, english, t])

  useEffect(() => {
    if (!showOverview) setEditingDetails(false)
  }, [showOverview])

  useEffect(() => {
    if (!showSchedule) return
    if (typeof window === 'undefined') return
    if (window.location.hash === '#backup-plan') {
      setScheduleBackupOpen(true)
    }
  }, [showSchedule])

  return (
    <>
      {(showOverview || showGuests) && (
        <section className="mb-8 rounded-[1.85rem] border border-white bg-white/80 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] backdrop-blur sm:p-6">
          <div className="mb-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">
                {showGuests ? t('overview.guestTitle') : t('overview.title')}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
                {showGuests
                  ? board.partyDetails.forWhom || t('boards.activePartyFallback')
                  : board.partyDetails.forWhom || t('boards.activePartyFallback')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
                {showGuests
                  ? t('overview.guestSubtitle')
                  : t('overview.subtitle')}
              </p>
              </div>
              {showOverview && onDuplicateBoard && (
                <div className="flex flex-wrap gap-2">
                  {onDuplicateBoard && (
                    <button
                      onClick={() => void onDuplicateBoard()}
                      className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      {t('boards.fromTemplate')}
                    </button>
                  )}
                  <button
                    onClick={() => setEditingDetails((current) => !current)}
                    className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                  >
                    {editingDetails ? t('overview.back') : t('overview.edit')}
                  </button>
                </div>
              )}
            </div>

            {showSummary && (
              <div className="w-full rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-sm leading-relaxed text-stone-600">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">{t('overview.partyAtAGlance')}</p>
                {summaryCards.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {summaryCards.map((card) => (
                      <div key={`${card.label}:${card.value}`} className="rounded-xl bg-white/80 px-3 py-2.5 shadow-sm">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                          {card.label}
                        </p>
                        <p className="mt-0.5 text-sm font-medium text-stone-700">
                          {card.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-orange-200 bg-white/70 px-4 py-6 text-center text-stone-500">
                    {t('overview.noDetails')}
                  </div>
                )}
              </div>
            )}

            {showOverview && (
              <WeatherForecastCard partyDetails={board.partyDetails} />
            )}

            {showOverview && !editingDetails && (
              <div className="overflow-hidden rounded-[1.5rem] border border-orange-100 bg-gradient-to-br from-amber-50 via-orange-50/80 to-rose-50 p-4 shadow-[0_10px_28px_rgba(194,104,45,0.09)] sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-500">
                      {t('overview.invitationEyebrow')}
                    </p>
                    <h3 className="mt-1.5 text-xl font-extrabold tracking-tight text-stone-800">
                      {t('overview.invitationTitle')}
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-stone-500">
                      {t('overview.invitationDescription')}
                    </p>
                  </div>
                  {!invitationText && (
                    <button
                      type="button"
                      onClick={() => void handleGenerateInvitation()}
                      disabled={loadingInvitation}
                      className="shrink-0 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:cursor-wait disabled:opacity-60"
                    >
                      {loadingInvitation ? t('overview.invitationGenerating') : t('overview.invitationGenerate')}
                    </button>
                  )}
                </div>

                {invitationText && (
                  <div className="mt-4">
                    <div className="rounded-2xl border border-white/90 bg-white/85 p-4 shadow-sm">
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-stone-400" htmlFor="invitation-text">
                        {t('overview.invitationTextLabel')}
                      </label>
                      <textarea
                        id="invitation-text"
                        value={invitationText}
                        onChange={(event) => {
                          setInvitationText(event.target.value)
                          setInvitationCopyState('idle')
                        }}
                        rows={8}
                        className="mt-2 w-full resize-y rounded-xl border border-orange-100 bg-amber-50/40 px-3 py-3 text-sm leading-relaxed text-stone-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyInvitation()}
                        className="rounded-xl border border-orange-200 bg-white px-3.5 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                      >
                        {invitationCopyState === 'copied' ? t('common.copied') : t('overview.invitationCopy')}
                      </button>
                      <button
                        type="button"
                        onClick={handleShareInvitation}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        {t('overview.invitationShareWhatsApp')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleGenerateInvitation()}
                        disabled={loadingInvitation}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {loadingInvitation ? t('overview.invitationGenerating') : t('overview.invitationRegenerate')}
                      </button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
          </div>

          {showDetailsEditor && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
              <PartyDetailsFields
                value={board.partyDetails}
                onChange={updatePartyDetails}
                onShareRsvpLink={handleShareRsvpLink}
                onShareRsvpLinkWhatsApp={handleShareRsvpLinkWhatsApp}
                shareLabel={shareState === 'copied' ? t('overview.reminderGuestLinkCopied') : t('overview.reminderGuestLinkCopy')}
                shareWhatsAppLabel={t('overview.overviewGuestLinkWhatsApp')}
                showDetails
                showGuestList={false}
                showCalendar
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setEditingDetails(false)}
                  className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600"
                >
                  {t('overview.overviewDetailsSaved')}
                </button>
              </div>
            </div>
          )}

          {showGuests && (
            <div className="space-y-4">
              <div className="rounded-[1.4rem] border border-orange-100 bg-orange-50/70 px-4 py-3 shadow-sm">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-semibold text-stone-700">
                      {t('overview.totalGuestsResponded', {
                        responded: respondedGuests,
                        total: board.partyDetails.guests.length,
                      })}
                    </p>
                    {board.partyDetails.responseDeadline && (
                      <p
                        className={`text-xs font-medium ${
                          responseDeadlineExpired ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        {responseDeadlineExpired
                          ? t('overview.deadlineExpired')
                          : responseDeadlineLabel
                            ? t('overview.responseBy', { date: responseDeadlineLabel })
                            : t('overview.deadlineSet')}
                      </p>
                    )}
                  </div>
                  {canPrepareReminder && (
                    <button
                      onClick={openReminderDialog}
                      className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50"
                    >
                      {t('overview.reminderPrepare')}
                    </button>
                  )}
                </div>
                {!canPrepareReminder && (
                  <p className="mt-2 text-xs font-medium text-stone-400">
                    {t('overview.allResponded')}
                  </p>
                )}
              </div>

              <PartyDetailsFields
                value={board.partyDetails}
                onChange={updatePartyDetails}
                onShareRsvpLink={handleShareRsvpLink}
                onShareRsvpLinkWhatsApp={handleShareRsvpLinkWhatsApp}
                shareLabel={shareState === 'copied' ? t('common.copied') : t('overview.overviewGuestLink')}
                shareWhatsAppLabel={t('overview.overviewGuestLinkWhatsApp')}
                showDetails={false}
                showGuestList
                showCalendar={false}
              />
            </div>
          )}

          {reminderOpen && canPrepareReminder && (
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/35 p-4 backdrop-blur-sm sm:items-center"
              onClick={() => {
                setReminderOpen(false)
                setReminderCopyState('idle')
                setReminderText('')
              }}
            >
              <div
                className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-[2rem] border border-white bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="shrink-0 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">
                      {t('overview.reminderTitle')}
                    </p>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800">
                      {t('overview.reminderTitle')}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-stone-500">
                      {t('overview.reminderIntro')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setReminderOpen(false)
                      setReminderCopyState('idle')
                      setReminderText('')
                    }}
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100"
                  >
                    {t('common.close')}
                  </button>
                </div>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1 pt-2">
                  <div className="rounded-[1.4rem] border border-orange-100 bg-orange-50/60 p-4">
                    <p className="text-sm font-semibold text-stone-700">{t('overview.reminderPreview')}</p>
                    <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-stone-700 shadow-sm">
                      {reminderText}
                    </p>
                  </div>

                  <div className="rounded-[1.4rem] border border-orange-100 bg-orange-50/60 p-4">
                    <p className="text-sm font-semibold text-stone-700">
                      {t('overview.reminderHowMany', {
                        count: pendingGuests.length,
                        plural: pendingGuests.length === 1 ? '' : 'e',
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {pendingGuests.map((guest) => (
                        <span
                          key={guest.id}
                          className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-stone-700 shadow-sm"
                        >
                          {guest.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => void handleCopyReminderText(reminderText)}
                    className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600"
                  >
                    {reminderCopyState === 'copied' ? t('common.copied') : t('overview.reminderCopy')}
                  </button>
                  <button
                    onClick={() => handleOpenWhatsApp(reminderText)}
                    className="rounded-2xl border border-green-200 bg-white px-4 py-3 font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
                  >
                    {t('overview.reminderShareWhatsApp')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2 print:hidden">
            <button
              onClick={onOpenPlan}
              className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
            >
              {t('overview.openFullPlan')}
            </button>
          </div>
        </section>
      )}

      {showIdeas && (
        <>
          <div className="mb-12 flex flex-col gap-3 rounded-[1.75rem] border border-white bg-white/80 p-4 shadow-[0_12px_35px_rgba(119,75,43,0.08)] sm:p-5 lg:flex-row">
            <div className="flex flex-1 gap-2">
              <button
                onClick={handleGenerate}
                disabled={loadingIdeas}
                className="whitespace-nowrap rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 hover:shadow-md disabled:opacity-40"
              >
                {loadingIdeas ? t('ideas.generating') : t('ideas.generate')}
              </button>
            </div>
            <div className="flex flex-1 gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                placeholder={t('ideas.addLinkPlaceholder')}
                className="flex-1 rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-stone-800 placeholder-stone-400 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
              <button
                onClick={handleAddLink}
                disabled={loadingLink || !urlInput.trim()}
                className="whitespace-nowrap rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 hover:shadow-md disabled:opacity-40"
              >
                {loadingLink ? t('common.loading') : t('ideas.addLink')}
              </button>
            </div>
            <button
              onClick={() => setEditor('new')}
              className="whitespace-nowrap rounded-2xl border-2 border-dashed border-orange-200 px-5 py-3 font-semibold text-orange-600 transition hover:border-orange-400 hover:bg-orange-50"
            >
              {t('ideas.ownIdea')}
            </button>
          </div>

          {board.tiles.length === 0 && !loadingIdeas && (
            <div className="rounded-[2rem] border border-dashed border-orange-200 bg-white/60 py-24 text-center text-stone-400">
              <p className="mb-4 text-5xl">🎈</p>
              <p className="mx-auto max-w-md leading-relaxed">
                {t('ideas.empty')}
              </p>
            </div>
          )}

          {/* Die Wand: Kategorien als Abschnitte, Kacheln im Grid */}
          <div className="space-y-12">
            {[...grouped.entries()].map(([category, tiles]) => {
              const color = categoryColor(category)
              const isLinkCategory = tiles.every((t) => t.kind === 'link')
              return (
                <section
                  key={category}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                  }}
                  onDragEnter={() => setDragOver(category)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
                  }}
                  onDrop={(e) => handleDrop(category, e)}
                  className={`rounded-[1.75rem] p-1 transition-colors ${
                    dragOver === category ? 'bg-orange-100/70 ring-2 ring-orange-200' : ''
                  }`}
                >
                  <div className="mb-5 flex items-center gap-3 px-1">
                    <h2
                      className={`inline-block rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.12em] ${color.bg} ${color.text}`}
                    >
                      {category} · {tiles.length}
                    </h2>
                    {!isLinkCategory && (
                      <button
                        onClick={() => handleMoreIdeas(category)}
                        disabled={loadingMore !== null}
                        className="rounded-full bg-white/70 px-3 py-1.5 text-sm font-semibold text-stone-500 shadow-sm transition hover:text-orange-700 disabled:opacity-40"
                      >
                        {loadingMore === category ? t('ideas.generatingMore') : t('ideas.moreLikeThis')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {tiles.map((tile) => (
                      <TileCard
                        key={tile.id}
                        tile={tile}
                        onDelete={handleDelete}
                        onEdit={(t) => setEditor(t)}
                        onToggleSelected={handleToggleSelected}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </>
      )}

      {error && (
        <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
          {error}
        </div>
      )}

      {showShopping && (
        <div className="mt-12">
          <ShoppingListSection
            items={board.shoppingList}
            partyDetails={board.partyDetails}
            editable
            generating={loadingShopping}
            selectedIdeasCount={board.tiles.filter((tile) => tile.selected).length}
            onGenerate={handleGenerateShoppingList}
            onToggleItem={handleToggleShoppingItem}
            onAddItem={handleAddShoppingItem}
            onRemoveItem={handleRemoveShoppingItem}
          />
        </div>
      )}

      {showTimeline && (
        <div className="mt-12">
          <TaskTimelineSection
            items={board.planningTasks}
            partyDetails={board.partyDetails}
            editable
            generating={loadingTasks}
            selectedIdeasCount={board.tiles.filter((tile) => tile.selected).length}
            onGenerate={handleGenerateTasks}
            onToggleItem={handleTogglePlanningTask}
            onAddItem={handleAddPlanningTask}
            onRemoveItem={handleRemovePlanningTask}
          />
        </div>
      )}

      {showSchedule && (
        <div className="mt-12">
          <PartyScheduleSection
            items={board.partySchedule}
            backupItems={board.partyScheduleBackup}
            partyDetails={board.partyDetails}
            editable
            generating={loadingSchedule}
            backupOpen={scheduleBackupOpen}
            onToggleBackupOpen={handleToggleScheduleBackupSection}
            onGenerate={handleGenerateScheduleWithWishes}
            onAddItem={handleAddScheduleItem}
            onUpdateItem={handleUpdateScheduleItem}
            onRemoveItem={handleRemoveScheduleItem}
          />
        </div>
      )}

      {editor !== null && (
        <TileEditor
          tile={editor === 'new' ? null : editor}
          categories={ideaCategoryOptions}
          onSave={handleEditorSave}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
