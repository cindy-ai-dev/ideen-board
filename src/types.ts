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
  selected: boolean
  createdAt: number
}

export type GuestStatus = 'eingeladen' | 'zugesagt' | 'abgesagt'

export interface Guest {
  id: string
  name: string
  status: GuestStatus
}

export interface PartyDetails {
  forWhom: string
  theme: string
  location: string
  date: string
  time: string
  guestCount: number | null
  guests: Guest[]
}

export interface BoardState {
  topic: string
  partyDetails: PartyDetails
  tiles: Tile[]
}

// Ein Eintrag in der Board-Liste. Der Inhalt (Kacheln) liegt separat
// unter dem Storage-Key des jeweiligen Boards.
export interface BoardMeta {
  id: string
  name: string
  createdAt: number
}

export function createEmptyPartyDetails(): PartyDetails {
  return {
    forWhom: '',
    theme: '',
    location: '',
    date: '',
    time: '',
    guestCount: null,
    guests: [],
  }
}

export function createEmptyBoard(): BoardState {
  return {
    topic: '',
    partyDetails: createEmptyPartyDetails(),
    tiles: [],
  }
}

export const EMPTY_BOARD: BoardState = createEmptyBoard()
