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
  allergies?: string
}

export interface PartyDetails {
  forWhom: string
  theme: string
  location: string
  date: string
  time: string
  guestCount: number | null
  budgetLimitEuro: number | null
  guests: Guest[]
}

export interface ShoppingListItem {
  id: string
  section: string
  label: string
  note?: string
  priceEuro?: number | null
  checked: boolean
  source: 'ai' | 'manual'
  createdAt: number
}

export interface PlanningTaskItem {
  id: string
  title: string
  note?: string
  daysBeforeParty?: number | null
  dueDate?: string | null
  checked: boolean
  source: 'ai' | 'manual'
  createdAt: number
}

export interface BoardState {
  topic: string
  partyDetails: PartyDetails
  tiles: Tile[]
  shoppingList: ShoppingListItem[]
  planningTasks: PlanningTaskItem[]
  rsvpToken: string
}

// Ein Eintrag in der Board-Liste. Der Inhalt (Kacheln) liegt separat
// unter dem Storage-Key des jeweiligen Boards.
export interface BoardMeta {
  id: string
  name: string
  createdAt: number
}

export interface BoardRecord extends BoardMeta {
  data: BoardState
  updatedAt: number
}

export function createEmptyPartyDetails(): PartyDetails {
  return {
    forWhom: '',
    theme: '',
    location: '',
    date: '',
    time: '',
    guestCount: null,
    budgetLimitEuro: null,
    guests: [],
  }
}

export function createEmptyBoard(): BoardState {
  return {
    topic: '',
    partyDetails: createEmptyPartyDetails(),
    tiles: [],
    shoppingList: [],
    planningTasks: [],
    rsvpToken: createRsvpToken(),
  }
}

export const EMPTY_BOARD: BoardState = createEmptyBoard()

export function createRsvpToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}
