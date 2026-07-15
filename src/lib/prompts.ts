// Gemeinsame Bausteine für die OpenAI-Anfragen. Dieses Modul wird von
// ZWEI Seiten benutzt: vom Browser (lokale Entwicklung) und von den
// Server-Funktionen unter /api (veröffentlichte Version). So bleiben
// Prompts und Schema garantiert identisch.

export const IDEAS_SCHEMA = {
  type: 'object',
  properties: {
    ideas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['title', 'description', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['ideas'],
  additionalProperties: false,
} as const

export const MODEL = 'gpt-5.6'

export const SYSTEM_START =
  'Du bist ein kreativer Planungs-Assistent. Der User sammelt Ideen zu einem Projekt ' +
  'auf einem visuellen Board. Erzeuge 8 bis 12 konkrete, umsetzbare Ideen zum genannten Thema. ' +
  'Wähle 4 bis 6 zum Thema passende Kategorien selbst (z.B. bei einem Kindergeburtstag: ' +
  'Motto, Deko, Spiele, Essen, Mitgebsel – bei einer Renovierung eher: Farben, Möbel, Budget, ...). ' +
  'Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp. Antworte auf Deutsch.'

export const SYSTEM_MORE =
  'Du bist ein kreativer Planungs-Assistent. Der User sammelt Ideen zu einem Projekt ' +
  'auf einem visuellen Board und möchte Nachschub für eine bestimmte Kategorie. ' +
  'Erzeuge 3 bis 5 neue Ideen NUR für die genannte Kategorie. ' +
  'Wiederhole keine der bereits vorhandenen Ideen und schlage nichts sehr Ähnliches vor. ' +
  'Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp. Antworte auf Deutsch.'

export function buildMoreUserMessage(
  topic: string,
  category: string,
  existingTitles: string[]
): string {
  return (
    `Thema: ${topic || category}\n` +
    `Kategorie für den Nachschub: ${category}\n` +
    `Bereits vorhandene Ideen (nicht wiederholen):\n` +
    existingTitles.map((t) => `- ${t}`).join('\n')
  )
}

export interface RawIdea {
  title: string
  description: string
  category: string
}
