import { useEffect, useMemo, useRef, useState } from 'react'
import { ImageIcon } from '@phosphor-icons/react'

import { Button } from '#/components/arc/button/button'
import { Card } from '#/components/arc/card/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
} from '#/components/arc/dialog/dialog'
import { CommandPalette } from '#/components/arc/command-palette/command-palette'
import type { CommandItem } from '#/components/arc/command-palette/command-palette'
import { DropdownMenu } from '#/components/arc/dropdown-menu/dropdown-menu'
import { Input } from '#/components/arc/input/input'
import { HeatWord } from '#/components/heat-word'
import { ItemEditor } from '#/components/wishlist/item-editor'
import type { EditorDraft } from '#/components/wishlist/item-editor'
import { ProductSearch } from '#/components/wishlist/product-search'
import { Stamp } from '#/components/wishlist/stamp'
import type { ProductCandidate } from '#/lib/discovery/candidates'
import {
  cleanRemoteImage,
  recutStoredImage,
} from '#/lib/images/clean-remote-image'
import {
  deleteGuestItem,
  GuestStoreError,
  loadGuestCategories,
  loadGuestItems,
  saveGuestCategory,
  saveGuestItem,
} from '#/lib/guest-wishlist'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

const SUGGESTED_CATEGORIES = ['Clothes', 'Tech', 'Subscriptions']

