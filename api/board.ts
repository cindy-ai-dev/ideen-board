import type { VercelRequest, VercelResponse } from '@vercel/node'
import { deleteBoard, getBoard, upsertBoard } from './_db.js'
import type { BoardState } from '../src/types.js'

function parseBoardState(input: unknown): BoardState | null {
  if (typeof input !== 'object' || input === null) return null
  return input as BoardState
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
  if (!id) {
    res.status(400).json({ error: 'Ungültige Board-ID' })
    return
  }

  try {
    if (req.method === 'GET') {
      const board = await getBoard(id)
      if (!board) {
        res.status(404).json({ error: 'Board nicht gefunden' })
        return
      }
      res.status(200).json({ board })
      return
    }

    if (req.method === 'PUT') {
      const name = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
      const data = parseBoardState(req.body?.data)
      if (!name || !data) {
        res.status(400).json({ error: 'Ungültige Board-Daten' })
        return
      }
      const board = await upsertBoard(id, name, data)
      res.status(200).json({ board })
      return
    }

    if (req.method === 'DELETE') {
      await deleteBoard(id)
      res.status(200).json({ ok: true })
      return
    }

    res.status(405).json({ error: 'Nur GET, PUT und DELETE erlaubt' })
  } catch {
    res.status(502).json({ error: 'Board konnte nicht gespeichert werden' })
  }
}
