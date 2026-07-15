import { useEffect, useRef, useState } from 'react'
import { deleteBoard as deleteBoardRemote, fetchBoard, fetchBoards, saveBoard as saveBoardRemote } from './boardApi'
import {
  createEmptyBoard,
  createEmptyPartyDetails,
  type BoardMeta,
  type BoardRecord,
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
const CACHE_EVENT = 'ideen-board:cache-updated'

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

function boardMetaFromRecord(record: BoardRecord): BoardMeta {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
  }
}

function boardMetaFromState(boardId: string, board: BoardState): BoardMeta {
  return {
    id: boardId,
    name: board.partyDetails.forWhom.trim() || board.topic.trim() || 'Mein Board',
    createdAt: Date.now(),
  }
}

function readRegistryCache(): BoardMeta[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((entry) => {
        if (!isObject(entry)) return null
        const id = typeof entry.id === 'string' ? entry.id : ''
        const name = typeof entry.name === 'string' ? entry.name : ''
        const createdAt = typeof entry.createdAt === 'number' ? entry.createdAt : Date.now()
        if (!id || !name) return null
        return { id, name, createdAt }
      })
      .filter((entry): entry is BoardMeta => entry !== null)
  } catch {
    return []
  }
}

function writeRegistryCache(boards: BoardMeta[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(boards))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CACHE_EVENT))
}

function readBoardCache(boardId: string): BoardState {
  try {
    const raw = localStorage.getItem(key(boardId))
    if (!raw) return createEmptyBoard()
    return normalizeBoard(JSON.parse(raw), boardId)
  } catch {
    return createEmptyBoard()
  }
}

function writeBoardCache(boardId: string, state: BoardState) {
  localStorage.setItem(key(boardId), JSON.stringify(state))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CACHE_EVENT))
}

function deleteBoardCache(boardId: string) {
  localStorage.removeItem(key(boardId))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CACHE_EVENT))
}

function getActiveIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('board')
}

function setActiveIdInUrl(boardId: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('board', boardId)
  window.history.replaceState({}, '', url)
}

function setActiveIdCache(boardId: string) {
  localStorage.setItem(ACTIVE_KEY, boardId)
}

function getBoardNameFromCache(boardId: string) {
  const registry = readRegistryCache()
  return registry.find((board) => board.id === boardId)?.name ?? ''
}

function saveLocalBoard(boardId: string, state: BoardState) {
  writeBoardCache(boardId, state)
}

function saveLocalRegistryFromRecords(records: BoardRecord[]) {
  writeRegistryCache(records.map(boardMetaFromRecord))
  for (const record of records) {
    saveLocalBoard(record.id, record.data)
  }
}

async function migrateLocalBoardsToRemote(): Promise<BoardRecord[]> {
  const localBoards = readRegistryCache()
  if (localBoards.length === 0) return []

  const migrated: BoardRecord[] = []
  for (const board of localBoards) {
    const state = readBoardCache(board.id)
    const record = await saveBoardRemote(board.id, board.name, state)
    migrated.push(record)
    saveLocalBoard(record.id, record.data)
  }
  writeRegistryCache(migrated.map(boardMetaFromRecord))
  return migrated
}

function ensureLocalBoard(boardId: string, state: BoardState) {
  writeBoardCache(boardId, state)
  const registry = readRegistryCache()
  if (!registry.some((board) => board.id === boardId)) {
    const next = [...registry, boardMetaFromState(boardId, state)]
    writeRegistryCache(next)
  }
}

export function loadBoard(boardId: string): BoardState {
  return readBoardCache(boardId)
}

