import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ImageIcon } from '@phosphor-icons/react'

import { Button } from '#/components/arc/button/button'
import { CopyButton } from '#/components/arc/copy-button/copy-button'
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
import { commandMenuEvent } from '#/components/account-menu'
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
  deleteActiveItem,
  importGuestWishlist,
  loadActiveWishlist,
  saveActiveCategory,
  reorderActiveItems,
  saveActiveItem,
} from '#/lib/account-wishlist'
import { StickerBoard } from '#/components/sticker/board'
import type { ShareSettings } from '#/components/sticker/share-sheet'
import type { OwnerClaim, SheetShare } from '#/lib/wishlist/types'
import { DEFAULT_SHARE, shareForTarget } from '#/lib/wishlist/sheet-share'
import { nextTagColor } from '#/lib/sticker/sheets'
import { loadShareSettings, saveShareSettings } from '#/lib/wishlist/account'
import {
  nextPurchasedAt,
  sortByPosition,
  topPosition,
} from '#/lib/wishlist/order'
import { authClient } from '#/lib/auth-client'
import { GuestStoreError } from '#/lib/guest-wishlist'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

const SUGGESTED_CATEGORIES = ['Clothes', 'Tech', 'Subscriptions']

function categoryTag(name: string) {
  return `#${name.trim().toLowerCase()}`
}

type Layout = 'grid' | 'stacks' | 'list'

