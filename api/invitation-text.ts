import type { VercelRequest, VercelResponse } from '@vercel/node'
import { askOpenAIInvitation } from './_openai.js'
import {
  buildInvitationUserMessage,
  buildSystemInvitationPrompt,
  normalizePromptLanguage,
} from '../src/lib/prompts.js'

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
    const text = await askOpenAIInvitation(
      buildSystemInvitationPrompt(language),
      buildInvitationUserMessage(topic, partyDetails, language)
    )
    res.status(200).json({ text })
  } catch (error) {
    console.error('invitation-text API failed', error)
    res.status(502).json({ error: 'Einladungstext konnte nicht erstellt werden' })
  }
}
