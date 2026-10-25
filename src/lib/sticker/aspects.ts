/**
 * Natural aspect ratio (w / h) per sticker image, shared by every sheet so a
 * sticker keeps its box between the board, the tabs and the share card.
 */
import { useEffect, useState } from 'react'

const known = new Map<string, number>()
const listeners = new Set<() => void>()

export function aspectKey(item: { id: string; imageUrl?: string | null }) {
  return `${item.id}|${item.imageUrl ?? ''}`
}

export function knownAspect(item: { id: string; imageUrl?: string | null }) {
  return known.get(aspectKey(item)) ?? null
}

export function reportAspect(
  item: { id: string; imageUrl?: string | null },
  ratio: number,
) {
  if (!Number.isFinite(ratio) || ratio <= 0) return
  const key = aspectKey(item)
  const previous = known.get(key)
  if (previous !== undefined && Math.abs(previous - ratio) < 0.01) return
  known.set(key, ratio)
  listeners.forEach((listener) => listener())
}

/**
 * Re-renders when any aspect arrives, and probes images that have not
 * reported yet (ghosts never mount an <img>).
 */
export function useAspects(
  items: ReadonlyArray<{ id: string; imageUrl?: string | null }>,
) {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  const missing = items.filter(
    (item) => item.imageUrl && !known.has(aspectKey(item)),
  )
  const signature = missing.map(aspectKey).join(',')
  useEffect(() => {
    if (typeof Image === 'undefined') return
    const probes = missing.map((item) => {
      const image = new Image()
      image.referrerPolicy = 'no-referrer'
      image.onload = () => {
        if (image.naturalWidth > 0 && image.naturalHeight > 0)
          reportAspect(item, image.naturalWidth / image.naturalHeight)
      }
      image.src = item.imageUrl as string
      return image
    })
    return () => {
      probes.forEach((image) => {
        image.onload = null
      })
    }
  }, [signature])
  return (item: { id: string; imageUrl?: string | null }) => knownAspect(item)
}
