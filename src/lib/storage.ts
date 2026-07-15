import { useEffect, useState } from 'react'
import { EMPTY_BOARD, type BoardMeta, type BoardState } from '../types'

// Der Key enthält die Board-ID, damit mehrere Boards
// nebeneinander im localStorage liegen können.
const key = (boardId: string) => `ideen-board:${boardId}`
const REGISTRY_KEY = 'ideen-board:boards'
const ACTIVE_KEY = 'ideen-board:active'

export function loadBoard(boardId: string): BoardState {
  try {
    const raw = localStorage.getItem(key(boardId))
    return raw ? JSON.parse(raw) : EMPTY_BOARD
  } catch {
    return EMPTY_BOARD
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
    { id: 'default', name: legacy.topic || 'Mein Board', createdAt: Date.now() },
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

  function createBoard(name: string) {
    const board: BoardMeta = { id: crypto.randomUUID(), name, createdAt: Date.now() }
    setBoards((prev) => [...prev, board])
    setActiveId(board.id)
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
