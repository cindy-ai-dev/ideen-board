import type { GuestStatus, PartyDetails } from '../types'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error('Request failed')
  }
  return (await res.json()) as T
}

export interface PublicRsvpBoard {
  token: string
  boardId?: string
  partyDetails: Pick<PartyDetails, 'forWhom' | 'theme' | 'location' | 'date' | 'time'>
}

export async function fetchPublicRsvpBoard(token: string, boardId?: string): Promise<PublicRsvpBoard> {
  const url = new URL('/api/rsvp', window.location.origin)
  url.searchParams.set('token', token)
  if (boardId) url.searchParams.set('board', boardId)
  const res = await fetch(url)
  const json = await parseJson<{ board: PublicRsvpBoard }>(res)
  return json.board
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
  if (boardId) url.searchParams.set('board', boardId)
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, status, allergies, personCount }),
  })
  const json = await parseJson<{ ok: true; status: GuestStatus; name: string }>(res)
  return json
}
