export type ProductCandidate = {
  id: string
  title: string
  source: string
  url: string | null
  imageUrl: string | null
}

const RESULT_LIMIT = 6

export function toCandidates(results: unknown): Array<ProductCandidate> {
  if (!Array.isArray(results)) return []

  const seen = new Set<string>()
  const candidates: Array<ProductCandidate> = []

  for (const item of results) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const title = text(record.title)
    if (!title) continue

    const source = text(record.source) ?? 'Listing'
    const url = httpsUrl(record.link)
    const titleKey = `${normalize(title)}|${normalize(source)}`
    if (seen.has(titleKey)) continue
    if (url && seen.has(url)) continue

    seen.add(titleKey)
    if (url) seen.add(url)
    candidates.push({
      id: url ?? `${String(record.position ?? candidates.length)}:${title}`,
      title,
      source,
      url,
      imageUrl: httpsUrl(record.imageUrl),
    })

    if (candidates.length === RESULT_LIMIT) break
  }

  return candidates
}

export function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, ' ').toLowerCase()
}

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function text(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function httpsUrl(value: unknown) {
  const raw = text(value)
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}
