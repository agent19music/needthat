export type ItemStatus = 'unresolved' | 'purchased'

export type GuestItem = {
  id: string
  title: string
  brand: string
  notes: string
  sourceUrl: string
  status: ItemStatus
  image: Blob | null
  imageType: string | null
  imageUrl: string | null
  createdAt: number
  updatedAt: number
}

const DB_NAME = 'wishlist'
const DB_VERSION = 1
const STORE = 'items'

export class GuestStoreError extends Error {
  constructor(
    message: string,
    readonly code: 'unavailable' | 'quota' | 'write',
  ) {
    super(message)
    this.name = 'GuestStoreError'
  }
}

export async function loadGuestItems(): Promise<Array<GuestItem>> {
  const db = await openDatabase()
  const items = await requestToPromise<Array<GuestItem>>(
    db.transaction(STORE, 'readonly').objectStore(STORE).getAll(),
  )
  db.close()
  return items
    .map((item) => ({ ...item, imageUrl: item.imageUrl ?? null }))
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function saveGuestItem(item: GuestItem): Promise<void> {
  const db = await openDatabase()
  await requestToPromise(
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(item),
  )
  db.close()
}

export async function deleteGuestItem(id: string): Promise<void> {
  const db = await openDatabase()
  await requestToPromise(
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id),
  )
  db.close()
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new GuestStoreError(
        'Wishlist storage is unavailable in this browser.',
        'unavailable',
      ),
    )
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      reject(
        new GuestStoreError(
          'Wishlist storage is unavailable in this browser.',
          'unavailable',
        ),
      )
    }
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(mapWriteError(request.error))
  })
}

function mapWriteError(error: DOMException | null): GuestStoreError {
  if (
    error?.name === 'QuotaExceededError' ||
    error?.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  ) {
    return new GuestStoreError(
      'This browser is out of space for wishlist images. Remove an item or use a smaller image, then try again.',
      'quota',
    )
  }

  return new GuestStoreError(
    'The wishlist could not be saved on this browser.',
    'write',
  )
}
