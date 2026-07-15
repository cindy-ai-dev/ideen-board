import { useMemo, useState, type DragEvent } from 'react'
import type { PartyDetails, Tile } from '../types'
import { useBoard } from '../lib/storage'
import { generateIdeas, generateMoreIdeas } from '../lib/claude'
import { fetchLinkPreview } from '../lib/og'
import { summarizePartyDetails } from '../lib/prompts'
import { TileCard, categoryColor } from './TileCard'
import { TileEditor } from './TileEditor'
import { PartyDetailsFields } from './PartyDetailsFields'

// Die komplette Ansicht EINES Boards. Wird in App per key={boardId}
// eingebunden – beim Board-Wechsel baut React die Komponente neu auf
// und useBoard lädt sauber den Stand des neuen Boards.
export function BoardView({ boardId }: { boardId: string }) {
  const [board, setBoard] = useBoard(boardId)
  const [urlInput, setUrlInput] = useState('')
  const [loadingIdeas, setLoadingIdeas] = useState(false)
  const [loadingLink, setLoadingLink] = useState(false)
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

  function handleDelete(id: string) {
    setBoard((current) => ({ ...current, tiles: current.tiles.filter((t) => t.id !== id) }))
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

        <PartyDetailsFields value={board.partyDetails} onChange={updatePartyDetails} />
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
                  />
                ))}
              </div>
            </section>
          )
        })}
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
