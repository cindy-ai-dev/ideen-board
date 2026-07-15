import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askOpenAISchedule } from './_openai.js'
import {
  SYSTEM_SCHEDULE,
  buildScheduleUserMessage,
  buildScheduleUserMessageCompact,
  type ShoppingSourceTile,
} from '../src/lib/prompts.js'

function parseSelectedTiles(input: unknown): ShoppingSourceTile[] {
  if (!Array.isArray(input)) return []
  return input
    .map((tile) => {
      if (typeof tile !== 'object' || tile === null) return null
      const title = typeof tile.title === 'string' ? tile.title.trim() : ''
      const category = typeof tile.category === 'string' ? tile.category.trim() : ''
      if (!title || !category) return null
      return {
        title,
        category,
        description: typeof tile.description === 'string' ? tile.description.trim() : undefined,
      }
    })
    .filter((tile) => tile !== null) as ShoppingSourceTile[]
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Nur POST erlaubt' })
    return
  }

  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : ''
  const partyDetails = req.body?.partyDetails
  const selectedTiles = parseSelectedTiles(req.body?.selectedTiles).slice(0, 40)

  if (topic.length > 300) {
    res.status(400).json({ error: 'Ungültiges Thema' })
    return
  }

  try {
    const items = await askOpenAISchedule(
      SYSTEM_SCHEDULE,
      buildScheduleUserMessage(topic, partyDetails, selectedTiles),
      buildScheduleUserMessageCompact(topic, partyDetails, selectedTiles)
    )
    res.status(200).json({ items })
  } catch (error) {
    console.error('schedule API failed', {
      topic,
      selectedCount: selectedTiles.length,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    res.status(502).json({ error: 'Ablaufplan konnte nicht geladen werden' })
  }
}
