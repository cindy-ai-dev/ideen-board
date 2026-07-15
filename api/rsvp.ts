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
  location: string
  date: string
  time: string
} | null {
  if (!board) return null
  const { partyDetails } = board.data
  return {
    forWhom: partyDetails.forWhom,
    theme: partyDetails.theme,
    location: partyDetails.location,
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

function upsertGuest(guests: Guest[], name: string, status: GuestStatus): Guest[] {
  const key = normalizeGuestKey(name)
  const existingIndex = guests.findIndex((guest) => normalizeGuestKey(guest.name) === key)
  if (existingIndex >= 0) {
    return guests.map((guest, index) => (index === existingIndex ? { ...guest, status } : guest))
  }

  return [...guests, { id: crypto.randomUUID(), name: name.trim(), status }]
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
            guests: upsertGuest(board.data.partyDetails.guests, name, status),
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
