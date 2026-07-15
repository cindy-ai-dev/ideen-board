import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SYSTEM_START } from '../src/lib/prompts.js'
import { askClaude } from './_claude.js'

// POST /api/ideas  { topic: string }  →  { ideas: RawIdea[] }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Nur POST erlaubt' })
    return
  }
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : ''
  if (!topic || topic.length > 300) {
    res.status(400).json({ error: 'Ungültiges Thema' })
    return
  }
  try {
    const ideas = await askClaude(SYSTEM_START, `Thema: ${topic}`)
    res.status(200).json({ ideas })
  } catch {
    res.status(502).json({ error: 'Ideen konnten nicht geladen werden' })
  }
}
