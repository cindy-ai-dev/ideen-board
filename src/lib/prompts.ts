import type { PartyDetails } from '../types.js'
import { formatPartyAddress } from './location.js'
import de from '../locales/de.js'
import en from '../locales/en.js'

// Gemeinsame Bausteine für die OpenAI-Anfragen. Dieses Modul wird von
// ZWEI Seiten benutzt: vom Browser (lokale Entwicklung) und von den
// Server-Funktionen unter /api (veröffentlichte Version). So bleiben
// Prompts und Schema garantiert identisch.

export type PromptLanguage = 'de' | 'en'

export function normalizePromptLanguage(value?: string | null): PromptLanguage {
  return typeof value === 'string' && value.toLowerCase().startsWith('en') ? 'en' : 'de'
}

function pt(language: PromptLanguage, deText: string, enText: string): string {
  return language === 'en' ? enText : deText
}

function languageInstruction(language: PromptLanguage): string {
  return language === 'en' ? 'Respond in English.' : 'Antworte auf Deutsch.'
}

export function getShoppingSectionLabels(language: PromptLanguage): string[] {
  const source = language === 'en' ? en : de
  return [
    source.shopping.section.deco,
    source.shopping.section.food,
    source.shopping.section.drinks,
    source.shopping.section.tableware,
    source.shopping.section.baking,
    source.shopping.section.partyFavours,
    source.shopping.section.games,
    source.shopping.section.entertainment,
    source.shopping.section.invitation,
    source.shopping.section.schedule,
    source.shopping.section.shopping,
    source.shopping.section.misc,
  ]
}

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

