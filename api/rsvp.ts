import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBoard, getBoardByRsvpToken, upsertBoard } from './_db.js'
import type { Guest, GuestStatus } from '../src/types.js'

function normalizeGuestKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function isGuestStatus(value: unknown): value is GuestStatus {
  return value === 'eingeladen' || value === 'zugesagt' || value === 'abgesagt'
}

function publicPartyDetails(board: Awaited<ReturnType<typeof getBoardByRsvpToken>>): {
  forWhom: string
  theme: string
  streetAddress: string
  city: string
  date: string
  time: string
} | null {
  if (!board) return null
  const { partyDetails } = board.data
  return {
    forWhom: partyDetails.forWhom,
    theme: partyDetails.theme,
    streetAddress:
      typeof partyDetails.streetAddress === 'string'
        ? partyDetails.streetAddress
        : typeof (partyDetails as { location?: unknown }).location === 'string'
          ? ((partyDetails as { location?: string }).location ?? '')
          : '',
    city: typeof partyDetails.city === 'string' ? partyDetails.city : '',
    date: partyDetails.date,
    time: partyDetails.time,
  }
}

async function loadRsvpBoard(token: string, boardId: string | null) {
  const byToken = await getBoardByRsvpToken(token)
  if (byToken) return byToken
  if (!boardId) return null
  return getBoard(boardId)
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

function upsertGuest(
  guests: Guest[],
  name: string,
  status: GuestStatus,
  allergies?: string,
  personCount?: number
): Guest[] {
  const key = normalizeGuestKey(name)
  const existingIndex = guests.findIndex((guest) => normalizeGuestKey(guest.name) === key)
  if (existingIndex >= 0) {
    return guests.map((guest, index) =>
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
    ...guests,
    {
      id: crypto.randomUUID(),
      name: name.trim(),
      status,
      personCount: typeof personCount === 'number' && personCount > 0 ? personCount : 1,
      allergies: normalizeOptionalText(allergies),
    },
  ]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
  const boardId = typeof req.query.board === 'string' ? req.query.board.trim() : ''
  if (!token) {
    res.status(400).json({ error: 'Ungültiger RSVP-Link' })
    return
  }

  try {
    const board = await loadRsvpBoard(token, boardId || null)
    if (!board) {
      res.status(404).json({ error: 'Einladung nicht gefunden' })
      return
    }

    if (req.method === 'GET') {
      res.status(200).json({
        board: {
          boardId: board.id,
          token,
          partyDetails: publicPartyDetails(board),
        },
      })
      return
    }

    if (req.method === 'PUT') {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
      const status = req.body?.status
      const allergies = req.body?.allergies
      const personCount =
        typeof req.body?.personCount === 'number'
          ? req.body.personCount
          : typeof req.body?.personCount === 'string'
            ? Number.parseInt(req.body.personCount, 10)
            : undefined
      if (!name || !isGuestStatus(status)) {
        res.status(400).json({ error: 'Ungültige Gästedaten' })
        return
      }

      const nextBoard = {
        ...board,
        data: {
          ...board.data,
          partyDetails: {
            ...board.data.partyDetails,
            guests: upsertGuest(board.data.partyDetails.guests, name, status, allergies, personCount),
          },
        },
      }

      const saved = await upsertBoard(nextBoard.id, nextBoard.name, nextBoard.data)
      res.status(200).json({
        ok: true,
        name,
        status,
        board: {
          boardId: saved.id,
          token,
          partyDetails: publicPartyDetails(saved),
        },
      })
      return
    }

    res.status(405).json({ error: 'Nur GET und PUT erlaubt' })
  } catch {
    res.status(502).json({ error: 'RSVP konnte nicht gespeichert werden' })
  }
}
