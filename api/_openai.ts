import OpenAI from 'openai'
import { IDEAS_SCHEMA, MODEL, type RawIdea } from '../src/lib/prompts.js'

// Gemeinsamer Kern beider API-Funktionen. Läuft NUR auf dem Server –
// der Key kommt aus der Vercel-Umgebungsvariable OPENAI_API_KEY
// (ohne VITE_-Prefix: damit kann er nie ins Browser-Bundle rutschen).
export async function askOpenAI(system: string, userMessage: string): Promise<RawIdea[]> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await client.responses.create({
    model: MODEL,
    max_output_tokens: 2000,
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
