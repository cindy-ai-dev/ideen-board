import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildSystemStartPrompt, buildStartUserMessage, normalizePromptLanguage } from '../src/lib/prompts.js'
import { askOpenAI } from './_openai.js'

// POST /api/ideas  { topic: string, partyDetails?: object }  →  { ideas: RawIdea[] }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Nur POST erlaubt' })
    return
  }
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : ''
  const partyDetails = req.body?.partyDetails
  const language = normalizePromptLanguage(req.body?.language)
  if (topic.length > 300) {
    res.status(400).json({ error: 'Ungültiges Thema' })
    return
  }
  try {
    const ideas = await askOpenAI(
      buildSystemStartPrompt(language),
      buildStartUserMessage(topic, partyDetails, language)
    )
    res.status(200).json({ ideas })
  } catch {
    res.status(502).json({ error: 'Ideen konnten nicht geladen werden' })
  }
}
