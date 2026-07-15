import type { PartyDetails } from '../types'

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

// Luna ist die kostengünstigste GPT-5.6-Variante und für das Ideen-Board
// während der Entwicklung ausreichend. Für die finale Abgabe kann dieser
// Wert bei Bedarf wieder auf ein stärkeres Modell wechseln.
export const MODEL = 'gpt-5.6-luna'

function normalizeText(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function formatGuestCount(guestCount: PartyDetails['guestCount']): string {
  return typeof guestCount === 'number' ? `ca. ${guestCount}` : ''
}

export function summarizePartyDetails(details?: PartyDetails | null): string {
  const safe = details ?? {
    forWhom: '',
    theme: '',
    location: '',
    date: '',
    time: '',
    guestCount: null,
    guests: [],
  }

  const lines: string[] = []
  const forWhom = normalizeText(safe.forWhom)
  const theme = normalizeText(safe.theme)
  const location = normalizeText(safe.location)
  const date = normalizeText(safe.date)
  const time = normalizeText(safe.time)
  const guestCount = formatGuestCount(safe.guestCount)
  const guests = safe.guests
    .map((guest) => `${guest.name} (${guest.status})`)
    .filter(Boolean)

  if (theme) lines.push(`Motto: ${theme}`)
  if (forWhom) lines.push(`Für wen / Anlass: ${forWhom}`)
  if (location) lines.push(`Ort: ${location}`)
  if (date || time) lines.push(`Termin: ${[date, time].filter(Boolean).join(' · ')}`)
  if (guestCount) lines.push(`Gästezahl: ${guestCount}`)
  if (guests.length > 0) lines.push(`Gästeliste: ${guests.join(', ')}`)

  return lines.join('\n')
}

function buildTopicFallback(topic: string, details?: PartyDetails | null): string {
  const trimmedTopic = normalizeText(topic)
  if (trimmedTopic) return trimmedTopic
  if (details?.forWhom) return details.forWhom.trim()
  return 'Partyplanung'
}

function buildContextBlock(topic: string, details?: PartyDetails | null): string {
  const lines = [`Thema: ${buildTopicFallback(topic, details)}`]
  const detailsBlock = summarizePartyDetails(details)
  if (detailsBlock) {
    lines.push('Party-Details:')
    lines.push(detailsBlock)
  }
  return lines.join('\n')
}

export const SYSTEM_START =
  'Du bist ein kreativer Planungs-Assistent für Partyplanung. Der User sammelt Ideen zu ' +
  'einem konkreten Anlass auf einem visuellen Board. Nutze das Motto, falls vorhanden, als ' +
  'wichtigsten kreativen Leitfaden und richte Deko-, Spiele- und Essensideen besonders daran aus. ' +
  'Nutze danach die Party-Details als echten Kontext: Berücksichtige Anlass, Alter, Ort, Termin, ' +
  'Gästezahl und die Gästeliste. Bei Kinderpartys sollen die Ideen altersgerecht sein; bei größeren ' +
  'Gruppen sollen Mengen, Portionsgrößen oder Abläufe zur Gästezahl passen. Erzeuge 8 bis 12 konkrete, ' +
  'umsetzbare Ideen. Wähle 4 bis 6 zum Anlass passende Kategorien selbst (z.B. Motto, Deko, Spiele, ' +
  'Essen, Mitgebsel, Zeitplan, Einkauf). ' +
  'Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp. Antworte auf Deutsch.'

export const SYSTEM_MORE =
  'Du bist ein kreativer Planungs-Assistent für Partyplanung. Der User sammelt Ideen zu einem ' +
  'konkreten Anlass auf einem visuellen Board und möchte Nachschub für eine bestimmte Kategorie. ' +
  'Nutze das Motto, falls vorhanden, als wichtigsten Kontext und bleibe bei derselben Party. Danach ' +
  'nutze die Party-Details als Kontext. Erzeuge 3 bis 5 neue Ideen ' +
  'NUR für die genannte Kategorie. Wiederhole keine der bereits vorhandenen Ideen und schlage nichts ' +
  'sehr Ähnliches vor. Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp. ' +
  'Antworte auf Deutsch.'

export function buildStartUserMessage(topic: string, details?: PartyDetails | null): string {
  return buildContextBlock(topic, details)
}

export function buildMoreUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  category: string,
  existingTitles: string[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    `Kategorie für den Nachschub: ${category}`,
    `Bereits vorhandene Ideen (nicht wiederholen):`,
    ...existingTitles.map((t) => `- ${t}`),
  ]
  return lines.join('\n')
}

export interface RawIdea {
  title: string
  description: string
  category: string
}