export function WishlistScreen() {
  const [items, setItems] = useState<Array<GuestItem>>([])
  const [categories, setCategories] = useState<Array<GuestCategory>>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  )
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState<EditorDraft | null>(null)
  const [confirmItem, setConfirmItem] = useState<GuestItem | null>(null)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const [commandOpen, setCommandOpen] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<GuestItem | null>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const removalTimer = useRef<number | null>(null)

  useEffect(() => {
    if (localStorage.getItem('wishlist-layout') === 'list') setLayout('list')
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([loadGuestItems(), loadGuestCategories()])
      .then(([loadedItems, loadedCategories]) => {
        if (cancelled) return
        setItems(loadedItems)
        setCategories(loadedCategories)
        setReady(true)
        void refreshStaleCutouts(
          loadedItems,
          () => cancelled,
          (itemId, url, previousUrl) => {
            setItems((current) => {
              const existing = current.find((entry) => entry.id === itemId)
              if (
                !existing ||
                existing.image ||
                existing.imageUrl !== previousUrl
              )
                return current
              const next = { ...existing, imageUrl: url, updatedAt: Date.now() }
              void saveGuestItem(next)
              return current.map((entry) =>
                entry.id === itemId ? next : entry,
              )
            })
          },
        )
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setStorageError(messageFrom(error))
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (removalTimer.current !== null)
        window.clearTimeout(removalTimer.current)
    }
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
        return
      if (editor || confirmItem || categoryOpen) return
      event.preventDefault()
      setCommandOpen((open) => !open)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editor, confirmItem, categoryOpen])

  const visibleItems = items.filter((item) =>
    selectedCategoryId === null ? true : item.categoryId === selectedCategoryId,
  )
  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ?? null

  const commands = useMemo<Array<CommandItem>>(() => {
    const existing = new Set(
      categories.map((category) => category.name.toLowerCase()),
    )
    return [
      { id: 'all', label: 'All items', group: 'Categories' },
      ...categories.map((category) => ({
        id: `category:${category.id}`,
        label: category.name,
        group: 'Categories',
      })),
      { id: 'new-category', label: 'New category', group: 'Create' },
      ...SUGGESTED_CATEGORIES.filter(
        (name) => !existing.has(name.toLowerCase()),
      ).map((name) => ({
        id: `suggest:${name}`,
        label: name,
        description: 'New category',
        group: 'Create',
      })),
      { id: 'add', label: 'Add an item', group: 'Actions' },
    ]
  }, [categories])

  function commitRemoval(item: GuestItem) {
    void deleteGuestItem(item.id).catch((error: unknown) => {
      setItems((current) =>
        [item, ...current.filter((entry) => entry.id !== item.id)].sort(
          (a, b) => b.createdAt - a.createdAt,
        ),
      )
      setStorageError(messageFrom(error))
    })
  }

  function removeItem(item: GuestItem) {
    if (pendingRemoval && pendingRemoval.id !== item.id)
      commitRemoval(pendingRemoval)
    if (removalTimer.current !== null) window.clearTimeout(removalTimer.current)
    setPendingRemoval(item)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    if (editor?.id === item.id) setEditor(null)
    removalTimer.current = window.setTimeout(() => {
      commitRemoval(item)
      setPendingRemoval((current) => (current?.id === item.id ? null : current))
      removalTimer.current = null
    }, 5000)
  }

  function undoRemoval() {
    if (!pendingRemoval) return
    if (removalTimer.current !== null) {
      window.clearTimeout(removalTimer.current)
      removalTimer.current = null
    }
    const restored = pendingRemoval
    setPendingRemoval(null)
    setItems((current) =>
      [restored, ...current.filter((entry) => entry.id !== restored.id)].sort(
        (a, b) => b.createdAt - a.createdAt,
      ),
    )
  }

  async function togglePurchased(item: GuestItem) {
    const next: GuestItem = {
      ...item,
      status: item.status === 'purchased' ? 'unresolved' : 'purchased',
      updatedAt: Date.now(),
    }
    const previous = items
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? next : entry)),
    )
    try {
      await saveGuestItem(next)
      setStorageError(null)
    } catch (error) {
      setItems(previous)
      setStorageError(messageFrom(error))
    }
  }

  async function createCategory(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return 'Add a name.'
    if (trimmed.length > 40) return 'Keep the name under 40 characters.'
    if (
      categories.some(
        (category) => category.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      return 'You already have that category.'
    }
    const category: GuestCategory = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: Date.now(),
    }
    try {
      await saveGuestCategory(category)
    } catch (error) {
      return messageFrom(error)
    }
    setCategories((current) => [...current, category])
    setSelectedCategoryId(category.id)
    setStorageError(null)
    return null
  }

  function openEditor(draft: EditorDraft) {
    setEditor(draft)
  }

  function runCommand(item: CommandItem) {
    setCommandOpen(false)
    if (item.id === 'all') {
      setSelectedCategoryId(null)
      return
    }
    if (item.id === 'new-category') {
      setCategoryName('')
      setCategoryError(null)
      setCategoryOpen(true)
      return
    }
    if (item.id === 'add') {
      document.getElementById('describe')?.focus()
      return
    }
    if (item.id.startsWith('category:')) {
      setSelectedCategoryId(item.id.slice('category:'.length))
      return
    }
    if (item.id.startsWith('suggest:')) {
      void createCategory(item.id.slice('suggest:'.length)).then((error) => {
        if (error) setStorageError(error)
      })
    }
  }

  function chooseLayout(next: 'grid' | 'list') {
    setLayout(next)
    localStorage.setItem('wishlist-layout', next)
  }

  return (
    <div className="wishlist-page" data-layout={layout}>
    <div className="wishlist-shell">
      <nav className="category-nav" aria-label="Categories">
        <p className="category-nav-label">Categories</p>
        <button
          type="button"
          aria-current={selectedCategoryId === null ? 'page' : undefined}
          onClick={() => setSelectedCategoryId(null)}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-current={
              selectedCategoryId === category.id ? 'page' : undefined
            }
            onClick={() => setSelectedCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setCategoryName('')
            setCategoryError(null)
            setCategoryOpen(true)
          }}
        >
          New category
        </button>
      </nav>

      <main>
        <header className="mb-8 pe-28">
          <h1>
            <HeatWord />
          </h1>
          <p className="wishlist-note mt-3">
            Saved on this browser. It is not backed up and will not appear on
            another device.
          </p>
        </header>

        {storageError ? (
          <p role="alert" className="wishlist-alert">
            {storageError}
          </p>
        ) : null}

        <div className="grid gap-3">
          <ProductSearch
            id="describe"
            value={query}
            onChange={setQuery}
            onSelect={(candidate) => {
              openEditor(draftFromCandidate(candidate, selectedCategoryId))
              setQuery('')
            }}
          />
          {query.trim().length > 0 ? (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openEditor(emptyDraft(query.trim(), selectedCategoryId))
                }
              >
                Add details
              </Button>
            </div>
          ) : (
            <p className="wishlist-note">
              Press Ctrl K to switch category or add one.
            </p>
          )}
        </div>

        <div className="layout-switch-row">
          <div className="layout-switch" role="group" aria-label="Layout">
            <button
              type="button"
              aria-pressed={layout === 'grid'}
              onClick={() => chooseLayout('grid')}
            >
              Grid
            </button>
            <button
              type="button"
              aria-pressed={layout === 'list'}
              onClick={() => chooseLayout('list')}
            >
              List
            </button>
          </div>
        </div>

        {!ready ? (
          <p className="wishlist-note mt-8">Loading your list…</p>
        ) : visibleItems.length === 0 ? (
          <p className="wishlist-note mt-8">
            {selectedCategory
              ? `Nothing in ${selectedCategory.name} yet.`
              : 'Describe something above and pick a match, or add the details yourself.'}
          </p>
        ) : layout === 'grid' ? (
          <ul className="mt-8 grid grid-cols-2 items-stretch gap-x-4 gap-y-8 sm:grid-cols-3">
            {visibleItems.map((item) => (
              <li key={item.id} className="flex min-w-0">
                <ItemCard
                  item={item}
                  onEdit={() => openEditor(draftFromItem(item))}
                  onAskRemove={() => setConfirmItem(item)}
                  onTogglePurchased={() => {
                    void togglePurchased(item)
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="stamp-list">
            {visibleItems.map((item, index) => (
              <AlbumRow
                key={item.id}
                item={item}
                tilt={index % 2 === 0 ? 'left' : 'right'}
                onTogglePurchased={() => {
                  void togglePurchased(item)
                }}
                onEdit={() => openEditor(draftFromItem(item))}
                onAskRemove={() => setConfirmItem(item)}
              />
            ))}
          </ul>
        )}
      </main>

      <ItemEditor
        draft={editor}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
        onSave={async (item) => {
          try {
            await saveGuestItem(item)
            setItems((current) =>
              [item, ...current.filter((entry) => entry.id !== item.id)].sort(
                (a, b) => b.createdAt - a.createdAt,
              ),
            )
            setEditor(null)
            setStorageError(null)
            if (item.imageUrl && !item.image) {
              const sourceUrl = item.imageUrl
              const itemId = item.id
              void cleanRemoteImage(itemId, sourceUrl).then((url) => {
                if (!url || url === sourceUrl) return
                setItems((current) => {
                  const existing = current.find((entry) => entry.id === itemId)
                  if (
                    !existing ||
                    existing.image ||
                    existing.imageUrl !== sourceUrl
                  )
                    return current
                  const next = {
                    ...existing,
                    imageUrl: url,
                    updatedAt: Date.now(),
                  }
                  void saveGuestItem(next)
                  return current.map((entry) =>
                    entry.id === itemId ? next : entry,
                  )
                })
              })
            }
          } catch (error) {
            setStorageError(messageFrom(error))
            throw error
          }
        }}
      />

      <Dialog
        open={confirmItem !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmItem(null)
        }}
      >
        {confirmItem ? (
          <DialogContent
            title="Remove this item?"
            description={confirmItem.title}
          >
            <div className="dialog-actions">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  removeItem(confirmItem)
                  setConfirmItem(null)
                }}
              >
                Remove
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        {categoryOpen ? (
          <DialogContent
            title="New category"
            description="Clothes, tech, subscriptions, or anything else."
          >
            <Input
              label="Name"
              value={categoryName}
              error={categoryError ?? undefined}
              onChange={(event) => setCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                void createCategory(categoryName).then((error) => {
                  if (error) setCategoryError(error)
                  else setCategoryOpen(false)
                })
              }}
            />
            <div className="dialog-actions">
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  void createCategory(categoryName).then((error) => {
                    if (error) setCategoryError(error)
                    else setCategoryOpen(false)
                  })
                }}
              >
                Add category
              </Button>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
        {commandOpen ? (
          <DialogContent title="Commands" description="Categories and actions.">
            <CommandPalette
              items={commands}
              autoFocus
              placeholder="Search categories or actions"
              onClose={() => setCommandOpen(false)}
              onSelect={runCommand}
            />
          </DialogContent>
        ) : null}
      </Dialog>

      {pendingRemoval ? (
        <div className="undo-toast" role="status">
          <p>Removed {pendingRemoval.title}</p>
          <button type="button" onClick={undoRemoval}>
            Undo
          </button>
        </div>
      ) : null}
    </div>
    </div>
  )
}

function AlbumRow({
  item,
  tilt,
  onTogglePurchased,
  onEdit,
  onAskRemove,
}: {
  item: GuestItem
  tilt: 'left' | 'right'
  onTogglePurchased: () => void
  onEdit: () => void
  onAskRemove: () => void
}) {
  const blobUrl = useObjectUrl(item.image)
  const preview = blobUrl ?? item.imageUrl ?? undefined
  const owned = item.status === 'purchased'
  const title = clipWords(item.title)
  const source = item.brand.trim()

  return (
    <li className="album-row">
      <button
        type="button"
        className="album-hit"
        aria-pressed={owned}
        aria-label={`${item.title}${source ? `, ${source}` : ''}${owned ? ', got it' : ''}`}
        onClick={onTogglePurchased}
      >
        <Stamp src={preview} tilt={tilt} flat={owned} />
        <span className="stamp-copy">
          <span
            className="stamp-title"
            title={title === item.title ? undefined : item.title}
          >
            {title}
          </span>
          <span className="stamp-meta">
            {owned ? <span className="stamp-got">Got it</span> : null}
            {source}
          </span>
        </span>
      </button>
      <DropdownMenu
        label="Edit"
        items={[
          { label: 'Edit details', onSelect: onEdit },
          {
            label: owned ? 'Mark as wanted' : 'Mark purchased',
            onSelect: onTogglePurchased,
          },
          {
            label: 'Remove',
            destructive: true,
            separatorBefore: true,
            onSelect: onAskRemove,
          },
        ]}
      />
    </li>
  )
}

function clipWords(title: string, count = 6) {
  const words = title.trim().split(/\s+/)
  if (words.length <= count) return title
  return `${words.slice(0, count).join(' ')}…`
}

function ItemCard({
  item,
  onEdit,
  onAskRemove,
  onTogglePurchased,
}: {
  item: GuestItem
  onEdit: () => void
  onAskRemove: () => void
  onTogglePurchased: () => void
}) {
  const blobUrl = useObjectUrl(item.image)
  const preview = blobUrl ?? item.imageUrl

  return (
    <Card
      title={item.title}
      description={item.brand || undefined}
      status={item.status === 'purchased' ? 'Purchased' : undefined}
      media={
        <div className="flex h-full w-full items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt=""
              referrerPolicy="no-referrer"
              className="max-h-full max-w-full object-contain p-3"
            />
          ) : (
            <ImageIcon style={{ color: 'var(--text-muted)' }} size={28} />
          )}
        </div>
      }
      action={
        <DropdownMenu
          label="Edit"
          items={[
            { label: 'Edit details', onSelect: onEdit },
            {
              label:
                item.status === 'purchased'
                  ? 'Mark as wanted'
                  : 'Mark purchased',
              onSelect: onTogglePurchased,
            },
            {
              label: 'Remove',
              destructive: true,
              separatorBefore: true,
              onSelect: onAskRemove,
            },
          ]}
        />
      }
      details={
        <div className="grid gap-4">
          {item.notes ? <p>{item.notes}</p> : <p>No notes yet.</p>}
          {item.sourceUrl ? (
            <a href={item.sourceUrl} rel="noreferrer">
              Listing
            </a>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onEdit}>
              Edit details
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onTogglePurchased}
            >
              {item.status === 'purchased'
                ? 'Mark as wanted'
                : 'Mark purchased'}
            </Button>
          </div>
        </div>
      }
    />
  )
}

