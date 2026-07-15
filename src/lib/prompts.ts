import type { PartyDetails } from '../types.js'

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

export const SHOPPING_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' },
          label: { type: 'string' },
          note: { type: 'string' },
          priceEuro: { type: 'number' },
        },
        required: ['section', 'label', 'note', 'priceEuro'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

export const TASKS_SCHEMA = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          note: { type: 'string' },
          daysBeforeParty: { type: 'number' },
        },
        required: ['title', 'note', 'daysBeforeParty'],
        additionalProperties: false,
      },
    },
  },
  required: ['tasks'],
  additionalProperties: false,
} as const

export const SCHEDULE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          note: { type: 'string' },
          minutesFromStart: { type: 'number' },
        },
        required: ['title', 'note', 'minutesFromStart'],
        additionalProperties: false,
      },
    },
    backupItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          note: { type: 'string' },
          minutesFromStart: { type: 'number' },
        },
        required: ['title', 'note', 'minutesFromStart'],
        additionalProperties: false,
      },
    },
  },
  required: ['items', 'backupItems'],
  additionalProperties: false,
} as const

// Luna ist die kostengünstigste GPT-5.6-Variante und für PartyHost
// während der Entwicklung ausreichend. Für die finale Abgabe kann dieser
// Wert bei Bedarf wieder auf ein stärkeres Modell wechseln.
export const MODEL = 'gpt-5.6-luna'

export interface RawShoppingItem {
  section: string
  label: string
  note: string
  priceEuro: number
}

export interface RawPlanningTask {
  title: string
  note: string
  daysBeforeParty: number
}

export interface RawPartyScheduleItem {
  title: string
  note: string
  minutesFromStart: number
}

export interface RawPartyScheduleBackupItem {
  title: string
  note: string
  minutesFromStart: number
}

export interface RawPartyScheduleResponse {
  items: RawPartyScheduleItem[]
  backupItems: RawPartyScheduleBackupItem[]
}

export interface ShoppingSourceTile {
  title: string
  description?: string
  category: string
}

