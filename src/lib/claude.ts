import type { PartyDetails, Tile } from '../types'
import {
  IDEAS_SCHEMA,
  MODEL,
  SYSTEM_START,
  SYSTEM_MORE,
  SHOPPING_SCHEMA,
  SYSTEM_SHOPPING,
  TASKS_SCHEMA,
  SYSTEM_TASKS,
  SCHEDULE_SCHEMA,
  SYSTEM_SCHEDULE,
  buildStartUserMessage,
  buildMoreUserMessage,
  buildShoppingUserMessage,
  buildShoppingUserMessageCompact,
  buildTasksUserMessage,
  buildTasksUserMessageCompact,
  buildScheduleUserMessage,
  buildScheduleUserMessageCompact,
  type RawIdea,
  type RawPartyScheduleResponse,
  type RawPlanningTask,
  type RawShoppingItem,
  type ShoppingSourceTile,
} from './prompts'

type JsonSchema = typeof IDEAS_SCHEMA | typeof SHOPPING_SCHEMA | typeof TASKS_SCHEMA | typeof SCHEDULE_SCHEMA

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

async function callOpenAIDirect<T>(
  system: string,
  userMessage: string,
  schema: JsonSchema,
  name: string,
  maxOutputTokens = 1800
): Promise<T> {
  // SDK nur im Dev-Modus laden – so landet es gar nicht erst im
  // veröffentlichten Bundle (kleiner + kein Key-Code beim Besucher).
  const { default: OpenAI } = await import('openai')
  const client = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  })

  const response = await client.responses.create({
    model: MODEL,
    max_output_tokens: maxOutputTokens,
    instructions: system,
    input: userMessage,
    text: {
      format: {
        type: 'json_schema',
        name,
        strict: true,
        schema,
      },
    },
  })

  if (!response.output_text) {
    throw new Error('Keine Antwort von der API erhalten')
  }
  return JSON.parse(response.output_text) as T
}

function isTruncatedJsonError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /JSON|unterminated|unexpected end|end of JSON/i.test(error.message)
}

async function callProxy<T>(endpoint: string, body: object): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Ideen konnten nicht geladen werden')
  return (await res.json()) as T
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
    selected: false,
    createdAt: Date.now(),
  }))
}

export async function generateIdeas(
  topic: string,
  partyDetails: PartyDetails,
  boardId: string
): Promise<Tile[]> {
  const result = import.meta.env.DEV
    ? await callOpenAIDirect<{ ideas: RawIdea[] }>(
        SYSTEM_START,
        buildStartUserMessage(topic, partyDetails),
        IDEAS_SCHEMA,
        'ideas'
      )
    : await callProxy<{ ideas: RawIdea[] }>('/api/ideas', { topic, partyDetails })
  return toTiles(result.ideas, boardId)
}

export async function generateMoreIdeas(
  topic: string,
  partyDetails: PartyDetails,
  category: string,
  existingTitles: string[],
  boardId: string
): Promise<Tile[]> {
  const result = import.meta.env.DEV
    ? await callOpenAIDirect<{ ideas: RawIdea[] }>(
        SYSTEM_MORE,
        buildMoreUserMessage(topic, partyDetails, category, existingTitles),
        IDEAS_SCHEMA,
        'ideas'
      )
    : await callProxy<{ ideas: RawIdea[] }>('/api/more-ideas', {
        topic,
        partyDetails,
        category,
        existingTitles,
      })
  return toTiles(result.ideas, boardId, category)
}

export async function generateShoppingList(
  topic: string,
  partyDetails: PartyDetails,
  selectedTiles: ShoppingSourceTile[]
): Promise<RawShoppingItem[]> {
  if (import.meta.env.DEV) {
    try {
      const result = await callOpenAIDirect<{ items: RawShoppingItem[] }>(
        SYSTEM_SHOPPING,
        buildShoppingUserMessage(topic, partyDetails, selectedTiles),
        SHOPPING_SCHEMA,
        'shopping_items',
        2200
      )
      return result.items
    } catch (error) {
      if (!isTruncatedJsonError(error)) throw error
      const retry = await callOpenAIDirect<{ items: RawShoppingItem[] }>(
        SYSTEM_SHOPPING,
        buildShoppingUserMessageCompact(topic, partyDetails, selectedTiles),
        SHOPPING_SCHEMA,
        'shopping_items',
        1200
      )
      return retry.items
    }
  }

  const response = await callProxy<{ items: RawShoppingItem[] }>('/api/shopping-list', {
    topic,
    partyDetails,
    selectedTiles,
  })
  return response.items
}

export async function generatePlanningTasks(
  topic: string,
  partyDetails: PartyDetails,
  selectedTiles: ShoppingSourceTile[]
): Promise<RawPlanningTask[]> {
  if (import.meta.env.DEV) {
    try {
      const result = await callOpenAIDirect<{ tasks: RawPlanningTask[] }>(
        SYSTEM_TASKS,
        buildTasksUserMessage(topic, partyDetails, selectedTiles),
        TASKS_SCHEMA,
        'planning_tasks',
        2200
      )
      return result.tasks
    } catch (error) {
      if (!isTruncatedJsonError(error)) throw error
      const retry = await callOpenAIDirect<{ tasks: RawPlanningTask[] }>(
        SYSTEM_TASKS,
        buildTasksUserMessageCompact(topic, partyDetails, selectedTiles),
        TASKS_SCHEMA,
        'planning_tasks',
        1200
      )
      return retry.tasks
    }
  }

  const response = await callProxy<{ tasks: RawPlanningTask[] }>('/api/planning-tasks', {
    topic,
    partyDetails,
    selectedTiles,
  })
  return response.tasks
}

export async function generatePartySchedule(
  topic: string,
  partyDetails: PartyDetails,
  selectedTiles: ShoppingSourceTile[],
  wishes?: string
): Promise<RawPartyScheduleResponse> {
  if (import.meta.env.DEV) {
    try {
      const result = await callOpenAIDirect<RawPartyScheduleResponse>(
        SYSTEM_SCHEDULE,
        buildScheduleUserMessage(topic, partyDetails, selectedTiles, wishes),
        SCHEDULE_SCHEMA,
        'party_schedule',
        1800
      )
      return result
    } catch (error) {
      if (!isTruncatedJsonError(error)) throw error
      const retry = await callOpenAIDirect<RawPartyScheduleResponse>(
        SYSTEM_SCHEDULE,
        buildScheduleUserMessageCompact(topic, partyDetails, selectedTiles, wishes),
        SCHEDULE_SCHEMA,
        'party_schedule',
        1000
      )
      return retry
    }
  }

  const response = await callProxy<RawPartyScheduleResponse>('/api/schedule', {
    topic,
    partyDetails,
    selectedTiles,
    wishes,
  })
  return response
}
