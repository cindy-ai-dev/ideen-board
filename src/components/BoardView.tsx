import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { PartyDetails, Tile } from '../types'
import { useBoard } from '../lib/storage'
import { saveBoard as saveBoardRemote } from '../lib/boardApi'
import {
  generateIdeas,
  generateMoreIdeas,
  generatePlanningTasks,
  generatePartySchedule,
  generateShoppingList,
} from '../lib/claude'
import { fetchLinkPreview } from '../lib/og'
import { summarizePartyDetails } from '../lib/prompts'
import { TileCard, categoryColor } from './TileCard'
import { TileEditor } from './TileEditor'
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
    details.location.trim() ||
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
  return new Intl.DateTimeFormat('de-DE', {
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

function formatDeadline(value: string): string | null {
  if (!value) return null
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function buildGuestReminderText(options: {
  partyName: string
  partyDate: string
  responseDeadline?: string
  rsvpUrl: string
}): string {
  const intro = `Hey! Nicht vergessen: RSVP für ${options.partyName} am ${options.partyDate}.`
  const deadline = options.responseDeadline ? ` (Antwort bis ${options.responseDeadline})` : ''
  return `${intro}${deadline} Sag uns Bescheid, ob du kommst: ${options.rsvpUrl}`
}

function splitSummaryLine(line: string): { label: string; value: string } {
  const idx = line.indexOf(':')
  if (idx < 0) return { label: line, value: '' }
  return {
    label: line.slice(0, idx).trim(),
    value: line.slice(idx + 1).trim(),
  }
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
  const [board, setBoard] = useBoard(boardId)
  const [urlInput, setUrlInput] = useState('')
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingLink, setLoadingLink] = useState(false)
  const [loadingShopping, setLoadingShopping] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [scheduleBackupOpen, setScheduleBackupOpen] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const [reminderOpen, setReminderOpen] = useState(false)
  const [reminderCopyState, setReminderCopyState] = useState<'idle' | 'copied'>('idle')
  const [reminderText, setReminderText] = useState('')
  const [editingDetails, setEditingDetails] = useState(() => isPartyDetailsEmpty(board.partyDetails))
  const shareTimerRef = useRef<number | null>(null)
  const reminderTimerRef = useRef<number | null>(null)
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
    }
  }, [])

  function ensureRsvpToken(): string {
    let token = board.rsvpToken.trim()
    if (!token) {
      token = createRsvpToken()
      const nextBoard = { ...board, rsvpToken: token }
      setBoard(nextBoard)
      void saveBoardRemote(
        boardId,
        nextBoard.partyDetails.forWhom.trim() || nextBoard.topic.trim() || 'Neues Board',
        nextBoard
      ).catch(() => {
        // Token bleibt lokal nutzbar und wird beim nächsten Autosave mitgespeichert.
      })
    }
    return token
  }

  function buildRsvpUrl() {
    const token = ensureRsvpToken()
    return `${window.location.origin}${window.location.pathname}?rsvp=${encodeURIComponent(token)}&board=${encodeURIComponent(boardId)}`
  }

  function openReminderDialog() {
    const token = ensureRsvpToken()
    const partyName = board.partyDetails.forWhom.trim() || board.topic.trim() || 'deine Party'
    const partyDate = formatPartyDate(board.partyDetails.date, board.partyDetails.time)
    const deadline = formatDeadline(board.partyDetails.responseDeadline) ?? undefined
    const text = buildGuestReminderText({
      partyName,
      partyDate,
      responseDeadline: deadline,
      rsvpUrl: `${window.location.origin}${window.location.pathname}?rsvp=${encodeURIComponent(token)}&board=${encodeURIComponent(boardId)}`,
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
      const ideas = await generateIdeas(board.topic, board.partyDetails, boardId)
      setBoard((current) => ({
        ...current,
        topic: current.topic || current.partyDetails.forWhom.trim(),
        tiles: [...current.tiles, ...ideas],
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ideen konnten nicht geladen werden')
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
      const ideas = await generateMoreIdeas(board.topic, board.partyDetails, category, existing, boardId)
      setBoard((current) => ({
        ...current,
        tiles: [...current.tiles, ...ideas],
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ideen konnten nicht geladen werden')
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
      const tile = await fetchLinkPreview(url, boardId)
      setBoard((current) => ({ ...current, tiles: [...current.tiles, tile] }))
      setUrlInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link konnte nicht geladen werden')
    } finally {
      setLoadingLink(false)
    }
  }

  async function handleShareRsvpLink() {
    const url = buildRsvpUrl()
    try {
      await navigator.clipboard.writeText(url)
      setShareState('copied')
      if (shareTimerRef.current !== null) window.clearTimeout(shareTimerRef.current)
      shareTimerRef.current = window.setTimeout(() => {
        setShareState('idle')
        shareTimerRef.current = null
      }, 1800)
    } catch {
      window.prompt('Gäste-Link kopieren', url)
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
      window.prompt('Erinnerungstext kopieren', text)
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
      setError('Markiere zuerst einige Ideen als ausgewählt, damit daraus eine Einkaufsliste erzeugt werden kann.')
      return
    }

    setError(null)
    setLoadingShopping(true)
    try {
      const suggestions = await generateShoppingList(board.topic, board.partyDetails, selectedTiles)
      setBoard((current) => ({
        ...current,
        shoppingList: mergeShoppingSuggestions(current.shoppingList, suggestions),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Einkaufsliste konnte nicht geladen werden')
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
      setError('Markiere zuerst einige Ideen als ausgewählt, damit daraus ein Zeitplan erzeugt werden kann.')
      return
    }

    setError(null)
    setLoadingTasks(true)
    try {
      const tasks = await generatePlanningTasks(board.topic, board.partyDetails, selectedTiles)
      setBoard((current) => ({
        ...current,
        planningTasks: mergePlanningSuggestions(current.planningTasks, tasks),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Zeitplan konnte nicht geladen werden')
    } finally {
      setLoadingTasks(false)
    }
  }

  async function handleGenerateSchedule() {
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
      const { items, backupItems } = await generatePartySchedule(board.topic, board.partyDetails, selectedTiles)
      setBoard((current) => ({
        ...current,
        partySchedule: mergeScheduleSuggestions(current.partySchedule, items),
        partyScheduleBackup: mergeScheduleSuggestions(current.partyScheduleBackup, backupItems),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ablaufplan konnte nicht geladen werden')
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

  const partySummary = summarizePartyDetails(board.partyDetails)
  const showOverview = activeSection === 'overview'
  const showGuests = activeSection === 'guests'
  const showIdeas = activeSection === 'ideas'
  const showShopping = activeSection === 'shopping'
  const showTimeline = activeSection === 'timeline'
  const showSchedule = activeSection === 'schedule'
  const summaryLines = partySummary ? partySummary.split('\n').filter(Boolean) : []
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

  useEffect(() => {
    if (!showOverview) setEditingDetails(false)
  }, [showOverview])

  return (
    <>
      {(showOverview || showGuests) && (
        <section className="mb-8 rounded-[1.85rem] border border-white bg-white/80 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] backdrop-blur sm:p-6">
          <div className="mb-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">
                {showGuests ? 'Gästeliste' : 'Party-Details'}
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
                {showGuests
                  ? board.partyDetails.forWhom || 'Noch kein Anlass eingetragen'
                  : board.partyDetails.forWhom || 'Noch kein Anlass eingetragen'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
                {showGuests
                  ? 'Hier verwaltest du die Gästeliste und den RSVP-Link.'
                  : 'Diese Angaben werden gespeichert und als Kontext für die KI genutzt.'}
              </p>
              </div>
              {showOverview && onDuplicateBoard && (
                <div className="flex flex-wrap gap-2">
                  {onDuplicateBoard && (
                    <button
                      onClick={() => void onDuplicateBoard()}
                      className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      Als Vorlage für neue Party nutzen
                    </button>
                  )}
                  <button
                    onClick={() => setEditingDetails((current) => !current)}
                    className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50"
                  >
                    {editingDetails ? 'Zurück' : 'Bearbeiten'}
                  </button>
                </div>
              )}
            </div>

            {showSummary && (
              <div className="w-full rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-sm leading-relaxed text-stone-600">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-600">
                  Party auf einen Blick
                </p>
                {summaryLines.length > 0 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {summaryLines.map((line) => {
                      const { label, value } = splitSummaryLine(line)
                      return (
                        <div key={line} className="rounded-xl bg-white/80 px-3 py-2.5 shadow-sm">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                            {label}
                          </p>
                          <p className="mt-0.5 text-sm font-medium text-stone-700">
                            {value || label}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-orange-200 bg-white/70 px-4 py-6 text-center text-stone-500">
                    Noch keine Party-Details eingetragen.
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
                shareLabel={shareState === 'copied' ? 'Kopiert!' : 'Gäste-Link kopieren'}
                showDetails
                showGuestList={false}
                showCalendar
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  onClick={() => setEditingDetails(false)}
                  className="rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600"
                >
                  Speichern & zurück
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
                      {respondedGuests} von {board.partyDetails.guests.length} Gästen haben geantwortet
                    </p>
                    {board.partyDetails.responseDeadline && (
                      <p
                        className={`text-xs font-medium ${
                          responseDeadlineExpired ? 'text-rose-600' : 'text-amber-700'
                        }`}
                      >
                        {responseDeadlineExpired
                          ? 'Frist abgelaufen'
                          : responseDeadlineLabel
                            ? `Antwort bis: ${responseDeadlineLabel}`
                            : 'Antwort bis gesetzt'}
                      </p>
                    )}
                  </div>
                  {canPrepareReminder && (
                    <button
                      onClick={openReminderDialog}
                      className="rounded-2xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50"
                    >
                      Erinnerung vorbereiten
                    </button>
                  )}
                </div>
                {!canPrepareReminder && (
                  <p className="mt-2 text-xs font-medium text-stone-400">
                    Alle Gäste haben bereits geantwortet.
                  </p>
                )}
              </div>

              <PartyDetailsFields
                value={board.partyDetails}
                onChange={updatePartyDetails}
                onShareRsvpLink={handleShareRsvpLink}
                shareLabel={shareState === 'copied' ? 'Kopiert!' : 'Gäste-Link kopieren'}
                showDetails={false}
                showGuestList
                showCalendar={false}
              />
            </div>
          )}

          {reminderOpen && canPrepareReminder && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/35 p-4 backdrop-blur-sm"
              onClick={() => {
                setReminderOpen(false)
                setReminderCopyState('idle')
                setReminderText('')
              }}
            >
              <div
                className="w-full max-w-2xl rounded-[2rem] border border-white bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">
                      Erinnerung
                    </p>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800">
                      RSVP-Erinnerung vorbereiten
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-stone-500">
                      Vorschau des Textes, den du an Gäste schicken kannst, die noch nicht geantwortet haben.
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
                    Schließen
                  </button>
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-orange-100 bg-orange-50/60 p-4">
                  <p className="text-sm font-semibold text-stone-700">Vorschau</p>
                  <p className="mt-2 rounded-2xl bg-white px-4 py-3 text-sm leading-relaxed text-stone-700 shadow-sm">
                    {reminderText}
                  </p>
                </div>

                <div className="mt-5 rounded-[1.4rem] border border-orange-100 bg-orange-50/60 p-4">
                  <p className="text-sm font-semibold text-stone-700">
                    Noch offen: {pendingGuests.length} Gast{pendingGuests.length === 1 ? '' : 'e'}
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

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <button
                    onClick={() => void handleCopyReminderText(reminderText)}
                    className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600"
                  >
                    {reminderCopyState === 'copied' ? 'Kopiert!' : 'Text kopieren'}
                  </button>
                  <button
                    onClick={() => handleOpenWhatsApp(reminderText)}
                    className="rounded-2xl border border-green-200 bg-white px-4 py-3 font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
                  >
                    Per WhatsApp teilen
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
              Gesamtplan ansehen
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
                {loadingIdeas ? 'Denkt nach…' : '✨ Ideen für diese Party holen'}
              </button>
            </div>
            <div className="flex flex-1 gap-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
                placeholder="Link einwerfen (YouTube, Amazon, …)"
                className="flex-1 rounded-2xl border border-sky-100 bg-sky-50/50 px-4 py-3 text-stone-800 placeholder-stone-400 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
              />
              <button
                onClick={handleAddLink}
                disabled={loadingLink || !urlInput.trim()}
                className="whitespace-nowrap rounded-2xl bg-sky-500 px-5 py-3 font-semibold text-white shadow-sm shadow-sky-200 transition hover:bg-sky-600 hover:shadow-md disabled:opacity-40"
              >
                {loadingLink ? 'Lädt…' : '🔗 Hinzufügen'}
              </button>
            </div>
            <button
              onClick={() => setEditor('new')}
              className="whitespace-nowrap rounded-2xl border-2 border-dashed border-orange-200 px-5 py-3 font-semibold text-orange-600 transition hover:border-orange-400 hover:bg-orange-50"
            >
              ＋ Eigene Idee
            </button>
          </div>

          {board.tiles.length === 0 && !loadingIdeas && (
            <div className="rounded-[2rem] border border-dashed border-orange-200 bg-white/60 py-24 text-center text-stone-400">
              <p className="mb-4 text-5xl">🎈</p>
              <p className="mx-auto max-w-md leading-relaxed">
                Noch leer hier. Trag oben die Party-Details ein und hol dir dann ein Ideen-Startset.
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
                        {loadingMore === category ? 'Denkt nach…' : '✨ mehr davon'}
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
            onGenerate={handleGenerateSchedule}
            onAddItem={handleAddScheduleItem}
            onUpdateItem={handleUpdateScheduleItem}
            onRemoveItem={handleRemoveScheduleItem}
          />
        </div>
      )}

      {editor !== null && (
        <TileEditor
          tile={editor === 'new' ? null : editor}
          categories={[...grouped.keys()]}
          onSave={handleEditorSave}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