export function summarizePartyDetails(details?: PartyDetails | null, language: PromptLanguage = 'de'): string {
  const safe = details ?? {
    forWhom: '',
    theme: '',
    age: null,
    preferences: '',
    responseDeadline: '',
    streetAddress: '',
    city: '',
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
  const address = normalizeText(formatPartyAddress(safe.streetAddress, safe.city))
  const date = normalizeText(safe.date)
  const time = normalizeText(safe.time)
  const age = typeof safe.age === 'number' && safe.age > 0 ? Math.round(safe.age) : null
  const budgetLimit = typeof safe.budgetLimitEuro === 'number' ? safe.budgetLimitEuro : null
  const guestCount = formatGuestCount(safe.guestCount)
  const confirmedGuestTotal = getConfirmedGuestTotal(safe)
  const guests = safe.guests
    .map((guest) => {
      const allergies = typeof guest.allergies === 'string' && guest.allergies.trim()
        ? `, ${pt(language, 'Allergien/Unverträglichkeiten', 'Allergies / intolerances')}: ${guest.allergies.trim()}`
        : ''
      const people = guest.status === 'zugesagt'
        ? `, ${typeof guest.personCount === 'number' && guest.personCount > 0 ? guest.personCount : 1} ${language === 'en'
            ? (typeof guest.personCount === 'number' && guest.personCount > 1 ? 'people' : 'person')
            : `Person${(typeof guest.personCount === 'number' && guest.personCount > 1) ? 'en' : ''}`}`
        : ''
      const status = language === 'en'
        ? (guest.status === 'zugesagt' ? 'going' : guest.status === 'abgesagt' ? 'not going' : 'invited')
        : guest.status
      return `${guest.name} (${status}${people}${allergies})`
    })
    .filter(Boolean)

  const formattedResponseDeadline = responseDeadline
    ? (() => {
        const parsed = new Date(`${responseDeadline}T12:00:00`)
        if (Number.isNaN(parsed.getTime())) return responseDeadline
        return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(parsed)
      })()
    : ''

  if (theme) lines.push(`${pt(language, 'Motto', 'Theme')}: ${theme}`)
  if (forWhom) lines.push(`${pt(language, 'Für wen / Anlass', 'For whom / occasion')}: ${forWhom}`)
  if (age !== null) lines.push(`${pt(language, 'Alter', 'Age')}: ${age}`)
  if (preferences) lines.push(`${pt(language, 'Vorlieben / Besonderheiten', 'Preferences / special notes')}: ${preferences}`)
  if (formattedResponseDeadline) lines.push(`${pt(language, 'Antwort bis', 'Reply by')}: ${formattedResponseDeadline}`)
  if (address) lines.push(`${pt(language, 'Ort / Adresse', 'Location / address')}: ${address}`)
  if (date || time) lines.push(`${pt(language, 'Termin', 'Date / time')}: ${[date, time].filter(Boolean).join(' · ')}`)
  if (confirmedGuestTotal > 0) {
    lines.push(`${pt(language, 'Gästezahl', 'Guest count')}: ${confirmedGuestTotal} ${language === 'en' ? (confirmedGuestTotal === 1 ? 'person' : 'people') : `Person${confirmedGuestTotal === 1 ? '' : 'en'}`}`)
    if (guestCount) lines.push(`${pt(language, 'Geplant', 'Planned')}: ${guestCount}`)
  } else if (guestCount) {
    lines.push(`${pt(language, 'Gästezahl', 'Guest count')}: ${guestCount}`)
  }
  if (budgetLimit !== null) lines.push(`${pt(language, 'Budget', 'Budget')}: ca. ${budgetLimit.toFixed(2).replace('.', ',')} €`)
  if (guests.length > 0) lines.push(`${pt(language, 'Gästeliste', 'Guest list')}: ${guests.join(', ')}`)

  return lines.join('\n')
}

function buildTopicFallback(topic: string, details?: PartyDetails | null, language: PromptLanguage = 'de'): string {
  const trimmedTopic = normalizeText(topic)
  if (trimmedTopic) return trimmedTopic
  if (details?.forWhom) return details.forWhom.trim()
  return pt(language, 'Partyplanung', 'Party planning')
}

function buildContextBlock(topic: string, details?: PartyDetails | null, language: PromptLanguage = 'de'): string {
  const lines = [`${pt(language, 'Thema', 'Topic')}: ${buildTopicFallback(topic, details, language)}`]
  const detailsBlock = summarizePartyDetails(details, language)
  if (detailsBlock) {
    lines.push(pt(language, 'Party-Details:', 'Party details:'))
    lines.push(detailsBlock)
  }
  return lines.join('\n')
}

const SYSTEM_START_BASE =
  'Du bist ein kreativer Planungs-Assistent für Partyplanung. Der User sammelt Ideen zu ' +
  'einem konkreten Anlass auf einem visuellen Board. Nutze das Motto bzw. das gewählte Thema, falls vorhanden, als ' +
  'wichtigsten kreativen Leitfaden und richte Deko-, Spiele- und Essensideen besonders daran aus. ' +
  'Nutze danach die Party-Details als echten Kontext: Berücksichtige Anlass, Alter, Vorlieben, Ort, ' +
  'Termin, Gästezahl und die Gästeliste. Bei Kinderpartys sollen die Ideen altersgerecht sein; bei größeren ' +
  'Gruppen sollen Mengen, Portionsgrößen oder Abläufe zur Gästezahl passen. Erzeuge 8 bis 12 konkrete, ' +
  'umsetzbare Ideen. Wähle 4 bis 6 zum Anlass passende Kategorien selbst (z.B. Motto, Deko, Spiele, Essen, Mitgebsel, Zeitplan, Einkauf). ' +
  'Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp.'

const SYSTEM_MORE_BASE =
  'Du bist ein kreativer Planungs-Assistent für Partyplanung. Der User sammelt Ideen zu einem ' +
  'konkreten Anlass auf einem visuellen Board und möchte Nachschub für eine bestimmte Kategorie. ' +
  'Nutze das Motto bzw. das gewählte Thema, falls vorhanden, als wichtigsten Kontext und bleibe bei derselben Party. Danach ' +
  'nutze die Party-Details als Kontext, inklusive Alter und Vorlieben/Besonderheiten. Erzeuge 3 bis 5 neue Ideen ' +
  'NUR für die genannte Kategorie. Wiederhole keine der bereits vorhandenen Ideen und schlage nichts ' +
  'sehr Ähnliches vor. Titel kurz und knackig, Beschreibung 1-2 Sätze mit konkretem Umsetzungstipp.'

const SYSTEM_SHOPPING_BASE =
  'Du bist ein pragmatischer Einkaufs-Assistent für Partyplanung. Du sollst aus ausgewählten Ideen, ' +
  'Party-Details und Gästezahl eine konkrete, umsetzbare Einkaufsliste machen. Nutze das Motto, ' +
  'bzw. das gewählte Thema, falls vorhanden, als wichtigsten Kontext, dann die übrigen Party-Details inklusive Alter und Vorlieben. ' +
  'Jeder Eintrag muss einen einzeln kaufbaren Artikel bezeichnen und bereits im label eine konkrete Menge, Stückzahl, ' +
  'Gewichts-, Volumen- oder Packungsangabe enthalten (z.B. "1x Piñata passend zum Motto" oder "2 Flaschen Apfelsaft à 1 l"). ' +
  'Zerlege eine ausgewählte Idee in alle dafür nötigen, separat zu kaufenden Artikel, statt nur den Oberbegriff der Idee zu wiederholen. ' +
  'Passe Verbrauchsartikel wie Essen, Snacks, Getränke, Servietten und Becher an die Gästezahl an und nenne im label oder note, ' +
  'für wie viele Gäste die berechnete Menge gedacht ist. Berücksichtige bekannte Allergien oder Unverträglichkeiten ' +
  'und schlage bei Bedarf passende Alternativen vor. Halte die Summe der geschätzten Preise innerhalb des Budget-Limits, falls eines angegeben ist. ' +
  'Gruppiere die Einträge in passende Bereiche. ' +
  'Erzeuge eher 8 bis 12 konkrete Posten als sehr lange Listen.'

const SYSTEM_TASKS_BASE =
  'Du bist ein pragmatischer Planungs-Assistent für Partyvorbereitung. Du sollst aus Party-Details ' +
  'und ausgewählten Ideen eine konkrete, zeitlich gestaffelte Aufgabenliste machen. Nutze das Motto, ' +
  'bzw. das gewählte Thema, falls vorhanden, als wichtigsten Kontext, dann die übrigen Party-Details inklusive Alter und Vorlieben. ' +
  'Erzeuge Aufgaben mit praktischen Vorbereitungsschritten, die sich für eine typische Partyplanung eignen. ' +
  'Verteile die Aufgaben über mehrere Zeitpunkte vor der Party, z. B. einige Wochen vorher, 1 Woche vorher, ' +
  '1 Tag vorher und am Party-Tag. Gib für jede Aufgabe einen Wert `daysBeforeParty` an, der angibt, ' +
  'wie viele Tage vor der Party sie idealerweise erledigt werden sollte. Nutze ganze Zahlen, keine ' +
  'Dezimalwerte. Erzeuge eher 6 bis 10 konkrete Aufgaben als sehr lange Listen.'

const SYSTEM_SCHEDULE_BASE =
  'Du bist ein pragmatischer Planungs-Assistent für den eigentlichen Partytag. Du sollst aus ' +
  'Party-Details und ausgewählten Ideen einen zeitlich strukturierten Ablaufplan für den ' +
  'Partytag selbst machen – also ab Beginn der Party, nicht die Vorbereitung vorher. Nutze das ' +
  'Motto bzw. das gewählte Thema, falls vorhanden, als wichtigsten kreativen Leitfaden. Berücksichtige außerdem Anlass, ' +
  'Alter, Vorlieben/Besonderheiten, Gästezahl und den Ort. Leite aus dem Ort ab, ob die Party ' +
  'eher drinnen oder draußen stattfindet, und plane entsprechend flexibel. Erzeuge 5 bis 8 klare, ' +
  'logische Programmpunkte mit einem guten Flow: Begrüßung/Ankommen, Eröffnung, Hauptaktivität, ' +
  'Essen/Kuchen, weitere Aktivität/Spiel, ruhiger Ausklang und Abholung. Gib für jeden Punkt einen ' +
  'Wert `minutesFromStart` an, also die Minuten seit Partybeginn. Wenn eine Party-Uhrzeit bekannt ist, ' +
  'nutze passende Uhrzeiten im Ablauf; wenn nicht, arbeite sauber mit relativen Zeitpunkten wie `nach 30 Min`. ' +
  'Titel kurz und konkret, Beschreibung 1-2 Sätze mit praktischem Tipp.'

export function buildSystemStartPrompt(language: PromptLanguage): string {
  return `${SYSTEM_START_BASE} ${languageInstruction(language)}`
}

export function buildSystemMorePrompt(language: PromptLanguage): string {
  return `${SYSTEM_MORE_BASE} ${languageInstruction(language)}`
}

export function buildSystemShoppingPrompt(language: PromptLanguage): string {
  return `${SYSTEM_SHOPPING_BASE} ${languageInstruction(language)}`
}

export function buildSystemTasksPrompt(language: PromptLanguage): string {
  return `${SYSTEM_TASKS_BASE} ${languageInstruction(language)}`
}

export function buildSystemSchedulePrompt(language: PromptLanguage): string {
  return `${SYSTEM_SCHEDULE_BASE} ${languageInstruction(language)}`
}

export function buildStartUserMessage(topic: string, details?: PartyDetails | null, language: PromptLanguage = 'de'): string {
  return buildContextBlock(topic, details, language)
}

export function buildMoreUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  category: string,
  existingTitles: string[],
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    `${pt(language, 'Kategorie für den Nachschub', 'Category for the follow-up')}: ${category}`,
    `${pt(language, 'Bereits vorhandene Ideen (nicht wiederholen)', 'Existing ideas (do not repeat)')}:`,
    ...existingTitles.map((t) => `- ${t}`),
  ]
  return lines.join('\n')
}

