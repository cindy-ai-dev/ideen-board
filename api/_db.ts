import { neon } from '@neondatabase/serverless'
import type {
  BoardRecord,
  BoardState,
  Guest,
  PartyDetails,
  PlanningTaskItem,
  PartyScheduleBackupItem,
  PartyScheduleItem,
  ShoppingListItem,
  Tile,
} from '../src/types.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const sql = neon(connectionString)

let schemaPromise: Promise<void> | null = null

interface BoardRow {
  id: string
  name: string
  data: BoardState
  created_at: string | Date
  updated_at: string | Date
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10)
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
  }
  return null
}

function parseNonNegativeNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.trim().replace(',', '.'))
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
  }
  return null
}

function normalizeGuest(value: unknown): Guest | null {
  if (!isObject(value)) return null
  const name = typeof value.name === 'string' ? value.name.trim() : ''
  const status = value.status
  if (!name || (status !== 'eingeladen' && status !== 'zugesagt' && status !== 'abgesagt')) {
    return null
  }
  const allergies = typeof value.allergies === 'string' ? value.allergies.trim() : ''
  const personCount = parsePositiveInteger(value.personCount)

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    name,
    status,
    personCount: personCount ?? 1,
    allergies: allergies ? allergies : undefined,
  }
}

function normalizePartyDetails(value: unknown): PartyDetails {
  const fallback: PartyDetails = {
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

  if (!isObject(value)) return fallback

  const guestCount = parseNonNegativeInteger(value.guestCount)
  const budgetLimitEuro = parseNonNegativeNumber(value.budgetLimitEuro)
  const age = parsePositiveInteger(value.age)

  return {
    forWhom: typeof value.forWhom === 'string' ? value.forWhom : '',
    theme: typeof value.theme === 'string' ? value.theme : '',
    age,
    preferences: typeof value.preferences === 'string' ? value.preferences : '',
    responseDeadline: typeof value.responseDeadline === 'string' ? value.responseDeadline : '',
    streetAddress:
      typeof value.streetAddress === 'string'
        ? value.streetAddress
        : typeof value.location === 'string'
          ? value.location
          : '',
    city: typeof value.city === 'string' ? value.city : '',
    date: typeof value.date === 'string' ? value.date : '',
    time: typeof value.time === 'string' ? value.time : '',
    guestCount,
    budgetLimitEuro,
    guests: Array.isArray(value.guests)
      ? value.guests.map(normalizeGuest).filter((guest): guest is Guest => guest !== null)
      : [],
  }
}

function normalizeTile(value: unknown, boardId: string): Tile | null {
  if (!isObject(value)) return null
  const kind = value.kind
  const title = typeof value.title === 'string' ? value.title : ''
  const category = typeof value.category === 'string' ? value.category : ''
  if ((kind !== 'idea' && kind !== 'link') || !title || !category) return null

  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    boardId,
    kind,
    title,
    description: typeof value.description === 'string' ? value.description : undefined,
    category,
    url: typeof value.url === 'string' ? value.url : undefined,
    image: typeof value.image === 'string' ? value.image : undefined,
    selected: typeof value.selected === 'boolean' ? value.selected : false,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function normalizeShoppingListItem(value: unknown): ShoppingListItem | null {
  if (!isObject(value)) return null
  const label = typeof value.label === 'string' ? value.label.trim() : ''
  if (!label) return null
  const section = typeof value.section === 'string' && value.section.trim() ? value.section.trim() : 'Sonstiges'
  const source = value.source === 'manual' ? 'manual' : 'ai'
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    section,
    label,
    note: typeof value.note === 'string' && value.note.trim() ? value.note.trim() : undefined,
    priceEuro: parseNonNegativeNumber(value.priceEuro),
    checked: typeof value.checked === 'boolean' ? value.checked : false,
    source,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function normalizePlanningTaskItem(value: unknown): PlanningTaskItem | null {
  if (!isObject(value)) return null
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (!title) return null
  const dueDate = typeof value.dueDate === 'string' ? value.dueDate.trim() : ''
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    title,
    note: typeof value.note === 'string' ? value.note.trim() || undefined : undefined,
    daysBeforeParty: parseNonNegativeInteger(value.daysBeforeParty),
    dueDate: dueDate ? dueDate : null,
    checked: typeof value.checked === 'boolean' ? value.checked : false,
    source: value.source === 'manual' ? 'manual' : 'ai',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function normalizePartyScheduleItem(value: unknown): PartyScheduleItem | null {
  if (!isObject(value)) return null
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (!title) return null
  const minutes = parseNonNegativeInteger(value.minutesFromStart)
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    title,
    note: typeof value.note === 'string' ? value.note.trim() || undefined : undefined,
    minutesFromStart: minutes,
    source: value.source === 'manual' ? 'manual' : 'ai',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function normalizePartyScheduleBackupItem(value: unknown): PartyScheduleBackupItem | null {
  if (!isObject(value)) return null
  const title = typeof value.title === 'string' ? value.title.trim() : ''
  if (!title) return null
  const minutes = parseNonNegativeInteger(value.minutesFromStart)
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : crypto.randomUUID(),
    title,
    note: typeof value.note === 'string' ? value.note.trim() || undefined : undefined,
    minutesFromStart: minutes,
    source: value.source === 'manual' ? 'manual' : 'ai',
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : Date.now(),
  }
}

function normalizeBoardState(raw: unknown, boardId: string): BoardState {
  if (!isObject(raw)) {
    return {
      topic: '',
      partyDetails: normalizePartyDetails(null),
      tiles: [],
      shoppingList: [],
      planningTasks: [],
      partySchedule: [],
      partyScheduleBackup: [],
      rsvpToken: crypto.randomUUID().replace(/-/g, '').slice(0, 12),
    }
  }

  const topic = typeof raw.topic === 'string' ? raw.topic : ''
  const partyDetails = normalizePartyDetails(raw.partyDetails)
  if (!partyDetails.forWhom && topic) {
    partyDetails.forWhom = topic
  }

  return {
    topic,
    partyDetails,
    tiles: Array.isArray(raw.tiles)
      ? raw.tiles
          .map((tile) => normalizeTile(tile, boardId))
          .filter((tile): tile is Tile => tile !== null)
      : [],
    shoppingList: Array.isArray(raw.shoppingList)
      ? raw.shoppingList
          .map((item) => normalizeShoppingListItem(item))
          .filter((item): item is ShoppingListItem => item !== null)
      : [],
    planningTasks: Array.isArray(raw.planningTasks)
      ? raw.planningTasks
          .map((item) => normalizePlanningTaskItem(item))
          .filter((item): item is PlanningTaskItem => item !== null)
      : [],
    partySchedule: Array.isArray(raw.partySchedule)
      ? raw.partySchedule
          .map((item) => normalizePartyScheduleItem(item))
          .filter((item): item is PartyScheduleItem => item !== null)
      : [],
    partyScheduleBackup: Array.isArray(raw.partyScheduleBackup)
      ? raw.partyScheduleBackup
          .map((item) => normalizePartyScheduleBackupItem(item))
          .filter((item): item is PartyScheduleBackupItem => item !== null)
      : [],
    rsvpToken: typeof raw.rsvpToken === 'string' && raw.rsvpToken.trim() ? raw.rsvpToken : createRsvpToken(),
  }
}

export function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS boards (
          id text PRIMARY KEY,
          name text NOT NULL,
          data jsonb NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS boards_updated_at_idx ON boards (updated_at DESC)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS boards_created_at_idx ON boards (created_at DESC)
      `
    })()
  }
  return schemaPromise
}

function toRecord(row: {
  id: string
  name: string
  data: BoardState
  created_at: string | Date
  updated_at: string | Date
}): BoardRecord {
  return {
    id: row.id,
    name: row.name,
    data: normalizeBoardState(row.data, row.id),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

function createRsvpToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

function hasRsvpToken(record: BoardRecord): boolean {
  return typeof record.data.rsvpToken === 'string' && record.data.rsvpToken.trim().length > 0
}

export async function listBoards(): Promise<BoardRecord[]> {
  await ensureSchema()
  const rows = (await sql`
    SELECT id, name, data, created_at, updated_at
    FROM boards
    ORDER BY created_at ASC
  `) as BoardRow[]
  const records: BoardRecord[] = []
  for (const row of rows) {
    const record = toRecord(row)
    if (hasRsvpToken(record)) {
      records.push(record)
      continue
    }
    const updated = await upsertBoard(record.id, record.name, {
      ...record.data,
      rsvpToken: createRsvpToken(),
    })
    records.push(updated)
  }
  return records
}

export async function getBoard(id: string): Promise<BoardRecord | null> {
  await ensureSchema()
  const rows = (await sql`
    SELECT id, name, data, created_at, updated_at
    FROM boards
    WHERE id = ${id}
    LIMIT 1
  `) as BoardRow[]
  if (!rows[0]) return null
  const record = toRecord(rows[0])
  if (hasRsvpToken(record)) return record
  return upsertBoard(record.id, record.name, { ...record.data, rsvpToken: createRsvpToken() })
}

export async function getBoardByRsvpToken(token: string): Promise<BoardRecord | null> {
  await ensureSchema()
  const rows = (await sql`
    SELECT id, name, data, created_at, updated_at
    FROM boards
    WHERE data->>'rsvpToken' = ${token}
    LIMIT 1
  `) as BoardRow[]
  return rows[0] ? toRecord(rows[0]) : null
}

export async function upsertBoard(id: string, name: string, data: BoardState): Promise<BoardRecord> {
  await ensureSchema()
  const normalized = normalizeBoardState(data, id)
  const rows = (await sql`
    INSERT INTO boards (id, name, data, created_at, updated_at)
    VALUES (${id}, ${name}, ${JSON.stringify(normalized)}::jsonb, now(), now())
    ON CONFLICT (id)
    DO UPDATE SET
      name = EXCLUDED.name,
      data = EXCLUDED.data,
      updated_at = now()
    RETURNING id, name, data, created_at, updated_at
  `) as BoardRow[]
  return toRecord(rows[0])
}

export async function deleteBoard(id: string): Promise<void> {
  await ensureSchema()
  await sql`
    DELETE FROM boards
    WHERE id = ${id}
  `
}
