import type { Tile } from '../types'

// Warum nicht direkt die fremde Seite laden? Browser blockieren das (CORS):
// eine Webseite darf nicht einfach beliebige andere Seiten auslesen.
// microlink.io ist ein kostenloser Dienst, der die Seite server-seitig
// abruft und uns Titel, Beschreibung und Vorschaubild als JSON liefert.
interface MicrolinkResponse {
  status: string
  data: {
    title: string | null
    description: string | null
    image: { url: string } | null
    url: string
  }
}

export async function fetchLinkPreview(url: string, boardId: string): Promise<Tile> {
  const res = await fetch(
    `https://api.microlink.io/?url=${encodeURIComponent(url)}`
  )
  if (!res.ok) throw new Error('Link-Vorschau konnte nicht geladen werden')

  const json = (await res.json()) as MicrolinkResponse
  if (json.status !== 'success') {
    throw new Error('Link-Vorschau konnte nicht geladen werden')
  }

  return {
    id: crypto.randomUUID(),
    boardId,
    kind: 'link',
    title: json.data.title ?? url,
    description: json.data.description ?? undefined,
    category: 'Links',
    url: json.data.url,
    image: json.data.image?.url,
    selected: false,
    createdAt: Date.now(),
  }
}
