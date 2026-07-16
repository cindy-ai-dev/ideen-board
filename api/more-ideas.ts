import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildSystemMorePrompt, buildMoreUserMessage, normalizePromptLanguage } from '../src/lib/prompts.js'
import { askOpenAI } from './_openai.js'

// POST /api/more-ideas  { topic, partyDetails?, category, existingTitles }  →  { ideas }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Nur POST erlaubt' })
    return
  }
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : ''
  const partyDetails = req.body?.partyDetails
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : ''
  const language = normalizePromptLanguage(req.body?.language)
  const existingTitles: string[] = Array.isArray(req.body?.existingTitles)
    ? req.body.existingTitles.filter((t: unknown) => typeof t === 'string').slice(0, 100)
    : []
  if (!category || category.length > 100 || topic.length > 300) {
    res.status(400).json({ error: 'Ungültige Anfrage' })
    return
  }
  try {
    const ideas = await askOpenAI(
      buildSystemMorePrompt(language),
      buildMoreUserMessage(topic, partyDetails, category, existingTitles, language)
    )
    res.status(200).json({ ideas })
  } catch {
    res.status(502).json({ error: 'Ideen konnten nicht geladen werden' })
  }
}
