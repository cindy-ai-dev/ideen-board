import OpenAI from 'openai'
import { IDEAS_SCHEMA, MODEL, type RawIdea } from '../src/lib/prompts.js'
import {
  SHOPPING_SCHEMA,
  type RawShoppingItem,
} from '../src/lib/prompts.js'

// Gemeinsamer Kern beider API-Funktionen. Läuft NUR auf dem Server –
// der Key kommt aus der Vercel-Umgebungsvariable OPENAI_API_KEY
// (ohne VITE_-Prefix: damit kann er nie ins Browser-Bundle rutschen).
type JsonSchema = typeof IDEAS_SCHEMA | typeof SHOPPING_SCHEMA

async function askOpenAIJson<T>(
  system: string,
  userMessage: string,
  schema: JsonSchema,
  responseName: string,
  maxOutputTokens = 1800
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.VITE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  const client = new OpenAI({ apiKey })

  const response = await client.responses.create({
    model: MODEL,
    max_output_tokens: maxOutputTokens,
    instructions: system,
    input: userMessage,
    text: {
      format: {
        type: 'json_schema',
        name: responseName,
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

async function askOpenAIJsonWithRetry<T>(options: {
  system: string
  userMessage: string
  retryUserMessage?: string
  schema: JsonSchema
  responseName: string
  maxOutputTokens?: number
  retryMaxOutputTokens?: number
}): Promise<T> {
  try {
    return await askOpenAIJson<T>(
      options.system,
      options.userMessage,
      options.schema,
      options.responseName,
      options.maxOutputTokens
    )
  } catch (error) {
    if (!isTruncatedJsonError(error) || !options.retryUserMessage) {
      throw error
    }
    return await askOpenAIJson<T>(
      options.system,
      options.retryUserMessage,
      options.schema,
      options.responseName,
      options.retryMaxOutputTokens ?? Math.max(600, Math.floor((options.maxOutputTokens ?? 1800) / 2))
    )
  }
}

export async function askOpenAI(system: string, userMessage: string): Promise<RawIdea[]> {
  const data = await askOpenAIJson<{ ideas: RawIdea[] }>(system, userMessage, IDEAS_SCHEMA, 'ideas')
  return data.ideas
}

export async function askOpenAIShopping(
  system: string,
  userMessage: string,
  retryUserMessage: string
): Promise<RawShoppingItem[]> {
  const data = await askOpenAIJsonWithRetry<{ items: RawShoppingItem[] }>({
    system,
    userMessage,
    retryUserMessage,
    schema: SHOPPING_SCHEMA,
    responseName: 'shopping_items',
    maxOutputTokens: 1800,
    retryMaxOutputTokens: 900,
  })
  return data.items
}
