import { useMemo, useState } from 'react'
import type { Tile } from '../types'
import { useBoard } from '../lib/storage'
import { generateIdeas, generateMoreIdeas } from '../lib/claude'
import { fetchLinkPreview } from '../lib/og'
import { TileCard, categoryColor } from './TileCard'
import { TileEditor } from './TileEditor'

// Die komplette Ansicht EINES Boards. Wird in App per key={boardId}
// eingebunden – beim Board-Wechsel baut React die Komponente neu auf
// und useBoard lädt sauber den Stand des neuen Boards.
export function BoardView({ boardId }: { boardId: string }) {
  const [board, setBoard] = useBoard(boardId)
  const [topicInput, setTopicInput] = useState('')
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

  async function handleGenerate() {
    const topic = topicInput.trim()
    if (!topic || loadingIdeas) return
    setError(null)
    setLoadingIdeas(true)
    try {
      const ideas = await generateIdeas(topic, boardId)
      setBoard((b) => ({ topic, tiles: [...b.tiles, ...ideas] }))
      setTopicInput('')
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
      const ideas = await generateMoreIdeas(board.topic, category, existing, boardId)
      setBoard((b) => ({ ...b, tiles: [...b.tiles, ...ideas] }))
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
      setBoard((b) => ({ ...b, tiles: [...b.tiles, tile] }))
      setUrlInput('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Link konnte nicht geladen werden')
    } finally {
      setLoadingLink(false)
    }
  }

  function handleDelete(id: string) {
    setBoard((b) => ({ ...b, tiles: b.tiles.filter((t) => t.id !== id) }))
  }

  // Beim Drop: Kachel-ID aus dem dataTransfer holen und die Kategorie
  // der Kachel umschreiben – mehr ist Verschieben nicht.
  function handleDrop(category: string, e: React.DragEvent) {
    e.preventDefault()
    setDragOver(null)
    const tileId = e.dataTransfer.getData('text/plain')
    if (!tileId) return
    setBoard((b) => ({
      ...b,
      tiles: b.tiles.map((t) => (t.id === tileId ? { ...t, category } : t)),
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
      setBoard((b) => ({ ...b, tiles: [...b.tiles, tile] }))
    } else if (editor) {
      setBoard((b) => ({
        ...b,
        tiles: b.tiles.map((t) =>
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

  return (
    <>
      {/* Eingabezeile: Thema + Link + eigene Idee */}
      <div className="flex flex-col sm:flex-row gap-3 mb-10">
        <div className="flex flex-1 gap-2">
          <input
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder='Thema, z.B. "Pokémon-Geburtstag, 6 Jahre"'
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            onClick={handleGenerate}
            disabled={loadingIdeas || !topicInput.trim()}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-medium px-5 py-2.5 whitespace-nowrap transition-colors"
          >
            {loadingIdeas ? 'Denkt nach…' : '✨ Ideen holen'}
          </button>
        </div>
        <div className="flex flex-1 gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddLink()}
            placeholder="Link einwerfen (YouTube, Amazon, …)"
            className="flex-1 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
          <button
            onClick={handleAddLink}
            disabled={loadingLink || !urlInput.trim()}
            className="rounded-xl bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white font-medium px-5 py-2.5 whitespace-nowrap transition-colors"
          >
            {loadingLink ? 'Lädt…' : '🔗 Hinzufügen'}
          </button>
        </div>
        <button
          onClick={() => setEditor('new')}
          className="rounded-xl border-2 border-dashed border-stone-300 text-stone-500 hover:border-stone-400 hover:text-stone-700 font-medium px-5 py-2.5 whitespace-nowrap transition-colors"
        >
          ＋ Eigene Idee
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3">
          {error}
        </div>
      )}

      {board.tiles.length === 0 && !loadingIdeas && (
        <div className="text-center text-stone-400 py-24">
          <p className="text-5xl mb-4">🎈</p>
          <p>Noch leer hier. Gib oben ein Thema ein und lass dir ein Ideen-Startset geben.</p>
        </div>
      )}

      {/* Die Wand: Kategorien als Abschnitte, Kacheln im Grid */}
      <div className="space-y-10">
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
              className={`rounded-2xl transition-colors ${
                dragOver === category ? 'bg-stone-200/60 ring-2 ring-stone-300' : ''
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <h2
                  className={`inline-block text-sm font-semibold uppercase tracking-wider px-3 py-1 rounded-full ${color.bg} ${color.text}`}
                >
                  {category} · {tiles.length}
                </h2>
                {/* "Mehr davon" nur für Ideen-Kategorien – für die Link-Sammlung
                    kann die KI ja keine Links erfinden */}
                {!isLinkCategory && (
                  <button
                    onClick={() => handleMoreIdeas(category)}
                    disabled={loadingMore !== null}
                    className="text-sm text-stone-400 hover:text-stone-700 disabled:opacity-40 transition-colors"
                  >
                    {loadingMore === category ? 'Denkt nach…' : '✨ mehr davon'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