function emptyDraft(title: string, categoryId: string | null): EditorDraft {
  return {
    id: null,
    title,
    brand: '',
    notes: '',
    sourceUrl: '',
    categoryId,
    status: 'unresolved',
    image: null,
    imageType: null,
    imageUrl: null,
    createdAt: null,
  }
}

function draftFromItem(item: GuestItem): EditorDraft {
  return {
    id: item.id,
    title: item.title,
    brand: item.brand,
    notes: item.notes,
    sourceUrl: item.sourceUrl,
    categoryId: item.categoryId,
    status: item.status,
    image: item.image,
    imageType: item.imageType,
    imageUrl: item.imageUrl,
    createdAt: item.createdAt,
  }
}

function draftFromCandidate(
  candidate: ProductCandidate,
  categoryId: string | null,
): EditorDraft {
  return {
    ...emptyDraft(candidate.title, categoryId),
    brand: candidate.source,
    sourceUrl: candidate.url ?? '',
    imageUrl: candidate.imageUrl,
  }
}

function useObjectUrl(blob: Blob | null) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}

function messageFrom(error: unknown) {
  if (error instanceof GuestStoreError) return error.message
  return 'The wishlist could not be saved on this browser.'
}

async function refreshStaleCutouts(
  items: Array<GuestItem>,
  cancelled: () => boolean,
  apply: (itemId: string, url: string, previousUrl: string) => void,
) {
  const stale = items.filter((item) => {
    if (item.image || !item.imageUrl) return false
    return (
      item.imageUrl === `/api/images/c-${item.id}` ||
      item.imageUrl === `/api/images/c-${item.id}-v2` ||
      item.imageUrl === `/api/images/c-${item.id}-v3` ||
      item.imageUrl === `/api/images/c-${item.id}-v4`
    )
  })
  for (const item of stale) {
    if (cancelled()) return
    const previousUrl = item.imageUrl
    if (!previousUrl) continue
    const url = await recutStoredImage(item.id)
    if (!url || cancelled()) continue
    apply(item.id, url, previousUrl)
  }
}
