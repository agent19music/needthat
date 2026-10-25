/**
 * Stickers the owner has opened in the item view, per device (r2 #7: NEW
 * only shows until the item is opened). Kept in localStorage so it needs no
 * migration; a server column can replace it later.
 */
import { useSyncExternalStore } from 'react'

const KEY = 'nt-opened-v1'
const LIMIT = 400
const listeners = new Set<() => void>()
let cache: ReadonlySet<string> | null = null
const EMPTY: ReadonlySet<string> = new Set()

function read(): ReadonlySet<string> {
  if (cache) return cache
  try {
    const raw =
      typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    cache = new Set(
      Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [],
    )
  } catch {
    cache = new Set()
  }
  return cache
}

export function markOpened(id: string) {
  const current = read()
  if (current.has(id)) return
  const next = [...current, id].slice(-LIMIT)
  cache = new Set(next)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Private mode: keep it for this session only.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  function onStorage(event: StorageEvent) {
    if (event.key !== KEY) return
    cache = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useOpened(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY)
}

/** Test hook. */
export function resetOpened() {
  cache = null
}
