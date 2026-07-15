import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import type { PartyDetails, Tile } from '../types'
import { useBoard } from '../lib/storage'
import { saveBoard as saveBoardRemote } from '../lib/boardApi'
import { generateIdeas, generateMoreIdeas, generatePlanningTasks, generateShoppingList } from '../lib/claude'
import { fetchLinkPreview } from '../lib/og'
import { summarizePartyDetails } from '../lib/prompts'
import { TileCard, categoryColor } from './TileCard'
import { TileEditor } from './TileEditor'
import { PartyDetailsFields } from './PartyDetailsFields'
import { ShoppingListSection } from './ShoppingListSection'
import { TaskTimelineSection } from './TaskTimelineSection'
import type { RawShoppingItem, ShoppingSourceTile } from '../lib/prompts'
import { createRsvpToken, type PlanningTaskItem, type ShoppingListItem } from '../types'

function normalizeShoppingKey(section: string, label: string): string {
  return `${section.trim().toLowerCase()}::${label.trim().toLowerCase()}`
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

// Die komplette Ansicht EINES Boards. Wird in App per key={boardId}
// eingebunden – beim Board-Wechsel baut React die Komponente neu auf
// und useBoard lädt sauber den Stand des neuen Boards.
export function BoardView({ boardId, onOpenPlan }: { boardId: string; onOpenPlan?: () => void }) {
  const [board, setBoard] = useBoard(boardId)
  const [urlInput, setUrlInput] = useState('')
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingLink, setLoadingLink] = useState(false)
  const [loadingShopping, setLoadingShopping] = useState(false)
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const shareTimerRef = useRef<number | null>(null)
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
    }
  }, [])

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
        // Link bleibt lokal nutzbar; Board speichert den Token beim nächsten Autosave nach.
      }
    }
    const url = `${window.location.origin}${window.location.pathname}?rsvp=${encodeURIComponent(token)}&board=${encodeURIComponent(boardId)}`
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

  return (
    <>
      <section className="mb-8 rounded-[1.85rem] border border-white bg-white/80 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] backdrop-blur sm:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">
              Party-Details
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800 sm:text-3xl">
              {board.partyDetails.forWhom || 'Noch kein Anlass eingetragen'}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500">
              Diese Angaben werden in localStorage gespeichert und als Kontext für die KI genutzt.
            </p>
          </div>
          {partySummary && (
            <div className="max-w-sm rounded-2xl border border-orange-100 bg-orange-50/70 px-4 py-3 text-sm leading-relaxed text-stone-600">
              {partySummary}
            </div>
          )}
        </div>

        <PartyDetailsFields
          value={board.partyDetails}
          onChange={updatePartyDetails}
          onShareRsvpLink={handleShareRsvpLink}
          shareLabel={shareState === 'copied' ? 'Kopiert!' : 'Gäste-Link kopieren'}
        />

        <div className="mt-5 flex flex-wrap justify-end gap-2 print:hidden">
          <button
            onClick={onOpenPlan}
            className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            Gesamtplan ansehen
          </button>
        </div>
      </section>

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

      {error && (
        <div className="mb-8 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
          {error}
        </div>
      )}

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
              // dragOver muss preventDefault aufrufen, sonst erlaubt der
              // Browser das Droppen hier gar nicht erst (HTML5-Eigenheit)
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
                {/* "Mehr davon" nur für Ideen-Kategorien – für die Link-Sammlung
                    kann die KI ja keine Links erfinden */}
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
