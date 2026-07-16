import { loadBoard, saveBoardCache } from './storage'
import type { BoardState, GuestStatus, PartyDetails } from '../types'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error('Request failed')
  }
  return (await res.json()) as T
}

function toPublicBoard(boardId: string, token: string, state: BoardState): PublicRsvpBoard {
  return {
    boardId,
    token,
    partyDetails: {
      forWhom: state.partyDetails.forWhom,
      theme: state.partyDetails.theme,
      streetAddress: state.partyDetails.streetAddress,
      city: state.partyDetails.city,
      date: state.partyDetails.date,
      time: state.partyDetails.time,
    },
  }
}

function loadLocalRsvpBoard(token: string, boardId?: string): PublicRsvpBoard | null {
  if (!boardId) return null
  const board = loadBoard(boardId)
  if (!board.rsvpToken || board.rsvpToken.trim() !== token) return null
  return toPublicBoard(boardId, token, board)
}

export interface PublicRsvpBoard {
  token: string
  boardId?: string
  partyDetails: Pick<PartyDetails, 'forWhom' | 'theme' | 'streetAddress' | 'city' | 'date' | 'time'>
}

export async function fetchPublicRsvpBoard(token: string, boardId?: string): Promise<PublicRsvpBoard> {
  const url = new URL('/api/rsvp', window.location.origin)
  url.searchParams.set('token', token)
  url.searchParams.set('rsvp', token)
  url.searchParams.set('rsvpToken', token)
  if (boardId) url.searchParams.set('board', boardId)
  if (boardId) url.searchParams.set('boardId', boardId)
  try {
    const res = await fetch(url)
    const json = await parseJson<{ board: PublicRsvpBoard }>(res)
    return json.board
  } catch (error) {
    console.log('[RSVP] remote load failed, trying local cache fallback', {
      token,
      boardId,
      error: error instanceof Error ? error.message : error,
    })
    const local = loadLocalRsvpBoard(token, boardId)
    if (local) return local
    throw error
  }
}

export async function submitRsvp(
  token: string,
  name: string,
  status: GuestStatus,
  boardId?: string,
  allergies?: string,
  personCount?: number
): Promise<{ ok: true; status: GuestStatus; name: string }> {
  const url = new URL('/api/rsvp', window.location.origin)
  url.searchParams.set('token', token)
  url.searchParams.set('rsvp', token)
  url.searchParams.set('rsvpToken', token)
  if (boardId) url.searchParams.set('board', boardId)
  if (boardId) url.searchParams.set('boardId', boardId)
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, status, allergies, personCount }),
  })
  try {
    const json = await parseJson<{ ok: true; status: GuestStatus; name: string }>(res)
    return json
  } catch (error) {
    console.log('[RSVP] remote submit failed, trying local cache fallback', {
      token,
      boardId,
      name,
      status,
      error: error instanceof Error ? error.message : error,
    })
    const local = loadLocalRsvpBoard(token, boardId)
    if (!local) throw error

    const board = loadBoard(boardId!)
    const nextGuests = (() => {
      const normalizeKey = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
      const key = normalizeKey(name)
      const existingIndex = board.partyDetails.guests.findIndex((guest) => normalizeKey(guest.name) === key)
      if (existingIndex >= 0) {
        return board.partyDetails.guests.map((guest, index) =>
          index === existingIndex
            ? {
                ...guest,
                status,
                allergies: allergies === undefined ? guest.allergies : allergies || undefined,
                personCount: typeof personCount === 'number' && personCount > 0 ? personCount : guest.personCount ?? 1,
              }
            : guest
        )
      }

      return [
        ...board.partyDetails.guests,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          status,
          personCount: typeof personCount === 'number' && personCount > 0 ? personCount : 1,
          allergies: typeof allergies === 'string' && allergies.trim() ? allergies.trim() : undefined,
        },
      ]
    })()

    saveBoardCache(boardId!, {
      ...board,
      partyDetails: {
        ...board.partyDetails,
        guests: nextGuests,
      },
    })

    return { ok: true, status, name }
  }
}