export function buildShoppingUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[],
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    pt(language, 'Aufgabe: Erzeuge daraus eine konkrete Einkaufsliste für die Party.', 'Task: Turn this into a concrete shopping list for the party.'),
    pt(language, 'Wichtige Regeln:', 'Important rules:'),
    pt(language, '- Nur Artikel ausgeben, die sich sinnvoll aus den ausgewählten Ideen oder den Party-Details ableiten lassen.', '- Only output items that can be sensibly derived from the selected ideas or the party details.'),
    pt(language, '- Jeder Posten muss genau einen konkreten, separat kaufbaren Artikel nennen; keine vagen Oberbegriffe oder losen Ideensätze.', '- Each item must name exactly one concrete, separately purchasable product; do not use vague umbrella terms or loose idea phrases.'),
    pt(language, '- Das label jedes Postens muss eine konkrete Menge enthalten: Anzahl, Stückzahl, Gewicht, Volumen oder Packungsgröße (z. B. "1x Piñata passend zum Motto").', '- The label of every item must contain a concrete quantity: count, number of pieces, weight, volume, or pack size (e.g. "1x piñata matching the theme").'),
    pt(language, '- Zerlege Ideen in zusätzlich benötigte, separat zu kaufende Artikel. Beispiel Piñata: 1x Piñata, ca. 500 g Süßigkeiten zum Befüllen und 1x Piñata-Schläger, sofern nicht enthalten.', '- Break ideas down into additionally required products that must be bought separately. Piñata example: 1x piñata, approx. 500 g sweets for filling, and 1x piñata stick if not included.'),
    pt(language, '- Berechne Mengen für Snacks, Essen, Getränke, Servietten, Becher und ähnliche Verbrauchsartikel anhand der angegebenen Gästezahl. Nenne ausdrücklich "X Stück/l/kg für Y Gäste" im label oder note.', '- Calculate quantities for snacks, food, drinks, napkins, cups, and similar consumables from the stated guest count. Explicitly state "X pieces/l/kg for Y guests" in the label or note.'),
    pt(language, '- Für jeden Posten eine grobe Preisschätzung in Euro angeben.', '- Give a rough price estimate in euros for each item.'),
    pt(language, '- Falls ein Budget-Limit angegeben ist, muss die Summe aller priceEuro-Werte dieses Limit einhalten; priorisiere notwendige Artikel und wähle realistische, kostengünstige Mengen.', '- If a budget limit is provided, the sum of all priceEuro values must stay within it; prioritize essential products and choose realistic, cost-conscious quantities.'),
    pt(language, '- Alter sowie Vorlieben/Besonderheiten aus den Party-Details berücksichtigen.', '- Consider age and preferences/special notes from the party details.'),
    pt(language, '- Bekannte Allergien/Unverträglichkeiten aus den Party-Details berücksichtigen.', '- Consider known allergies / intolerances from the party details.'),
    pt(language, '- Liste nach sinnvollen Bereichen gruppieren, z. B. Deko, Essen, Getränke, Geschirr, Backen, Sonstiges.', '- Group the list into sensible sections, e.g. decor, food, drinks, tableware, baking, misc.'),
    pt(language, '- Keine doppelten oder sehr ähnlichen Artikel.', '- Do not repeat duplicate or very similar items.'),
    languageInstruction(language),
    `${pt(language, 'Verwende für Kategorien nur diese Bereiche', 'Use only these sections for categories')}: ${getShoppingSectionLabels(language).join(', ')}`,
    pt(language, 'Ausgewählte Ideen als Kontext:', 'Selected ideas as context:'),
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
  selectedTiles: ShoppingSourceTile[],
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    pt(language, 'Erzeuge eine kurze Einkaufsliste.', 'Create a short shopping list.'),
    pt(language, 'Regeln:', 'Rules:'),
    pt(language, '- Nur 6 bis 8 konkrete Posten.', '- Only 6 to 8 concrete items.'),
    pt(language, '- Jeder Posten ist genau ein separat kaufbarer Artikel; notwendiges Zubehör als eigenen Posten ausgeben.', '- Each item is exactly one separately purchasable product; list required accessories as separate items.'),
    pt(language, '- Jedes label enthält eine konkrete Anzahl, Stückzahl, Gewichts-, Volumen- oder Packungsangabe.', '- Every label contains a concrete count, number of pieces, weight, volume, or pack size.'),
    pt(language, '- Mengen für Verbrauchsartikel an der Gästezahl ausrichten und "X für Y Gäste" im label oder note nennen.', '- Base consumable quantities on the guest count and state "X for Y guests" in the label or note.'),
    pt(language, '- Kurze, knappe Beschreibungen.', '- Short, concise descriptions.'),
    pt(language, '- Maximal ein Satz pro Posten.', '- At most one sentence per item.'),
    pt(language, '- Für jeden Posten eine grobe Preisschätzung in Euro angeben.', '- Give a rough price estimate in euros for each item.'),
    pt(language, '- Ein angegebenes Budget-Limit mit der Summe aller Preise einhalten.', '- Keep the sum of all prices within any provided budget limit.'),
    pt(language, '- Alter sowie Vorlieben/Besonderheiten berücksichtigen.', '- Consider age and preferences/special notes.'),
    pt(language, '- Bekannte Allergien/Unverträglichkeiten berücksichtigen.', '- Consider known allergies / intolerances.'),
    pt(language, '- Gruppiere nach Bereich.', '- Group by section.'),
    `${pt(language, 'Verwende für Kategorien nur diese Bereiche', 'Use only these sections for categories')}: ${getShoppingSectionLabels(language).join(', ')}`,
    pt(language, 'Ausgewählte Ideen:', 'Selected ideas:'),
    ...selectedTiles.map((tile) => `- ${tile.category}: ${tile.title}`),
  ]
  return lines.join('\n')
}