function normalizeText(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function formatGuestCount(guestCount: PartyDetails['guestCount']): string {
  return typeof guestCount === 'number' ? `ca. ${guestCount}` : ''
}

export function getConfirmedGuestTotal(details?: PartyDetails | null): number {
  if (!details) return 0
  return details.guests.reduce((sum, guest) => {
    if (guest.status !== 'zugesagt') return sum
    const count = typeof guest.personCount === 'number' && guest.personCount > 0 ? guest.personCount : 1
    return sum + count
  }, 0)
}

export function summarizePartyDetails(details?: PartyDetails | null): string {
  const safe = details ?? {
    forWhom: '',
    theme: '',
    age: null,
    preferences: '',
    responseDeadline: '',
    location: '',
    date: '',
    time: '',
    guestCount: null,
    budgetLimitEuro: null,
    guests: [],
  }

  const lines: string[] = []
  const forWhom = normalizeText(safe.forWhom)
  const theme = normalizeText(safe.theme)
  const preferences = normalizeText(safe.preferences)
  const responseDeadline = normalizeText(safe.responseDeadline)
  const location = normalizeText(safe.location)
  const date = normalizeText(safe.date)
  const time = normalizeText(safe.time)
  const age = typeof safe.age === 'number' && safe.age > 0 ? Math.round(safe.age) : null
  const budgetLimit = typeof safe.budgetLimitEuro === 'number' ? safe.budgetLimitEuro : null
  const guestCount = formatGuestCount(safe.guestCount)
  const confirmedGuestTotal = getConfirmedGuestTotal(safe)
  const guests = safe.guests
    .map((guest) => {
      const allergies = typeof guest.allergies === 'string' && guest.allergies.trim()
        ? `, Allergien/Unverträglichkeiten: ${guest.allergies.trim()}`
        : ''
      const people = guest.status === 'zugesagt'
        ? `, ${typeof guest.personCount === 'number' && guest.personCount > 0 ? guest.personCount : 1} Person${(typeof guest.personCount === 'number' && guest.personCount > 1) ? 'en' : ''}`
        : ''
      return `${guest.name} (${guest.status}${people}${allergies})`
    })
    .filter(Boolean)

  const formattedResponseDeadline = responseDeadline
    ? (() => {
        const parsed = new Date(`${responseDeadline}T12:00:00`)
        if (Number.isNaN(parsed.getTime())) return responseDeadline
        return new Intl.DateTimeFormat('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(parsed)
      })()
    : ''

  if (theme) lines.push(`Motto: ${theme}`)
  if (forWhom) lines.push(`Für wen / Anlass: ${forWhom}`)
  if (age !== null) lines.push(`Alter: ${age}`)
  if (preferences) lines.push(`Vorlieben / Besonderheiten: ${preferences}`)
  if (formattedResponseDeadline) lines.push(`Antwort bis: ${formattedResponseDeadline}`)
  if (location) lines.push(`Ort: ${location}`)
  if (date || time) lines.push(`Termin: ${[date, time].filter(Boolean).join(' · ')}`)
  if (confirmedGuestTotal > 0) {
    lines.push(`Gästezahl: ${confirmedGuestTotal} Person${confirmedGuestTotal === 1 ? '' : 'en'}`)
    if (guestCount) lines.push(`Geplant: ${guestCount}`)
  } else if (guestCount) {
    lines.push(`Gästezahl: ${guestCount}`)
  }
  if (budgetLimit !== null) lines.push(`Budget: ca. ${budgetLimit.toFixed(2).replace('.', ',')} €`)
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
  'Nutze danach die Party-Details als echten Kontext: Berücksichtige Anlass, Alter, Vorlieben, Ort, ' +
  'Termin, Gästezahl und die Gästeliste. Bei Kinderpartys sollen die Ideen altersgerecht sein; bei größeren ' +
  'Gruppen sollen Mengen, Portionsgrößen oder Abläufe zur Gästezahl passen. Erzeuge 8 bis 12 konkrete, ' +
  'umsetzbare Ideen. Wähle 4 bis 6 zum Anlass passende Kategorien selbst (z.B. Motto, Deko, Spiele, ' +
  'Essen, Mitgebsel, Zeitplan, Einkauf). ' +
  'Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp. Antworte auf Deutsch.'

export const SYSTEM_MORE =
  'Du bist ein kreativer Planungs-Assistent für Partyplanung. Der User sammelt Ideen zu einem ' +
  'konkreten Anlass auf einem visuellen Board und möchte Nachschub für eine bestimmte Kategorie. ' +
  'Nutze das Motto, falls vorhanden, als wichtigsten Kontext und bleibe bei derselben Party. Danach ' +
  'nutze die Party-Details als Kontext, inklusive Alter und Vorlieben/Besonderheiten. Erzeuge 3 bis 5 neue Ideen ' +
  'NUR für die genannte Kategorie. Wiederhole keine der bereits vorhandenen Ideen und schlage nichts ' +
  'sehr Ähnliches vor. Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp. ' +
  'Antworte auf Deutsch.'

export const SYSTEM_SHOPPING =
  'Du bist ein pragmatischer Einkaufs-Assistent für Partyplanung. Du sollst aus ausgewählten Ideen, ' +
  'Party-Details und Gästezahl eine konkrete, umsetzbare Einkaufsliste machen. Nutze das Motto, ' +
  'falls vorhanden, als wichtigsten Kontext, dann die übrigen Party-Details inklusive Alter und Vorlieben. ' +
  'Erzeuge keine vagen ' +
  'Ratschläge, sondern konkrete Einkaufsartikel mit sinnvollen Mengen oder Packungsgrößen, wenn ' +
  'das aus dem Kontext ableitbar ist. Berücksichtige bekannte Allergien oder Unverträglichkeiten ' +
  'und schlage bei Bedarf passende Alternativen vor. Gruppiere die Einträge in passende Bereiche. ' +
  'Erzeuge eher 8 bis 12 konkrete Posten als sehr lange Listen. Antworte auf Deutsch.'

export const SYSTEM_TASKS =
  'Du bist ein pragmatischer Planungs-Assistent für Partyvorbereitung. Du sollst aus Party-Details ' +
  'und ausgewählten Ideen eine konkrete, zeitlich gestaffelte Aufgabenliste machen. Nutze das Motto, ' +
  'falls vorhanden, als wichtigsten Kontext, dann die übrigen Party-Details inklusive Alter und Vorlieben. ' +
  'Erzeuge Aufgaben mit ' +
  'praktischen Vorbereitungsschritten, die sich für eine typische Partyplanung eignen. Verteile die ' +
  'Aufgaben über mehrere Zeitpunkte vor der Party, z. B. einige Wochen vorher, 1 Woche vorher, ' +
  '1 Tag vorher und am Party-Tag. Gib für jede Aufgabe einen Wert `daysBeforeParty` an, der angibt, ' +
  'wie viele Tage vor der Party sie idealerweise erledigt werden sollte. Nutze ganze Zahlen, keine ' +
  'Dezimalwerte. Erzeuge eher 6 bis 10 konkrete Aufgaben als sehr lange Listen. Antworte auf Deutsch.'

export const SYSTEM_SCHEDULE =
  'Du bist ein pragmatischer Planungs-Assistent für den eigentlichen Partytag. Du sollst aus ' +
  'Party-Details und ausgewählten Ideen einen zeitlich strukturierten Ablaufplan für den ' +
  'Partytag selbst machen – also ab Beginn der Party, nicht die Vorbereitung vorher. Nutze das ' +
  'Motto, falls vorhanden, als wichtigsten kreativen Leitfaden. Berücksichtige außerdem Anlass, ' +
  'Alter, Vorlieben/Besonderheiten, Gästezahl und den Ort. Leite aus dem Ort ab, ob die Party ' +
  'eher drinnen oder draußen stattfindet, und plane entsprechend flexibel. Erzeuge 5 bis 8 klare, ' +
  'logische Programmpunkte mit einem guten Flow: Begrüßung/Ankommen, Eröffnung, Hauptaktivität, ' +
  'Essen/Kuchen, weitere Aktivität/Spiel, ruhiger Ausklang und Abholung. Gib für jeden Punkt einen ' +
  'Wert `minutesFromStart` an, also die Minuten seit Partybeginn. Wenn eine Party-Uhrzeit bekannt ist, ' +
  'nutze passende Uhrzeiten im Ablauf; wenn nicht, arbeite sauber mit relativen Zeitpunkten wie ' +
  '`nach 30 Min`. Titel kurz und konkret, Beschreibung 1-2 Sätze mit praktischem Tipp. Antworte auf Deutsch.'

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

export function buildShoppingUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    'Aufgabe: Erzeuge daraus eine konkrete Einkaufsliste für die Party.',
    'Wichtige Regeln:',
    '- Nur Artikel ausgeben, die sich sinnvoll aus den ausgewählten Ideen oder den Party-Details ableiten lassen.',
    '- Konkrete Einkaufsartikel nennen, keine losen Ideensätze.',
    '- Mengen oder Packungsgrößen nennen, wenn sie sich aus Gästezahl oder Anlass ableiten lassen.',
    '- Für jeden Posten eine grobe Preisschätzung in Euro angeben.',
    '- Alter sowie Vorlieben/Besonderheiten aus den Party-Details berücksichtigen.',
    '- Bekannte Allergien/Unverträglichkeiten aus den Party-Details berücksichtigen.',
    '- Liste nach sinnvollen Bereichen gruppieren, z. B. Deko, Essen, Getränke, Geschirr, Backen, Sonstiges.',
    '- Keine doppelten oder sehr ähnlichen Artikel.',
    '- Antworte auf Deutsch.',
    'Ausgewählte Ideen als Kontext:',
    ...selectedTiles.map(
      (tile) =>
        `- [${tile.category}] ${tile.title}${tile.description ? ` — ${tile.description}` : ''}`
    ),
  ]
  return lines.join('\n')
}

export function buildShoppingUserMessageCompact(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    'Erzeuge eine kurze Einkaufsliste.',
    'Regeln:',
    '- Nur 6 bis 8 konkrete Posten.',
    '- Kurze, knappe Beschreibungen.',
    '- Maximal ein Satz pro Posten.',
    '- Für jeden Posten eine grobe Preisschätzung in Euro angeben.',
    '- Alter sowie Vorlieben/Besonderheiten berücksichtigen.',
    '- Bekannte Allergien/Unverträglichkeiten berücksichtigen.',
    '- Gruppiere nach Bereich.',
    'Ausgewählte Ideen:',
    ...selectedTiles.map((tile) => `- ${tile.category}: ${tile.title}`),
  ]
  return lines.join('\n')
}

