import { useEffect, useState } from 'react'
import {
  createEmptyBoard,
  createEmptyPartyDetails,
  type BoardMeta,
  type BoardState,
  type Guest,
  type PartyDetails,
  type Tile,
} from '../types'

// Der Key enthält die Board-ID, damit mehrere Boards
// nebeneinander im localStorage liegen können.
const key = (boardId: string) => `ideen-board:${boardId}`
const REGISTRY_KEY = 'ideen-board:boards'
const ACTIVE_KEY = 'ideen-board:active'

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeGuest(value: unknown): Guest | null {
  if (!isObject(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const status = value.status
  if (!name || (status !== 'eingeladen' && status !== 'zugesagt' && status !== 'abgesagt')) {
    return null
  }

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    name,
    status,
  }
}

function normalizePartyDetails(value: unknown): PartyDetails {
  const fallback = createEmptyPartyDetails()
  if (!isObject(value)) return fallback

  const guestCountRaw = value.guestCount
  const guestCount =
    typeof guestCountRaw === 'number' && Number.isFinite(guestCountRaw) && guestCountRaw >= 0
      ? guestCountRaw
      : typeof guestCountRaw === 'string' && guestCountRaw.trim()
        ? Number.parseInt(guestCountRaw, 10)
        : null

  return {
    forWhom: typeof value.forWhom === 'string' ? value.forWhom : '',
    theme: typeof value.theme === 'string' ? value.theme : '',
    location: typeof value.location === 'string' ? value.location : '',
    date: typeof value.date === 'string' ? value.date : '',
    time: typeof value.time === 'string' ? value.time : '',
    guestCount: Number.isFinite(guestCount) && guestCount !== null && guestCount >= 0 ? guestCount : null,
    guests: Array.isArray(value.guests)
      ? value.guests.map(normalizeGuest).filter((guest): guest is Guest => guest !== null)
      : [],
  }
}

function normalizeTile(value: unknown, boardId: string): Tile | null {
  if (!isObject(value)) return null
  const kind = value.kind
  const title = typeof value.title === 'string' ? value.title : ''
  const category = typeof value.category === 'string' ? value.category : ''
  if ((kind !== 'idea' && kind !== 'link') || !title || !category) return null

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    boardId,
    kind,
    title,
    description: typeof value.description === 'string' ? value.description : undefined,
    category,
    url: typeof value.url === 'string' ? value.url : undefined,
    image: typeof value.image === 'string' ? value.image : undefined,
    selected: typeof value.selected === 'boolean' ? value.selected : false,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function normalizeBoard(raw: unknown, boardId: string): BoardState {
  if (!isObject(raw)) return createEmptyBoard()

  const topic = typeof raw.topic === 'string' ? raw.topic : ''
  const partyDetails = normalizePartyDetails(raw.partyDetails)
  if (!partyDetails.forWhom && topic) {
    partyDetails.forWhom = topic
  }

  return {
    topic,
    partyDetails,
    tiles: Array.isArray(raw.tiles)
      ? raw.tiles
          .map((tile) => normalizeTile(tile, boardId))
          .filter((tile): tile is Tile => tile !== null)
      : [],
  }
}

export function loadBoard(boardId: string): BoardState {
  try {
    const raw = localStorage.getItem(key(boardId))
    if (!raw) return createEmptyBoard()
    return normalizeBoard(JSON.parse(raw), boardId)
  } catch {
    return createEmptyBoard()
  }
}

export function saveBoard(boardId: string, state: BoardState) {
  localStorage.setItem(key(boardId), JSON.stringify(state))
}

function deleteBoardStorage(boardId: string) {
  localStorage.removeItem(key(boardId))
}

// Migration: Vor der Multi-Board-Version gab es genau ein Board unter
// der ID "default" – aber keine Board-Liste. Beim ersten Start nach dem
// Update bauen wir die Liste einmalig auf und übernehmen das alte Board
// mit seinem Thema als Namen. So geht nichts verloren.
function loadRegistry(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BoardMeta[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // kaputte Liste → unten neu aufbauen
  }
  const legacy = loadBoard('default')
  const registry: BoardMeta[] = [
    {
      id: 'default',
      name: legacy.partyDetails.forWhom || legacy.topic || 'Mein Board',
      createdAt: Date.now(),
    },
  ]
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry))
  return registry
}

// Verwaltet die Board-Liste + welches Board gerade aktiv ist.
// Beides wird im localStorage gespiegelt und überlebt Reloads.
export function useBoards() {
  const [boards, setBoards] = useState<BoardMeta[]>(loadRegistry)
  const [activeId, setActiveId] = useState<string>(() => {
    const stored = localStorage.getItem(ACTIVE_KEY)
    const list = loadRegistry()
    return stored && list.some((b) => b.id === stored) ? stored : list[0].id
  })

  useEffect(() => {
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(boards))
  }, [boards])

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  function createBoard(name: string, initialState: BoardState = createEmptyBoard()) {
    const board: BoardMeta = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    setBoards((prev) => [...prev, board])
    setActiveId(board.id)
    saveBoard(board.id, initialState)
  }

  function renameBoard(id: string, name: string) {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)))
  }

  function removeBoard(id: string) {
    deleteBoardStorage(id)
    const rest = boards.filter((b) => b.id !== id)
    if (rest.length === 0) {
      // Das letzte Board wurde gelöscht → frisches leeres Board anlegen,
      // damit die App nie ohne Board dasteht.
      const fresh: BoardMeta = { id: crypto.randomUUID(), name: 'Neues Board', createdAt: Date.now() }
      setBoards([fresh])
      setActiveId(fresh.id)
      saveBoard(fresh.id, createEmptyBoard())
    } else {
      setBoards(rest)
      if (id === activeId) setActiveId(rest[0].id)
    }
  }

  return { boards, activeId, setActiveId, createBoard, renameBoard, removeBoard }
}

// React-Hook: verhält sich wie useState, schreibt aber bei jeder
// Änderung automatisch in den localStorage.
// Wichtig: Die Komponente, die diesen Hook nutzt, wird beim Board-Wechsel
// per key={boardId} neu aufgebaut – deshalb reicht der useState-Initializer.
export function useBoard(boardId: string) {
  const [board, setBoard] = useState<BoardState>(() => loadBoard(boardId))

  useEffect(() => {
    saveBoard(boardId, board)
  }, [boardId, board])

  return [board, setBoard] as const
}
