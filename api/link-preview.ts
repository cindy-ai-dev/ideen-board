import type { VercelRequest, VercelResponse } from '@vercel/node'

interface PreviewPayload {
  url: string
  title: string
  description?: string
  image?: string
}

function cleanText(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\s+/g, ' ').trim()
}

function extractMeta(html: string, ...names: string[]): string {
  for (const name of names) {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
    ]
    for (const pattern of patterns) {
      const match = html.match(pattern)
      if (match?.[1]) return cleanText(match[1])
    }
  }
  return ''
}

function extractTitle(html: string): string {
  const ogTitle = extractMeta(html, 'og:title', 'twitter:title')
  if (ogTitle) return ogTitle
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i)
  if (titleMatch?.[1]) return cleanText(titleMatch[1])
  return ''
}

function extractDescription(html: string): string {
  return (
    extractMeta(html, 'og:description', 'twitter:description') ||
    extractMeta(html, 'description') ||
    ''
  )
}

function extractImage(html: string): string {
  return extractMeta(html, 'og:image', 'twitter:image')
}

async function fetchHtml(target: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 PartyHost/1.0',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timeout)
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = typeof req.query.url === 'string' ? req.query.url.trim() : ''
  if (!rawUrl) {
    res.status(400).json({ error: 'Ungültige URL' })
    return
  }

  let target: URL
  try {
    target = new URL(rawUrl)
  } catch {
    res.status(400).json({ error: 'Ungültige URL' })
    return
  }

  if (!/^https?:$/.test(target.protocol)) {
    res.status(400).json({ error: 'Nur http/https erlaubt' })
    return
  }

  try {
    console.log('[api/link-preview] request', { url: target.toString() })
    const html = await fetchHtml(target.toString())
    const payload: PreviewPayload = {
      url: extractMeta(html, 'og:url') || target.toString(),
      title: extractTitle(html) || target.hostname,
      description: extractDescription(html) || undefined,
      image: extractImage(html) || undefined,
    }
    console.log('[api/link-preview] success', {
      url: payload.url,
      hasTitle: Boolean(payload.title),
      hasDescription: Boolean(payload.description),
      hasImage: Boolean(payload.image),
    })
    res.status(200).json({ preview: payload })
  } catch (error) {
    console.log('[api/link-preview] failed', {
      url: target.toString(),
      error: error instanceof Error ? error.message : error,
    })
    res.status(502).json({ error: 'Link-Vorschau konnte nicht geladen werden' })
  }
}