export function buildTasksUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    'Aufgabe: Erzeuge daraus eine zeitlich gestaffelte Checkliste für die Partyvorbereitung.',
    'Wichtige Regeln:',
    '- Nutze die Party-Details, vor allem Datum, Anlass, Motto, Alter, Vorlieben und Gästezahl.',
    '- Nenne konkrete To-dos wie Einladungen, Deko, Einkäufe, Basteln, Essen vorbereiten oder Aufbau.',
    '- Streue die Aufgaben über mehrere Zeitpunkte vor der Party.',
    '- Für jede Aufgabe `daysBeforeParty` als ganze Zahl angeben (z. B. 21, 7, 1, 0).',
    '- Je größer der Wert, desto früher ist die Aufgabe fällig.',
    '- Keine doppelten oder sehr ähnlichen Aufgaben.',
    '- Antworte auf Deutsch.',
    'Ausgewählte Ideen als Kontext:',
    ...selectedTiles.map(
      (tile) =>
        `- [${tile.category}] ${tile.title}${tile.description ? ` — ${tile.description}` : ''}`
    ),
  ]
  return lines.join('\n')
}

export function buildTasksUserMessageCompact(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    'Erzeuge eine kurze Aufgabenliste.',
    'Regeln:',
    '- Nur 5 bis 7 Aufgaben.',
    '- Ganze Zahlen für `daysBeforeParty`.',
    '- Kurze Titel, eine knappe Beschreibung.',
    '- Gute Staffelung: mehrere Wochen vorher bis am Party-Tag.',
    'Ausgewählte Ideen:',
    ...selectedTiles.map((tile) => `- ${tile.category}: ${tile.title}`),
  ]
  return lines.join('\n')
}

