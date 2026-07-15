import { useState } from 'react'
import { useBoards } from './lib/storage'
import { BoardView } from './components/BoardView'
import { NameDialog } from './components/NameDialog'

export default function App() {
  const { boards, activeId, setActiveId, createBoard, renameBoard, removeBoard } = useBoards()
  const [dialog, setDialog] = useState<'new' | 'rename' | null>(null)

  const active = boards.find((b) => b.id === activeId) ?? boards[0]

  function handleDeleteBoard() {
    const ok = window.confirm(
      `Board "${active.name}" wirklich löschen? Alle Kacheln darauf gehen verloren.`
    )
    if (ok) removeBoard(active.id)
  }

  return (
    <div className="min-h-screen max-w-6xl mx-auto px-6 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-stone-800 tracking-tight">Ideen-Board</h1>
        <p className="text-stone-500 mt-1">
          Thema eingeben für KI-Ideen, Links einwerfen für Fundstücke.
        </p>
      </header>

      {/* Board-Leiste: ein Pill pro Board + Verwaltung */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {boards.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveId(b.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              b.id === activeId
                ? 'bg-stone-800 text-white'
                : 'bg-white border border-stone-300 text-stone-600 hover:border-stone-400'
            }`}
          >
            {b.name}
          </button>
        ))}
        <button
          onClick={() => setDialog('new')}
          title="Neues Board anlegen"
          className="rounded-full px-4 py-1.5 text-sm font-medium border-2 border-dashed border-stone-300 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors"
        >
          ＋ Board
        </button>
        <span className="mx-1 text-stone-300">|</span>
        <button
          onClick={() => setDialog('rename')}
          title="Aktives Board umbenennen"
          className="text-sm text-stone-400 hover:text-stone-700 transition-colors"
        >
          ✎ umbenennen
        </button>
        <button
          onClick={handleDeleteBoard}
          title="Aktives Board löschen"
          className="text-sm text-stone-400 hover:text-rose-600 transition-colors"
        >
          🗑 löschen
        </button>
      </div>

      {/* key={activeId}: beim Board-Wechsel wird die Ansicht komplett neu
          aufgebaut und lädt sauber den Stand des gewählten Boards */}
      <BoardView key={activeId} boardId={activeId} />

      {dialog === 'new' && (
        <NameDialog
          title="Neues Board anlegen"
          onSave={(name) => {
            createBoard(name)
            setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'rename' && (
        <NameDialog
          title="Board umbenennen"
          initial={active.name}
          onSave={(name) => {
            renameBoard(active.id, name)
            setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