export function buildTasksUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[],
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    pt(language, 'Aufgabe: Erzeuge daraus eine zeitlich gestaffelte Checkliste für die Partyvorbereitung.', 'Task: Turn this into a time-based checklist for party preparation.'),
    pt(language, 'Wichtige Regeln:', 'Important rules:'),
    pt(language, '- Nutze die Party-Details, vor allem Datum, Anlass, Motto, Alter, Vorlieben und Gästezahl.', '- Use the party details, especially date, occasion, theme, age, preferences, and guest count.'),
    pt(language, '- Nenne konkrete To-dos wie Einladungen, Deko, Einkäufe, Basteln, Essen vorbereiten oder Aufbau.', '- Name concrete to-dos such as invitations, decor, shopping, crafting, food prep, or setup.'),
    pt(language, '- Streue die Aufgaben über mehrere Zeitpunkte vor der Party.', '- Spread the tasks across several points in time before the party.'),
    pt(language, '- Für jede Aufgabe `daysBeforeParty` als ganze Zahl angeben (z. B. 21, 7, 1, 0).', '- For each task, provide `daysBeforeParty` as an integer (e.g. 21, 7, 1, 0).'),
    pt(language, '- Je größer der Wert, desto früher ist die Aufgabe fällig.', '- The larger the value, the earlier the task is due.'),
    pt(language, '- Keine doppelten oder sehr ähnlichen Aufgaben.', '- Do not repeat duplicate or very similar tasks.'),
    languageInstruction(language),
    pt(language, 'Ausgewählte Ideen als Kontext:', 'Selected ideas as context:'),
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
  selectedTiles: ShoppingSourceTile[],
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    pt(language, 'Erzeuge eine kurze Aufgabenliste.', 'Create a short task list.'),
    pt(language, 'Regeln:', 'Rules:'),
    pt(language, '- Nur 5 bis 7 Aufgaben.', '- Only 5 to 7 tasks.'),
    pt(language, '- Ganze Zahlen für `daysBeforeParty`.', '- Use whole numbers for `daysBeforeParty`.'),
    pt(language, '- Kurze Titel, eine knappe Beschreibung.', '- Short titles, brief descriptions.'),
    pt(language, '- Gute Staffelung: mehrere Wochen vorher bis am Party-Tag.', '- Good spread: from several weeks before to the day of the party.'),
    pt(language, 'Ausgewählte Ideen:', 'Selected ideas:'),
    ...selectedTiles.map((tile) => `- ${tile.category}: ${tile.title}`),
  ]
  return lines.join('\n')
}