export function buildScheduleUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    'Aufgabe: Erzeuge daraus einen Ablaufplan für den Tag der Party selbst.',
    'Wichtige Regeln:',
    '- Plane den Ablauf ab dem Beginn der Party.',
    '- Nutze eine gute Dramaturgie: Ankommen, Begrüßung, erstes Spiel/Eröffnung, Hauptaktivität, Essen/Kuchen, weitere Aktivität, Ausklang/Abholung.',
    '- Berücksichtige Alter sowie Vorlieben/Besonderheiten besonders stark.',
    '- Wenn eine Party-Uhrzeit gesetzt ist, sollen die Programmpunkte in realen Uhrzeiten verständlich sein; ansonsten arbeite mit Minuten seit Start.',
    '- Verwende für jeden Punkt `minutesFromStart` als ganze Zahl.',
    '- Halte den Plan kompakt und realistisch, keine Überladung.',
    '- Zusätzlich liefere 2 bis 4 Backup-Punkte für schlechtes Wetter oder ausgefallene Outdoor-Aktivitäten.',
    '- Gib diese Backup-Punkte als `backupItems` zurück.',
    '- Die Backup-Punkte sollen kurze Titel und knappe Notizen haben und eher Indoor-Alternativen vorschlagen.',
    '- Antworte auf Deutsch.',
    'Ausgewählte Ideen als Kontext:',
    ...selectedTiles.map(
      (tile) =>
        `- [${tile.category}] ${tile.title}${tile.description ? ` — ${tile.description}` : ''}`
    ),
  ]
  return lines.join('\n')
}

export function buildScheduleUserMessageCompact(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[]
): string {
  const lines = [
    buildContextBlock(topic, details),
    'Erzeuge einen kurzen Ablaufplan für die Party.',
    'Regeln:',
    '- Nur 5 bis 6 Programmpunkte.',
    '- Kurze Titel.',
    '- Kurze Notizen, maximal ein Satz.',
    '- minutesFromStart als ganze Zahl.',
    '- Alter sowie Vorlieben/Besonderheiten berücksichtigen.',
    '- Zusätzlich 2 bis 4 Backup-Punkte als `backupItems` für schlechtes Wetter oder Indoor-Alternativen.',
    'Ausgewählte Ideen:',
    ...selectedTiles.map((tile) => `- ${tile.category}: ${tile.title}`),
  ]
  return lines.join('\n')
}

export interface RawIdea {
  title: string
  description: string
  category: string
}
