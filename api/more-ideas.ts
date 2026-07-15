import type { VercelRequest, VercelResponse } from '@vercel/node'
import { SYSTEM_MORE, buildMoreUserMessage } from '../src/lib/prompts.js'
import { askOpenAI } from './_openai.js'

// POST /api/more-ideas  { topic, category, existingTitles }  →  { ideas }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Nur POST erlaubt' })
    return
  }
  const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : ''
  const category = typeof req.body?.category === 'string' ? req.body.category.trim() : ''
  const existingTitles: string[] = Array.isArray(req.body?.existingTitles)
    ? req.body.existingTitles.filter((t: unknown) => typeof t === 'string').slice(0, 100)
    : []
  if (!category || category.length > 100 || topic.length > 300) {
    res.status(400).json({ error: 'Ungültige Anfrage' })
    return
  }
  try {
    const ideas = await askOpenAI(SYSTEM_MORE, buildMoreUserMessage(topic, category, existingTitles))
    res.status(200).json({ ideas })
  } catch {
    res.status(502).json({ error: 'Ideen konnten nicht geladen werden' })
  }
}
