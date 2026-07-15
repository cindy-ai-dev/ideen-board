import { useState } from 'react'
import { useBoards } from './lib/storage'
import { BoardView } from './components/BoardView'
import { NameDialog } from './components/NameDialog'
import { PartyDetailsFields } from './components/PartyDetailsFields'
import { createEmptyPartyDetails, type PartyDetails } from './types'

function trimPartyDetails(details: PartyDetails): PartyDetails {
  return {
    ...details,
    forWhom: details.forWhom.trim(),
    theme: details.theme.trim(),
    location: details.location.trim(),
    date: details.date,
    time: details.time,
    guestCount: typeof details.guestCount === 'number' ? details.guestCount : null,
    guests: details.guests
      .map((guest) => ({
        ...guest,
        name: guest.name.trim(),
      }))
      .filter((guest) => guest.name),
  }
}

export default function App() {
  const { boards, activeId, setActiveId, createBoard, renameBoard, removeBoard } = useBoards()
  const [dialog, setDialog] = useState<'new' | 'rename' | null>(null)
  const [newBoardDetails, setNewBoardDetails] = useState<PartyDetails>(createEmptyPartyDetails())

  const active = boards.find((b) => b.id === activeId) ?? boards[0]

  function handleDeleteBoard() {
    const ok = window.confirm(
      `Board "${active.name}" wirklich löschen? Alle Kacheln darauf gehen verloren.`
    )
    if (ok) removeBoard(active.id)
  }

  function openNewBoardDialog() {
    setNewBoardDetails(createEmptyPartyDetails())
    setDialog('new')
  }

  return (
    <div className="min-h-screen max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <header className="mb-7 rounded-[2rem] border border-white/80 bg-white/75 px-6 py-7 shadow-[0_12px_40px_rgba(119,75,43,0.10)] backdrop-blur sm:px-9 sm:py-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-500">Planen · Sammeln · Feiern</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-stone-800 sm:text-5xl">Ideen-Board</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-500">
          Party-Details festhalten, KI-Ideen generieren und Links sammeln.
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
          onClick={openNewBoardDialog}
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/30 p-4 backdrop-blur-sm"
          onClick={() => setDialog(null)}
        >
          <div
            className="flex w-full max-w-3xl flex-col gap-5 rounded-[1.75rem] border border-white bg-white p-7 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-500">
                Neues Board
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800">
                Party-Details anlegen
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-500">
                Das Board bekommt seinen Namen aus dem Feld „Für wen / Anlass“. Die Angaben
                landen direkt im Board und werden für die Ideen-Generierung verwendet.
              </p>
            </div>
            <PartyDetailsFields value={newBoardDetails} onChange={setNewBoardDetails} />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setDialog(null)}
                className="rounded-2xl px-4 py-2.5 font-medium text-stone-600 transition hover:bg-stone-100"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  const details = trimPartyDetails(newBoardDetails)
                  createBoard(details.forWhom || 'Neues Board', {
                    topic: details.forWhom,
                    partyDetails: details,
                    tiles: [],
                  })
                  setDialog(null)
                }}
                disabled={!newBoardDetails.forWhom.trim()}
                className="rounded-2xl bg-orange-500 px-5 py-2.5 font-semibold text-white shadow-sm shadow-orange-200 transition hover:bg-orange-600 disabled:opacity-40"
              >
                Board anlegen
              </button>
            </div>
          </div>
        </div>
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
