import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { CheckIcon, ImageIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react'

import { ProductSearch } from '#/components/wishlist/product-search'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import {
  deleteGuestItem,
  GuestStoreError,
  loadGuestItems,
  saveGuestItem,
} from '#/lib/guest-wishlist'
import type { GuestItem } from '#/lib/guest-wishlist'
import {
  ACCEPTED_IMAGE_TYPES,
  itemDraftSchema,
  validateImageFile,
} from '#/lib/item-draft'
import type { ItemDraft } from '#/lib/item-draft'

const emptyDraft: ItemDraft = {
  title: '',
  brand: '',
  notes: '',
  sourceUrl: '',
}

export function WishlistScreen() {
  const [items, setItems] = useState<Array<GuestItem>>([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [editing, setEditing] = useState<GuestItem | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<GuestItem | null>(null)
  const removalTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    loadGuestItems()
      .then((loaded) => {
        if (cancelled) return
        setItems(loaded)
        setReady(true)
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
      if (removalTimer.current !== null) {
        window.clearTimeout(removalTimer.current)
      }
    }
  }, [])

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
    if (pendingRemoval && pendingRemoval.id !== item.id) {
      commitRemoval(pendingRemoval)
    }
    if (removalTimer.current !== null) {
      window.clearTimeout(removalTimer.current)
    }
    setPendingRemoval(item)
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    if (editing?.id === item.id) setEditing(null)
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

  const showComposer = composerOpen || editing !== null || (ready && items.length === 0)

  return (
    <main className="mx-auto w-full max-w-[1080px] px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 flex items-end justify-between gap-6">
        <div className="max-w-xl">
          <h1 className="text-[32px] leading-none font-semibold tracking-[-0.03em] text-[#1c1c1a]">
            Wishlist
          </h1>
          <p className="mt-3 text-sm leading-5 text-[#5c5a55]">
            Saved on this browser. It is not backed up and will not appear on
            another device.
          </p>
        </div>
        {items.length > 0 && !showComposer ? (
          <Button
            type="button"
            className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:active:scale-[0.96]"
            onClick={() => setComposerOpen(true)}
          >
            <PlusIcon />
            Add
          </Button>
        ) : null}
      </header>

      {storageError ? (
        <p
          role="alert"
          className="mb-6 rounded-md bg-[#1c1c1a] px-4 py-3 text-sm text-[#f6f5f2]"
        >
          {storageError}
        </p>
      ) : null}

      {showComposer ? (
        <ItemComposer
          key={editing?.id ?? 'new'}
          editing={editing}
          onCancel={() => {
            setEditing(null)
            setComposerOpen(false)
          }}
          onSaved={(item) => {
            setItems((current) =>
              [item, ...current.filter((entry) => entry.id !== item.id)].sort(
                (a, b) => b.createdAt - a.createdAt,
              ),
            )
            setEditing(null)
            setComposerOpen(false)
            setStorageError(null)
          }}
          onError={setStorageError}
        />
      ) : null}

      {!ready ? (
        <p className="text-sm text-[#5c5a55]">Loading your list…</p>
      ) : items.length === 0 && !storageError ? null : (
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
          {items.map((item) => (
            <li key={item.id}>
              <ItemCard
                item={item}
                onEdit={() => {
                  setComposerOpen(false)
                  setEditing(item)
                }}
                onRemove={() => removeItem(item)}
                onTogglePurchased={() => {
                  void togglePurchased(item)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {pendingRemoval ? (
        <div className="fixed inset-x-4 bottom-4 z-20 mx-auto flex max-w-md items-center justify-between gap-4 rounded-md bg-[#1c1c1a] px-4 py-3 text-sm text-[#f6f5f2] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:left-auto">
          <p>Removed {pendingRemoval.title}</p>
          <button
            type="button"
            className="font-medium underline-offset-4 hover:underline"
            onClick={undoRemoval}
          >
            Undo
          </button>
        </div>
      ) : null}
    </main>
  )
}

function ItemComposer({
  editing,
  onCancel,
  onSaved,
  onError,
}: {
  editing: GuestItem | null
  onCancel: () => void
  onSaved: (item: GuestItem) => void
  onError: (message: string) => void
}) {
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [remoteImageUrl, setRemoteImageUrl] = useState<string | null>(
    editing?.imageUrl ?? null,
  )
  const [clearedExistingImage, setClearedExistingImage] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(editing !== null)
  const [fileKey, setFileKey] = useState(0)
  const existingPreview = useObjectUrl(
    clearedExistingImage ? null : (editing?.image ?? null),
  )

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  const form = useForm({
    defaultValues: editing
      ? {
          title: editing.title,
          brand: editing.brand,
          notes: editing.notes,
          sourceUrl: editing.sourceUrl,
        }
      : emptyDraft,
    onSubmit: async ({ value }) => {
      const parsed = itemDraftSchema.safeParse(value)
      if (!parsed.success) return
      if (imageFile) {
        const fileError = validateImageFile(imageFile)
        if (fileError) {
          setImageError(fileError)
          return
        }
      }

      const now = Date.now()
      const nextImage = imageFile
        ? imageFile
        : clearedExistingImage
          ? null
          : (editing?.image ?? null)
      const item: GuestItem = {
        id: editing?.id ?? crypto.randomUUID(),
        title: parsed.data.title,
        brand: parsed.data.brand,
        notes: parsed.data.notes,
        sourceUrl: parsed.data.sourceUrl,
        status: editing?.status ?? 'unresolved',
        image: nextImage,
        imageType: imageFile
          ? imageFile.type
          : nextImage
            ? (editing?.imageType ?? null)
            : null,
        imageUrl: imageFile ? null : remoteImageUrl,
        createdAt: editing?.createdAt ?? now,
        updatedAt: now,
      }

      try {
        await saveGuestItem(item)
        onSaved(item)
        form.reset()
        setImageFile(null)
        setRemoteImageUrl(null)
        setClearedExistingImage(false)
        setImageError(null)
        setFileKey((key) => key + 1)
      } catch (error) {
        onError(messageFrom(error))
      }
    },
  })

  const shownPreview = previewUrl ?? existingPreview ?? remoteImageUrl

  return (
    <form
      className="grid gap-4 rounded-md bg-white p-4 shadow-[0_0_0_1px_oklch(0_0_0/0.08)]"
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="title"
        validators={{
          onSubmit: ({ value }) =>
            fieldError(itemDraftSchema.shape.title, value),
        }}
      >
        {(field) => (
          <ProductSearch
            id={field.name}
            value={field.state.value}
            error={firstError(field.state.meta.errors)}
            onChange={(value) => field.handleChange(value)}
            onSelect={(candidate) => {
              field.handleChange(candidate.title)
              form.setFieldValue('sourceUrl', candidate.url ?? '')
              setRemoteImageUrl(candidate.imageUrl)
              setImageFile(null)
              setClearedExistingImage(true)
              setImageError(null)
              setDetailsOpen(true)
            }}
          />
        )}
      </form.Field>
      {detailsOpen ? (
      <>
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-[#f6f5f2] shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1)]">
            {shownPreview ? (
              <img
                src={shownPreview}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain p-3"
              />
            ) : (
              <ImageIcon className="text-[#8a877f]" size={28} />
            )}
          </div>
          <Label htmlFor="item-image" className="mt-3">
            Photo
          </Label>
          <Input
            key={fileKey}
            id="item-image"
            className="mt-2"
            type="file"
            accept={ACCEPTED_IMAGE_TYPES.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null
              if (!file) {
                setImageFile(null)
                setImageError(null)
                return
              }
              const fileError = validateImageFile(file)
              setImageError(fileError)
              if (fileError) return
              setImageFile(file)
              setRemoteImageUrl(null)
              setClearedExistingImage(true)
            }}
          />
          {imageError ? (
            <p className="mt-2 text-sm text-[#8a2f2f]">{imageError}</p>
          ) : (
            <p className="mt-2 text-xs leading-4 text-[#5c5a55]">
              JPEG, PNG, WebP, or GIF. 8 MB maximum. A photo does not verify
              the product.
            </p>
          )}
        </div>

        <div className="grid content-start gap-4">
          <form.Field
            name="brand"
            validators={{
              onSubmit: ({ value }) =>
                fieldError(itemDraftSchema.shape.brand, value),
            }}
          >
            {(field) => (
              <Field
                id={field.name}
                label="Brand"
                error={firstError(field.state.meta.errors)}
              >
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
          <form.Field
            name="sourceUrl"
            validators={{
              onSubmit: ({ value }) =>
                fieldError(itemDraftSchema.shape.sourceUrl, value),
            }}
          >
            {(field) => (
              <Field
                id={field.name}
                label="Link"
                error={firstError(field.state.meta.errors)}
              >
                <Input
                  id={field.name}
                  name={field.name}
                  inputMode="url"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                />
              </Field>
            )}
          </form.Field>
          <form.Field
            name="notes"
            validators={{
              onSubmit: ({ value }) =>
                fieldError(itemDraftSchema.shape.notes, value),
            }}
          >
            {(field) => (
              <Field
                id={field.name}
                label="Notes"
                error={firstError(field.state.meta.errors)}
              >
                <Textarea
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
              </Field>
            )}
          </form.Field>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset()
            setImageFile(null)
            setRemoteImageUrl(null)
            setClearedExistingImage(false)
            setImageError(null)
            setFileKey((key) => key + 1)
            onCancel()
          }}
        >
          Cancel
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="submit"
              disabled={isSubmitting}
              className="motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-safe:active:scale-[0.96]"
            >
              {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Save'}
            </Button>
          )}
        </form.Subscribe>
      </div>
      </>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" onClick={() => setDetailsOpen(true)}>
            Save this description
          </Button>
        </div>
      )}
    </form>
  )
}

function ItemCard({
  item,
  onEdit,
  onRemove,
  onTogglePurchased,
}: {
  item: GuestItem
  onEdit: () => void
  onRemove: () => void
  onTogglePurchased: () => void
}) {
  const blobUrl = useObjectUrl(item.image)
  const preview = blobUrl ?? item.imageUrl

  return (
    <article className="grid gap-3">
      <button
        type="button"
        className="block w-full text-left"
        onClick={onEdit}
      >
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-white shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1)]">
          {preview ? (
            <img
              src={preview}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain p-3"
            />
          ) : (
            <ImageIcon className="text-[#8a877f]" size={28} />
          )}
        </div>
        <h2 className="mt-3 text-[15px] leading-5 font-medium text-[#1c1c1a]">
          {item.title}
        </h2>
        {item.brand ? (
          <p className="text-sm leading-5 text-[#5c5a55]">{item.brand}</p>
        ) : null}
        {item.status === 'purchased' ? (
          <p className="text-sm leading-5 text-[#5c5a55]">Purchased</p>
        ) : null}
      </button>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onTogglePurchased}
        >
          <CheckIcon />
          {item.status === 'purchased' ? 'Unpurchased' : 'Purchased'}
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={`Remove ${item.title}`}
          onClick={onRemove}
        >
          <TrashIcon />
        </Button>
      </div>
    </article>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-sm text-[#8a2f2f]">{error}</p> : null}
    </div>
  )
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

function fieldError(schema: { safeParse: (value: string) => { success: boolean; error?: { issues: Array<{ message: string }> } } }, value: string) {
  const result = schema.safeParse(value)
  return result.success ? undefined : result.error?.issues[0]?.message
}

function firstError(errors: Array<unknown>) {
  const error = errors[0]
  return typeof error === 'string' ? error : undefined
}

function messageFrom(error: unknown) {
  if (error instanceof GuestStoreError) return error.message
  return 'The wishlist could not be saved on this browser.'
}
