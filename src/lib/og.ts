import type { Tile } from '../types'

interface PreviewPayload {
  url: string
  title: string
  description?: string
  image?: string
}

function normalizeFallbackTitle(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./i, '') || url
  } catch {
    return url
  }
}

function buildFallbackTile(url: string, boardId: string, reason?: string): Tile {
  return {
    id: crypto.randomUUID(),
    boardId,
    kind: 'link',
    title: normalizeFallbackTitle(url),
    description: reason ?? undefined,
    category: 'Links',
    url,
    image: undefined,
    selected: false,
    createdAt: Date.now(),
  }
}

async function tryServerPreview(url: string): Promise<PreviewPayload | null> {
  const endpoint = new URL('/api/link-preview', window.location.origin)
  endpoint.searchParams.set('url', url)
  const res = await fetch(endpoint)
  if (!res.ok) return null
  const json = (await res.json()) as { preview?: PreviewPayload }
  return json.preview ?? null
}

async function tryMicrolinkPreview(url: string): Promise<PreviewPayload | null> {
  const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}`
  const res = await fetch(endpoint)
  if (!res.ok) return null
  const json = (await res.json()) as {
    status?: string
    data?: {
      title?: string | null
      description?: string | null
      image?: { url?: string | null } | null
      url?: string | null
    }
  }
  if (json.status !== 'success' || !json.data) return null
  return {
    url: json.data.url ?? url,
    title: json.data.title ?? normalizeFallbackTitle(url),
    description: json.data.description ?? undefined,
    image: json.data.image?.url ?? undefined,
  }
}

export async function fetchLinkPreview(
  url: string,
  boardId: string,
  fallbackMessage = 'Preview unavailable – the link will still be saved.'
): Promise<Tile> {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    throw new Error('Ungültige URL')
  }

  if (!/^https?:$/.test(target.protocol)) {
    throw new Error('Nur http/https erlaubt')
  }

  try {
    const preview = await tryServerPreview(target.toString())
    if (preview) {
      return {
        id: crypto.randomUUID(),
        boardId,
        kind: 'link',
        title: preview.title || normalizeFallbackTitle(target.toString()),
        description: preview.description || undefined,
        category: 'Links',
        url: preview.url || target.toString(),
        image: preview.image,
        selected: false,
        createdAt: Date.now(),
      }
    }
  } catch (error) {
    console.log('[link-preview] server preview failed', {
      url: target.toString(),
      error: error instanceof Error ? error.message : error,
    })
  }

  try {
    const preview = await tryMicrolinkPreview(target.toString())
    if (preview) {
      return {
        id: crypto.randomUUID(),
        boardId,
        kind: 'link',
        title: preview.title || normalizeFallbackTitle(target.toString()),
        description: preview.description || undefined,
        category: 'Links',
        url: preview.url || target.toString(),
        image: preview.image,
        selected: false,
        createdAt: Date.now(),
      }
    }
  } catch (error) {
    console.log('[link-preview] microlink fallback failed', {
      url: target.toString(),
      error: error instanceof Error ? error.message : error,
    })
  }

  return buildFallbackTile(
    target.toString(),
    boardId,
    fallbackMessage
  )
}
