// Eine Kachel auf der Wand – egal ob KI-Idee oder eingeworfener Link.
export interface Tile {
  id: string
  // Für später, wenn es mehrere Boards geben soll. Aktuell immer "default".
  boardId: string
  kind: 'idea' | 'link'
  title: string
  description?: string
  category: string
  url?: string
  image?: string
  createdAt: number
}

export interface BoardState {
  topic: string
  tiles: Tile[]
}

// Ein Eintrag in der Board-Liste. Der Inhalt (Kacheln) liegt separat
// unter dem Storage-Key des jeweiligen Boards.
export interface BoardMeta {
  id: string
  name: string
  createdAt: number
}

export const EMPTY_BOARD: BoardState = { topic: '', tiles: [] }
