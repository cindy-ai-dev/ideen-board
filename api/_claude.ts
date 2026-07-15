import Anthropic from '@anthropic-ai/sdk'
import { IDEAS_SCHEMA, MODEL, type RawIdea } from '../src/lib/prompts.js'

// Gemeinsamer Kern beider API-Funktionen. Läuft NUR auf dem Server –
// der Key kommt aus der Vercel-Umgebungsvariable ANTHROPIC_API_KEY
// (ohne VITE_-Prefix: damit kann er nie ins Browser-Bundle rutschen).
export async function askClaude(system: string, userMessage: string): Promise<RawIdea[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      format: { type: 'json_schema', schema: IDEAS_SCHEMA },
    },
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Keine Antwort von der API erhalten')
  }
  return (JSON.parse(textBlock.text) as { ideas: RawIdea[] }).ideas
}