// Verwaltet die Board-Liste + welches Board gerade aktiv ist.
// Beides wird im localStorage als schneller Cache gespiegelt und in Postgres
// synchron gehalten.
export function useBoards() {
  const [boards, setBoards] = useState<BoardRecord[]>([])
  const [, bumpSyncTick] = useState(0)
  const [activeId, setActiveIdState] = useState<string>(() => {
    const urlBoard = getActiveIdFromUrl()
    if (urlBoard) return urlBoard
    const stored = localStorage.getItem(ACTIVE_KEY)
    const cached = readRegistryCache()
    return stored && cached.some((board) => board.id === stored) ? stored : cached[0]?.id ?? ''
  })
  const initializedRef = useRef(false)
  const activeIdRef = useRef(activeId)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    const handler = () => bumpSyncTick((value) => value + 1)
    window.addEventListener(CACHE_EVENT, handler)
    return () => window.removeEventListener(CACHE_EVENT, handler)
  }, [])

  useEffect(() => {
    setActiveIdCache(activeId)
    setActiveIdInUrl(activeId)
  }, [activeId])

  useEffect(() => {
    let cancelled = false

    function recordsFromCachedRegistry(): BoardRecord[] {
      return readRegistryCache().map((meta) => {
        const data = readBoardCache(meta.id)
        return {
          id: meta.id,
          name: meta.name,
          data,
          createdAt: meta.createdAt,
          updatedAt: meta.createdAt,
        }
      })
    }

    async function hydrate() {
      try {
        const remoteBoards = await fetchBoards()
        if (cancelled) return

        if (remoteBoards.length > 0) {
          saveLocalRegistryFromRecords(remoteBoards)
          setBoards(remoteBoards)
          if (!remoteBoards.some((board) => board.id === activeIdRef.current)) {
            setActiveIdState(remoteBoards[0].id)
          }
        } else {
          const migrated = await migrateLocalBoardsToRemote()
          if (cancelled) return

          if (migrated.length > 0) {
            setBoards(migrated)
            if (!migrated.some((board) => board.id === activeIdRef.current)) {
              setActiveIdState(migrated[0].id)
            }
          } else {
            const freshState = createEmptyBoard()
            const freshId = crypto.randomUUID()
            const freshRecord = await saveBoardRemote(freshId, 'Neues Board', freshState)
            if (cancelled) return
            saveLocalRegistryFromRecords([freshRecord])
            setBoards([freshRecord])
            setActiveIdState(freshRecord.id)
          }
        }
      } catch {
        if (!cancelled) {
          const cached = recordsFromCachedRegistry()
          if (cached.length > 0) {
            setBoards(cached)
            if (!cached.some((board) => board.id === activeIdRef.current)) {
              setActiveIdState(cached[0].id)
            }
          } else {
            const freshState = createEmptyBoard()
            const freshId = crypto.randomUUID()
            const freshRecord = {
              id: freshId,
              name: 'Neues Board',
              data: freshState,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }
            ensureLocalBoard(freshRecord.id, freshState)
            setBoards([freshRecord])
            setActiveIdState(freshRecord.id)
          }
        }
      } finally {
        if (!cancelled) initializedRef.current = true
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!initializedRef.current) return

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const remoteBoards = await fetchBoards()
          saveLocalRegistryFromRecords(remoteBoards)
          setBoards(remoteBoards)
          if (remoteBoards.length > 0 && !remoteBoards.some((board) => board.id === activeIdRef.current)) {
            setActiveIdState(remoteBoards[0].id)
          }
        } catch {
          // локaler Cache bleibt bestehen, wenn die Datenbank kurz nicht erreichbar ist
        }
      })()
    }, 30000)

    return () => window.clearInterval(interval)
  }, [activeId])

  function setActiveId(boardId: string) {
    setActiveIdState(boardId)
  }

  async function createBoard(name: string, initialState: BoardState = createEmptyBoard()) {
    const boardId = crypto.randomUUID()
    const localRecord: BoardRecord = {
      id: boardId,
      name,
      data: initialState,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const nextBoards = [...boards, localRecord]
    setBoards(nextBoards)
    setActiveIdState(boardId)
    ensureLocalBoard(boardId, initialState)
    try {
      const record = await saveBoardRemote(boardId, name, initialState)
      saveLocalBoard(record.id, record.data)
      const nextRegistry = nextBoards.map((board) => (board.id === record.id ? record : board))
      writeRegistryCache(nextRegistry)
      setBoards(nextRegistry)
    } catch {
      writeRegistryCache(nextBoards.map(boardMetaFromRecord))
    }
  }

  async function renameBoard(id: string, name: string) {
    setBoards((current) => current.map((board) => (board.id === id ? { ...board, name } : board)))
    const state = readBoardCache(id)
    ensureLocalBoard(id, state)
    try {
      await saveBoardRemote(id, name, state)
      const registry = readRegistryCache().map((board) => (board.id === id ? { ...board, name } : board))
      writeRegistryCache(registry)
    } catch {
      // local cache bleibt gültig
    }
  }

  async function removeBoard(id: string) {
    deleteBoardCache(id)
    const rest = boards.filter((board) => board.id !== id)
    try {
      await deleteBoardRemote(id)
    } catch {
      // offline oder DB nicht erreichbar → lokale Sicht bleibt trotzdem konsistent
    }

    if (rest.length === 0) {
      const freshState = createEmptyBoard()
      const freshId = crypto.randomUUID()
      const fresh: BoardRecord = {
        id: freshId,
        name: 'Neues Board',
        data: freshState,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setBoards([fresh])
      setActiveIdState(freshId)
      ensureLocalBoard(freshId, freshState)
      try {
        await saveBoardRemote(freshId, fresh.name, freshState)
        writeRegistryCache([boardMetaFromRecord(fresh)])
      } catch {
        writeRegistryCache([boardMetaFromRecord(fresh)])
      }
      return
    }

    setBoards(rest)
    if (id === activeId) setActiveIdState(rest[0].id)
    writeRegistryCache(rest)
  }

  return {
    boards,
    activeId,
    setActiveId,
    createBoard,
    renameBoard,
    removeBoard,
  }
}

// React-Hook: verhält sich wie useState, schreibt aber bei jeder
// Änderung automatisch in localStorage und in Postgres.
// Wichtig: Die Komponente, die diesen Hook nutzt, wird beim Board-Wechsel
// per key={boardId} neu aufgebaut – deshalb reicht der useState-Initializer.
export function useBoard(boardId: string) {
  const [board, setBoard] = useState<BoardState>(() => loadBoard(boardId))
  const hydratedRef = useRef(false)

  useEffect(() => {
    hydratedRef.current = false
    setBoard(loadBoard(boardId))

    let cancelled = false
    void (async () => {
      try {
        const remote = await fetchBoard(boardId)
        if (cancelled) return
        if (remote) {
          const normalized = normalizeBoard(remote.data, remote.id)
          saveLocalBoard(remote.id, normalized)
          setBoard(normalized)
        } else {
          const cached = loadBoard(boardId)
          const record = await saveBoardRemote(
            boardId,
            getBoardNameFromCache(boardId) || cached.partyDetails.forWhom.trim() || cached.topic.trim() || 'Neues Board',
            cached
          )
          if (cancelled) return
          saveLocalBoard(record.id, normalizeBoard(record.data, record.id))
          setBoard(normalizeBoard(record.data, record.id))
        }
      } catch {
        // локaler Cache bleibt erhalten
      } finally {
        if (!cancelled) hydratedRef.current = true
      }
    })()

    return () => {
      cancelled = true
    }
  }, [boardId])

  useEffect(() => {
    if (!hydratedRef.current) return
    saveLocalBoard(boardId, board)
    const boardName =
      getBoardNameFromCache(boardId) || board.partyDetails.forWhom.trim() || board.topic.trim() || 'Neues Board'

    const timeout = window.setTimeout(() => {
      void saveBoardRemote(boardId, boardName, board).catch(() => {
        // local cache bleibt als Fallback erhalten.
      })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [boardId, board])

  useEffect(() => {
    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const remote = await fetchBoard(boardId)
          if (!remote) return
          const normalized = normalizeBoard(remote.data, remote.id)
          const current = JSON.stringify(board)
          const incoming = JSON.stringify(normalized)
          if (current !== incoming) {
            saveLocalBoard(boardId, normalized)
            setBoard(normalized)
          }
        } catch {
          // Kein harter Fehler, der Cache bleibt aktiv.
        }
      })()
    }, 15000)

    return () => window.clearInterval(interval)
  }, [board, boardId])

  return [board, setBoard] as const
}
