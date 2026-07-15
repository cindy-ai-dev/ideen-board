import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listBoards } from './_db.js'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const boards = await listBoards()
    res.status(200).json({ boards })
  } catch {
    res.status(502).json({ error: 'Boards konnten nicht geladen werden' })
  }
}
