/**
 * r2 #19 / C90: a link as a chip label: hostname without "www." plus the
 * first path segment ("adidas.com/samba-og"). Callers ellipsise at ~28ch.
 */
export function linkChip(url: string) {
  const raw = url.trim()
  try {
    const parsed = new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`,
    )
    const host = parsed.hostname.replace(/^www\./, '')
    const first = parsed.pathname.split('/').filter(Boolean)[0]
    return first ? `${host}/${first}` : host
  } catch {
    return raw
  }
}
