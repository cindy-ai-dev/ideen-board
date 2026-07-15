import type { BoardRecord, BoardState } from '../types'

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error('Request failed')
  }
  return (await res.json()) as T
}

export async function fetchBoards(): Promise<BoardRecord[]> {
  const res = await fetch('/api/boards')
  const json = await parseJson<{ boards: BoardRecord[] }>(res)
  return json.boards
}

export async function fetchBoard(id: string): Promise<BoardRecord | null> {
  const res = await fetch(`/api/board?id=${encodeURIComponent(id)}`)
  if (res.status === 404) return null
  const json = await parseJson<{ board: BoardRecord }>(res)
  return json.board
}

export async function saveBoard(id: string, name: string, data: BoardState): Promise<BoardRecord> {
  const res = await fetch(`/api/board?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data }),
  })
  const json = await parseJson<{ board: BoardRecord }>(res)
  return json.board
}

export async function deleteBoard(id: string): Promise<void> {
  const res = await fetch(`/api/board?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await parseJson<{ ok: true }>(res)
}
