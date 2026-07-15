import type { Tile } from '../types'
import {
  IDEAS_SCHEMA,
  MODEL,
  SYSTEM_START,
  SYSTEM_MORE,
  buildMoreUserMessage,
  type RawIdea,
} from './prompts'

// Zwei Wege zum selben Ziel:
//
// LOKAL (npm run dev): Der Browser ruft die OpenAI API direkt auf,
//   mit dem Key aus .env.local. Okay, weil nur du die Seite siehst.
//
// VERÖFFENTLICHT: Der Browser ruft UNSERE Server-Funktionen unter
//   /api/... auf. Nur die kennen den Key – Besucher der Seite können
//   ihn nicht auslesen. Das ist der "Proxy" aus Session 1.
//
// import.meta.env.DEV ist Vites eingebauter Schalter dafür.

async function callOpenAIDirect(system: string, userMessage: string): Promise<RawIdea[]> {
  // SDK nur im Dev-Modus laden – so landet es gar nicht erst im
  // veröffentlichten Bundle (kleiner + kein Key-Code beim Besucher).
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.responses.create({
    model: MODEL,
    max_output_tokens: 1200,
    instructions: system,
    input: userMessage,
    text: {
      format: {
        type: 'json_schema',
        name: 'ideas',
        strict: true,
        schema: IDEAS_SCHEMA,
      },
    },
  })

  if (!response.output_text) {
    throw new Error('Keine Antwort von der API erhalten')
  }
  return (JSON.parse(response.output_text) as { ideas: RawIdea[] }).ideas
}

async function callProxy(endpoint: string, body: object): Promise<RawIdea[]> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Ideen konnten nicht geladen werden')
  return ((await res.json()) as { ideas: RawIdea[] }).ideas
}

function toTiles(ideas: RawIdea[], boardId: string, forceCategory?: string): Tile[] {
  return ideas.map((idea) => ({
    id: crypto.randomUUID(),
    boardId,
    kind: 'idea' as const,
    title: idea.title,
    description: idea.description,
    // Bei "Mehr davon" fixieren wir die Kategorie client-seitig, egal was
    // das Modell liefert – der Nachschub soll garantiert in der
    // angefragten Gruppe landen.
    category: forceCategory ?? idea.category,
    createdAt: Date.now(),
  }))
}

export async function generateIdeas(topic: string, boardId: string): Promise<Tile[]> {
  const ideas = import.meta.env.DEV
    ? await callOpenAIDirect(SYSTEM_START, `Thema: ${topic}`)
    : await callProxy('/api/ideas', { topic })
  return toTiles(ideas, boardId)
}

export async function generateMoreIdeas(
  topic: string,
  category: string,
  existingTitles: string[],
  boardId: string
): Promise<Tile[]> {
  const ideas = import.meta.env.DEV
    ? await callOpenAIDirect(SYSTEM_MORE, buildMoreUserMessage(topic, category, existingTitles))
    : await callProxy('/api/more-ideas', { topic, category, existingTitles })
  return toTiles(ideas, boardId, category)
}