export function WishlistScreen() {
  const { data: session, isPending } = authClient.useSession()
  const signedIn = Boolean(session?.user)
  const userId = session?.user?.id
  const username = session?.user?.username ?? ''
  const signedInRef = useRef(signedIn)
  signedInRef.current = signedIn
  const [origin, setOrigin] = useState('')
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
  // Stacks is the Sticker Sheet board; Grid and List keep the old views.
  const [layout, setLayout] = useState<Layout>('stacks')
  // r7 (Q3): Show prices / Friends can claim / sharing, per sheet.
  const [sheetShares, setSheetShares] = useState<Record<string, SheetShare>>({})
  const sheetSharesRef = useRef(sheetShares)
  sheetSharesRef.current = sheetShares
  const [claims, setClaims] = useState<Record<string, OwnerClaim>>({})
  const [profile, setProfile] = useState({ bio: '', forLine: '' })
  const [loadRun, setLoadRun] = useState(0)
  const removalTimer = useRef<number | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('wishlist-layout')
    if (saved === 'list' || saved === 'grid') setLayout(saved)
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    loadShareSettings()
      .then((result) => {
        if (!cancelled && result.ok) {
          setSheetShares(result.sheets)
          setProfile({ bio: result.bio, forLine: result.forLine })
        }
      })
      .catch(() => {
        // Defaults stay; the toggles still save.
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => {
    if (isPending) return
    let cancelled = false
    setReady(false)
    const load = async () => {
      const loaded = await loadActiveWishlist(Boolean(userId))
      if (cancelled) return
      if (!loaded.ok) {
        setStorageError(loaded.message)
        setItems([])
        setCategories([])
        setReady(true)
        return
      }
      setItems(loaded.items)
      setCategories(loaded.categories)
      setClaims(loaded.claims)
      setReady(true)
      setStorageError(null)
      if (userId) {
        try {
          const imported = await importGuestWishlist(userId)
          if (imported && !cancelled) {
            const refreshed = await loadActiveWishlist(true)
            if (!cancelled && refreshed.ok) {
              setItems(refreshed.items)
              setCategories(refreshed.categories)
              setClaims(refreshed.claims)
            }
          }
        } catch (error) {
          if (!cancelled) setStorageError(messageFrom(error))
        }
      }
      void refreshStaleCutouts(
        loaded.items,
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
            void saveActiveItem(signedInRef.current, next)
            return current.map((entry) => (entry.id === itemId ? next : entry))
          })
        },
      )
    }
    load().catch((error: unknown) => {
      if (cancelled) return
      setStorageError(messageFrom(error))
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [isPending, userId, loadRun])

  useEffect(() => {
    return () => {
      if (removalTimer.current !== null)
        window.clearTimeout(removalTimer.current)
    }
  }, [])

  useEffect(() => {
    function toggleCommandMenu() {
      if (editor || confirmItem || categoryOpen) return
      setCommandOpen((open) => !open)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k')
        return
      event.preventDefault()
      toggleCommandMenu()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(commandMenuEvent, toggleCommandMenu)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(commandMenuEvent, toggleCommandMenu)
    }
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
        label: categoryTag(category.name),
        group: 'Categories',
      })),
      { id: 'new-category', label: 'New category', group: 'Create' },
      ...SUGGESTED_CATEGORIES.filter(
        (name) => !existing.has(name.toLowerCase()),
      ).map((name) => ({
        id: `suggest:${name}`,
        label: categoryTag(name),
        description: 'New category',
        group: 'Create',
      })),
      { id: 'add', label: 'Add an item', group: 'Actions' },
    ]
  }, [categories])

  function commitRemoval(item: GuestItem) {
    void deleteActiveItem(signedIn, item.id).catch((error: unknown) => {
      setItems((current) =>
        sortByPosition([
          item,
          ...current.filter((entry) => entry.id !== item.id),
        ]),
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
      sortByPosition([
        restored,
        ...current.filter((entry) => entry.id !== restored.id),
      ]),
    )
  }

  async function togglePurchased(item: GuestItem) {
    const now = Date.now()
    const status = item.status === 'purchased' ? 'unresolved' : 'purchased'
    const next: GuestItem = {
      ...item,
      status,
      purchasedAt: nextPurchasedAt(
        { status: item.status, purchasedAt: item.purchasedAt ?? null },
        status,
        now,
      ),
      updatedAt: now,
    }
    const previous = items
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? next : entry)),
    )
    try {
      await saveActiveItem(signedIn, next)
      setStorageError(null)
    } catch (error) {
      setItems(previous)
      setStorageError(messageFrom(error))
    }
  }

  const categoriesRef = useRef(categories)
  categoriesRef.current = categories
  const itemsRef = useRef(items)
  itemsRef.current = items

  /** Peel / Undo: optimistic, rolls back and throws so the board can say so. */
  async function setGot(item: GuestItem, got: boolean) {
    const current =
      itemsRef.current.find((entry) => entry.id === item.id) ?? item
    if ((current.status === 'purchased') === got) return
    const now = Date.now()
    const status = got ? 'purchased' : 'unresolved'
    const next: GuestItem = {
      ...current,
      status,
      purchasedAt: nextPurchasedAt(
        { status: current.status, purchasedAt: current.purchasedAt ?? null },
        status,
        now,
      ),
      updatedAt: now,
    }
    setItems((list) =>
      list.map((entry) => (entry.id === item.id ? next : entry)),
    )
    try {
      await saveActiveItem(signedInRef.current, next)
      setStorageError(null)
    } catch (error) {
      setItems((list) =>
        list.map((entry) => (entry.id === item.id ? current : entry)),
      )
      throw error
    }
  }

  /** r3 overflow: Move to sheet / Edit price. Optimistic, rolls back. */
  async function updateItem(item: GuestItem) {
    const current =
      itemsRef.current.find((entry) => entry.id === item.id) ?? item
    // withKeptFields keeps the stored price; Edit price must win here.
    const next: GuestItem = {
      ...withKeptFields(item),
      price: item.price ?? null,
      purchasedAt: item.purchasedAt ?? current.purchasedAt ?? null,
    }
    setItems((list) =>
      sortByPosition(
        list.map((entry) => (entry.id === item.id ? next : entry)),
      ),
    )
    try {
      await saveActiveItem(signedInRef.current, next)
      setStorageError(null)
    } catch (error) {
      setItems((list) =>
        sortByPosition(
          list.map((entry) => (entry.id === item.id ? current : entry)),
        ),
      )
      throw error
    }
  }

  async function printSticker(item: GuestItem) {
    const placed: GuestItem = {
      ...item,
      position: topPosition(
        itemsRef.current.map((entry) => entry.position ?? null),
      ),
    }
    await saveActiveItem(signedInRef.current, placed)
    setItems((current) =>
      sortByPosition([
        placed,
        ...current.filter((entry) => entry.id !== placed.id),
      ]),
    )
    setStorageError(null)
  }

  /**
   * Optimistic: writes only the switches that changed to every sheet in
   * `keys`, so flipping one switch on Share all sheets never copies the
   * other two across sheets. Reverts on failure. Reads the latest state
   * through a ref, so a toast's Undo closure never diffs against stale data.
   */
  function changeShareSettings(keys: Array<string>, next: ShareSettings) {
    const before = shareForTarget(sheetSharesRef.current, keys)
    const patch: Partial<SheetShare> = {}
    if (next.showPrices !== before.showPrices)
      patch.showPrices = next.showPrices
    if (next.allowClaims !== before.allowClaims)
      patch.allowClaims = next.allowClaims
    if (next.sharing !== undefined && next.sharing !== before.sharing)
      patch.sharing = next.sharing
    patchShareSettings(keys, patch)
  }

  /**
   * r8: writes exactly `patch` to every sheet in `keys`. Stop sharing and
   * its Undo use this, so they only ever touch `sharing` (Bau: never Show
   * prices or Friends can claim).
   */
  function patchShareSettings(keys: Array<string>, patch: Partial<SheetShare>) {
    if (keys.length === 0 || Object.keys(patch).length === 0) return
    const previous = sheetSharesRef.current
    const updated = { ...previous }
    for (const key of keys)
      updated[key] = { ...(previous[key] ?? DEFAULT_SHARE), ...patch }
    sheetSharesRef.current = updated
    setSheetShares(updated)
    const revert = () => {
      sheetSharesRef.current = previous
      setSheetShares(previous)
    }
    saveShareSettings({ data: { sheetIds: keys, ...patch } })
      .then((result) => {
        if (!result.ok) revert()
        else {
          sheetSharesRef.current = result.sheets
          setSheetShares(result.sheets)
        }
      })
      .catch(revert)
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
      color: nextTagColor(categoriesRef.current),
      createdAt: Date.now(),
    }
    try {
      await saveActiveCategory(signedIn, category)
    } catch (error) {
      return messageFrom(error)
    }
    categoriesRef.current = [...categoriesRef.current, category]
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

  /** Keeps manual order, purchase date and price, which the editor does not edit. */
  function withKeptFields(item: GuestItem): GuestItem {
    const existing = items.find((entry) => entry.id === item.id)
    const position =
      existing &&
      existing.categoryId === item.categoryId &&
      existing.position != null
        ? existing.position
        : topPosition(
            items
              .filter((entry) => entry.id !== item.id)
              .map((entry) => entry.position ?? null),
          )
    return {
      ...item,
      position,
      purchasedAt: existing?.purchasedAt ?? null,
      price: existing?.price ?? null,
    }
  }

  async function createCategoryForStacks(name: string) {
    const error = await createCategory(name)
    if (error) return error
    const created = categoriesRef.current.find(
      (category) => category.name.toLowerCase() === name.trim().toLowerCase(),
    )
    return created ?? 'That category could not be saved.'
  }

  function chooseLayout(next: Layout) {
    setLayout(next)
    localStorage.setItem('wishlist-layout', next)
  }

  const dialogs = (
    <>
      <ItemEditor
        draft={editor}
        categories={categories}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
        onSave={async (item) => {
          try {
            const kept = withKeptFields(item)
            await saveActiveItem(signedIn, kept)
            setItems((current) =>
              sortByPosition([
                kept,
                ...current.filter((entry) => entry.id !== kept.id),
              ]),
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
                  void saveActiveItem(signedIn, next)
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
              enterKeyHint="done"
              start={
                <span className="category-hash" aria-hidden="true">
                  #
                </span>
              }
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
    </>
  )

  if (layout === 'stacks') {
    return (
      <>
        {storageError ? (
          <p role="alert" className="nt-sr">
            {storageError}
          </p>
        ) : null}
        <StickerBoard
          items={items}
          categories={categories}
          status={
            !ready
              ? 'loading'
              : storageError && items.length === 0 && categories.length === 0
                ? 'error'
                : 'ready'
          }
          onRetry={() => {
            setStorageError(null)
            setLoadRun((run) => run + 1)
          }}
          user={
            session?.user
              ? {
                  name: session.user.name,
                  username: username || null,
                  image: session.user.image ?? null,
                }
              : null
          }
          origin={origin}
          layout={layout}
          onLayout={chooseLayout}
          sheetShares={sheetShares}
          onShareSettings={changeShareSettings}
          onSharePatch={patchShareSettings}
          claims={claims}
          profile={userId ? profile : undefined}
          onSetGot={setGot}
          onPrint={printSticker}
          onCreateCategory={createCategoryForStacks}
          onReorder={async (ids) => {
            const next = await reorderActiveItems(signedIn, items, ids)
            setItems(sortByPosition(next))
            setStorageError(null)
          }}
          onEdit={(item) => openEditor(draftFromItem(item))}
          onDelete={(item) => setConfirmItem(item)}
          onUpdate={updateItem}
          onSearch={() => setCommandOpen(true)}
          onSignOut={() => void authClient.signOut()}
        />
        {dialogs}
      </>
    )
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
            #all
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
              {categoryTag(category.name)}
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
        <div className="category-menu">
          <DropdownMenu
            align="start"
            label={
              selectedCategory ? categoryTag(selectedCategory.name) : '#all'
            }
            items={[
              {
                label: '#all',
                onSelect: () => setSelectedCategoryId(null),
              },
              ...categories.map((category) => ({
                label: categoryTag(category.name),
                onSelect: () => setSelectedCategoryId(category.id),
              })),
              {
                label: 'New category',
                separatorBefore: true,
                onSelect: () => {
                  setCategoryName('')
                  setCategoryError(null)
                  setCategoryOpen(true)
                },
              },
            ]}
          />
        </div>

        <main>
          <header className="mb-8 md:pe-28">
            <h1>
              <HeatWord />
            </h1>
            <p className="wishlist-note mt-3">
              {signedIn
                ? 'Saved to your account.'
                : 'Saved on this browser. It is not backed up and will not appear on another device.'}
            </p>
            {signedIn && username && origin ? (
              <div className="mt-4">
                <CopyButton
                  value={`${origin}/u/${username}`}
                  label="Copy share link"
                />
              </div>
            ) : null}
            {signedIn && !username ? (
              <p className="wishlist-note mt-3">
                <Link to="/account">Choose a username</Link> to share this list.
              </p>
            ) : null}
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
            ) : null}
          </div>

          {ready ? (
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
                  aria-pressed={false}
                  onClick={() => chooseLayout('stacks')}
                >
                  Stacks
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
          ) : null}

          {!ready ? (
            <p className="wishlist-note mt-8">Loading your list…</p>
          ) : visibleItems.length === 0 ? (
            <div className="empty-state">
              <img
                src="/empty-state-needthat.webp"
                alt=""
                width={1684}
                height={2528}
              />
              <div className="empty-state-copy">
                <p className="empty-state-title">Hmm, nothing here yet</p>
                <p className="empty-state-hint">
                  {selectedCategory
                    ? `Nothing in ${categoryTag(selectedCategory.name)} yet.`
                    : "Let's get your wishlist started"}
                </p>
              </div>
            </div>
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

        {dialogs}
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
  if (error instanceof Error && error.message) return error.message
  return 'The wishlist could not be saved.'
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
