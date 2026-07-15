import { useEffect, useMemo, useState } from 'react'
import { useBoards } from './lib/storage'
import { BoardView } from './components/BoardView'
import { BoardPlanView } from './components/BoardPlanView'
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

function parsePartyDate(details: PartyDetails): number {
  if (!details.date) return Number.POSITIVE_INFINITY
  const raw = `${details.date}T${details.time || '00:00'}`
  const timestamp = new Date(raw).getTime()
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY
}

function formatPartyDate(details: PartyDetails): string {
  if (!details.date) return 'Ohne Datum'
  const date = new Date(details.date)
  if (Number.isNaN(date.getTime())) return details.date
  const datePart = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
  if (!details.time) return datePart
  return `${datePart}, ${details.time} Uhr`
}

function getViewFromUrl(): 'board' | 'plan' {
  if (typeof window === 'undefined') return 'board'
  const params = new URLSearchParams(window.location.search)
  return params.get('view') === 'plan' ? 'plan' : 'board'
}

function setViewInUrl(view: 'board' | 'plan') {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (view === 'plan') url.searchParams.set('view', 'plan')
  else url.searchParams.delete('view')
  window.history.replaceState({}, '', url)
}

export default function App() {
  const { boards, activeId, setActiveId, createBoard, renameBoard, removeBoard } = useBoards()
  const [dialog, setDialog] = useState<'new' | 'rename' | null>(null)
  const [newBoardDetails, setNewBoardDetails] = useState<PartyDetails>(createEmptyPartyDetails())
  const [view, setView] = useState<'board' | 'plan'>(() => getViewFromUrl())

  useEffect(() => {
    setViewInUrl(view)
  }, [view])

  const active = boards.find((b) => b.id === activeId) ?? boards[0] ?? null
  const boardSummaries = useMemo(() => {
    return boards
      .map((board) => ({
        meta: board,
        details: board.data.partyDetails,
      }))
      .sort((a, b) => {
        const left = parsePartyDate(a.details)
        const right = parsePartyDate(b.details)
        if (left !== right) return left - right
        if (left === Number.POSITIVE_INFINITY) return a.meta.createdAt - b.meta.createdAt
        return a.meta.name.localeCompare(b.meta.name, 'de')
      })
  }, [boards])

  function handleDeleteBoard() {
    if (!active) return
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
      <header className={`mb-7 rounded-[2rem] border border-white/80 bg-white/75 px-6 py-7 shadow-[0_12px_40px_rgba(119,75,43,0.10)] backdrop-blur sm:px-9 sm:py-8 ${view === 'plan' ? 'hidden' : ''}`}>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-orange-500">Planen · Sammeln · Feiern</p>
        <h1 className="text-4xl font-extrabold tracking-tight text-stone-800 sm:text-5xl">Ideen-Board</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-500">
          Party-Details festhalten, KI-Ideen generieren und Links sammeln.
        </p>
      </header>

      <section className={`mb-8 rounded-[1.85rem] border border-orange-100 bg-white/75 p-5 shadow-[0_12px_35px_rgba(119,75,43,0.08)] backdrop-blur ${view === 'plan' ? 'hidden' : ''}`}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-500">
              Board-Übersicht
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-stone-800">
              Alle Partys nach Datum sortiert
            </h2>
          </div>
          <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
            {boardSummaries.length} Boards
          </span>
        </div>

        {boardSummaries.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-orange-200 bg-white/70 px-4 py-10 text-center text-stone-400">
            Noch keine Boards geladen.
          </div>
        ) : (
          <div className="space-y-2">
            {boardSummaries.map(({ meta, details }) => {
              const isActive = meta.id === activeId
              return (
                <button
                  key={meta.id}
                  onClick={() => setActiveId(meta.id)}
                  className={`flex w-full flex-col gap-2 rounded-[1.4rem] border px-4 py-3 text-left transition sm:flex-row sm:items-center sm:justify-between ${
                    isActive
                      ? 'border-orange-200 bg-orange-50/80 shadow-sm'
                      : 'border-orange-100 bg-white/80 hover:border-orange-200 hover:bg-orange-50/60'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-stone-800">
                      {details.forWhom || meta.name}
                    </p>
                    <p className="mt-1 text-sm text-stone-500">
                      {details.theme ? `Motto: ${details.theme}` : 'Kein Motto gesetzt'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-stone-500 sm:text-right">
                    <span className="font-medium text-stone-700">{formatPartyDate(details)}</span>
                    <span>{details.location || 'Ort offen'}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* Board-Leiste: ein Pill pro Board + Verwaltung */}
      <div className={`mb-10 flex flex-wrap items-center gap-2.5 rounded-2xl border border-orange-100 bg-white/65 p-3 shadow-sm backdrop-blur ${view === 'plan' ? 'hidden' : ''}`}>
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
      {view === 'board' ? (
        active ? (
          <BoardView key={activeId} boardId={activeId} onOpenPlan={() => setView('plan')} />
        ) : (
          <div className="rounded-[2rem] border border-dashed border-orange-200 bg-white/60 py-24 text-center text-stone-400">
            Lade Boards…
          </div>
        )
      ) : active ? (
        <BoardPlanView
          key={`${activeId}:plan`}
          boardId={activeId}
          onBack={() => setView('board')}
        />
      ) : (
        <div className="rounded-[2rem] border border-dashed border-orange-200 bg-white/60 py-24 text-center text-stone-400">
          Lade Boards…
        </div>
      )}

      {dialog === 'new' && view === 'board' && (
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
          initial={active?.name ?? ''}
          onSave={(name) => {
            if (active) renameBoard(active.id, name)
            setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
