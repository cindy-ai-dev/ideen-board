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
    <div className="min-h-screen max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-7 rounded-[2rem] border border-white/80 bg-white/75 px-6 py-7 shadow-[0_12px_40px_rgba(119,75,43,0.10)] backdrop-blur sm:px-9 sm:py-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-500">Planen · Sammeln · Feiern</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-stone-800 sm:text-5xl">Ideen-Board</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-500">
          Thema eingeben für KI-Ideen, Links einwerfen für Fundstücke.
        </p>
      </header>

      {/* Board-Leiste: ein Pill pro Board + Verwaltung */}
      <div className="mb-10 flex flex-wrap items-center gap-2.5 rounded-2xl border border-orange-100 bg-white/65 p-3 shadow-sm backdrop-blur">
        {boards.map((b) => (
          <button
            key={b.id}
            onClick={() => setActiveId(b.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              b.id === activeId
                ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                : 'bg-white/80 border border-orange-100 text-stone-600 hover:border-orange-300 hover:bg-orange-50'
            }`}
          >
            {b.name}
          </button>
        ))}
        <button
          onClick={() => setDialog('new')}
          title="Neues Board anlegen"
          className="rounded-full border-2 border-dashed border-orange-200 px-4 py-1.5 text-sm font-semibold text-orange-600 transition-colors hover:border-orange-400 hover:bg-orange-50"
        >
          ＋ Board
        </button>
        <span className="mx-1 text-orange-200">|</span>
        <button
          onClick={() => setDialog('rename')}
          title="Aktives Board umbenennen"
          className="text-sm font-medium text-stone-400 transition-colors hover:text-orange-700"
        >
          ✎ umbenennen
        </button>
        <button
          onClick={handleDeleteBoard}
          title="Aktives Board löschen"
          className="text-sm font-medium text-stone-400 transition-colors hover:text-rose-600"
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
