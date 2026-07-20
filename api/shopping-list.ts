import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askOpenAIShopping } from './_openai.js'
import {
  buildSystemShoppingPrompt,
  buildShoppingUserMessage,
  buildShoppingUserMessageCompact,
  normalizePromptLanguage,
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
  const language = normalizePromptLanguage(req.body?.language)

  if (topic.length > 300) {
    res.status(400).json({ error: 'Ungültiges Thema' })
    return
  }

  try {
    console.info('shopping-list API started', { selectedCount: selectedTiles.length, language })
    const items = await askOpenAIShopping(
      buildSystemShoppingPrompt(language),
      buildShoppingUserMessage(topic, partyDetails, selectedTiles, language),
      buildShoppingUserMessageCompact(topic, partyDetails, selectedTiles, language)
    )
    if (!Array.isArray(items)) throw new Error('OpenAI response did not contain an items array')
    console.info('shopping-list API succeeded', { itemCount: items.length })
    res.status(200).json({ items })
  } catch (error) {
    console.error('shopping-list API failed', {
      topic,
      selectedCount: selectedTiles.length,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    res.status(502).json({ error: 'Einkaufsliste konnte nicht geladen werden' })
  }
}
