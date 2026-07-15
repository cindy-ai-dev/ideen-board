import { neon } from '@neondatabase/serverless'
import type { BoardRecord, BoardState } from '../src/types.js'

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
    data: row.data,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }
}

export async function listBoards(): Promise<BoardRecord[]> {
  await ensureSchema()
  const rows = (await sql`
    SELECT id, name, data, created_at, updated_at
    FROM boards
    ORDER BY created_at ASC
  `) as BoardRow[]
  return rows.map(toRecord)
}

export async function getBoard(id: string): Promise<BoardRecord | null> {
  await ensureSchema()
  const rows = (await sql`
    SELECT id, name, data, created_at, updated_at
    FROM boards
    WHERE id = ${id}
    LIMIT 1
  `) as BoardRow[]
  return rows[0] ? toRecord(rows[0]) : null
}

export async function upsertBoard(id: string, name: string, data: BoardState): Promise<BoardRecord> {
  await ensureSchema()
  const rows = (await sql`
    INSERT INTO boards (id, name, data, created_at, updated_at)
    VALUES (${id}, ${name}, ${JSON.stringify(data)}::jsonb, now(), now())
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