export function buildScheduleUserMessage(
  topic: string,
  details: PartyDetails | null | undefined,
  selectedTiles: ShoppingSourceTile[],
  wishes?: string,
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    pt(language, 'Aufgabe: Erzeuge daraus einen Ablaufplan für den Tag der Party selbst.', 'Task: Turn this into a schedule for the party day itself.'),
    pt(language, 'Wichtige Regeln:', 'Important rules:'),
    pt(language, '- Plane den Ablauf ab dem Beginn der Party.', '- Plan the flow starting at the beginning of the party.'),
    pt(language, '- Nutze eine gute Dramaturgie: Ankommen, Begrüßung, erstes Spiel/Eröffnung, Hauptaktivität, Essen/Kuchen, weitere Aktivität, Ausklang/Abholung.', '- Use a good dramatic flow: arrival, greeting, first game/opening, main activity, food/cake, another activity, wind-down/pickup.'),
    pt(language, '- Berücksichtige Alter sowie Vorlieben/Besonderheiten besonders stark.', '- Pay special attention to age and preferences/special notes.'),
    pt(language, '- Wenn eine Party-Uhrzeit gesetzt ist, sollen die Programmpunkte in realen Uhrzeiten verständlich sein; ansonsten arbeite mit Minuten seit Start.', '- If a party time is set, the program points should read well as real clock times; otherwise work with minutes from start.'),
    pt(language, '- Verwende für jeden Punkt `minutesFromStart` als ganze Zahl.', '- Use `minutesFromStart` as an integer for each point.'),
    pt(language, '- Halte den Plan kompakt und realistisch, keine Überladung.', '- Keep the plan compact and realistic, not overloaded.'),
    pt(language, '- Zusätzlich liefere 2 bis 4 Backup-Punkte für schlechtes Wetter oder ausgefallene Outdoor-Aktivitäten.', '- Also provide 2 to 4 backup points for bad weather or cancelled outdoor activities.'),
    pt(language, '- Gib diese Backup-Punkte als `backupItems` zurück.', '- Return these backup points as `backupItems`.'),
    pt(language, '- Die Backup-Punkte sollen kurze Titel und knappe Notizen haben und eher Indoor-Alternativen vorschlagen.', '- The backup points should have short titles and brief notes and suggest indoor alternatives.'),
    languageInstruction(language),
    wishes?.trim()
      ? `${pt(language, 'Zusätzliche Wünsche des Gastgebers', 'Additional wishes from the host')}: ${wishes.trim()}`
      : `${pt(language, 'Zusätzliche Wünsche des Gastgebers', 'Additional wishes from the host')}: ${pt(language, 'keine', 'none')}`,
    pt(language, 'Ausgewählte Ideen als Kontext:', 'Selected ideas as context:'),
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
  selectedTiles: ShoppingSourceTile[],
  wishes?: string,
  language: PromptLanguage = 'de'
): string {
  const lines = [
    buildContextBlock(topic, details, language),
    pt(language, 'Erzeuge einen kurzen Ablaufplan für die Party.', 'Create a short schedule for the party.'),
    pt(language, 'Regeln:', 'Rules:'),
    pt(language, '- Nur 5 bis 6 Programmpunkte.', '- Only 5 to 6 program points.'),
    pt(language, '- Kurze Titel.', '- Short titles.'),
    pt(language, '- Kurze Notizen, maximal ein Satz.', '- Short notes, at most one sentence.'),
    pt(language, '- minutesFromStart als ganze Zahl.', '- Use `minutesFromStart` as an integer.'),
    pt(language, '- Alter sowie Vorlieben/Besonderheiten berücksichtigen.', '- Consider age and preferences/special notes.'),
    pt(language, '- Zusätzlich 2 bis 4 Backup-Punkte als `backupItems` für schlechtes Wetter oder Indoor-Alternativen.', '- Also provide 2 to 4 backup points as `backupItems` for bad weather or indoor alternatives.'),
    wishes?.trim()
      ? `${pt(language, 'Zusätzliche Wünsche des Gastgebers', 'Additional wishes from the host')}: ${wishes.trim()}`
      : `${pt(language, 'Zusätzliche Wünsche des Gastgebers', 'Additional wishes from the host')}: ${pt(language, 'keine', 'none')}`,
    pt(language, 'Ausgewählte Ideen:', 'Selected ideas:'),
    ...selectedTiles.map((tile) => `- ${tile.category}: ${tile.title}`),
  ]
  return lines.join('\n')
}

export interface RawIdea {
  title: string
  description: string
  category: string
}
