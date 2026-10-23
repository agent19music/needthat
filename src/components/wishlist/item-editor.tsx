import { useEffect, useState } from 'react'

import { Button } from '#/components/arc/button/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
} from '#/components/arc/dialog/dialog'
import { Input } from '#/components/arc/input/input'
import { Select } from '#/components/arc/select/select'
import { Textarea } from '#/components/arc/textarea/textarea'
import type { GuestCategory, GuestItem, ItemStatus } from '#/lib/guest-wishlist'
import {
  ACCEPTED_IMAGE_TYPES,
  itemDraftSchema,
  validateImageFile,
} from '#/lib/item-draft'

const NONE = 'none'

export type EditorDraft = {
  id: string | null
  title: string
  brand: string
  notes: string
  sourceUrl: string
  categoryId: string | null
  status: ItemStatus
  image: Blob | null
  imageType: string | null
  imageUrl: string | null
  createdAt: number | null
}

export function ItemEditor({
  draft,
  categories,
  onOpenChange,
  onSave,
}: {
  draft: EditorDraft | null
  categories: Array<GuestCategory>
  onOpenChange: (open: boolean) => void
  onSave: (item: GuestItem) => Promise<void>
}) {
  return (
    <Dialog open={draft !== null} onOpenChange={onOpenChange}>
      {draft ? (
        <DialogContent
          title={draft.id ? 'Edit item' : 'Add details'}
          description="Name, link, notes, and category."
        >
          <EditorForm
            key={draft.id ?? `${draft.title}:${draft.imageUrl ?? ''}`}
            draft={draft}
            categories={categories}
            onSave={onSave}
          />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function EditorForm({
  draft,
  categories,
  onSave,
}: {
  draft: EditorDraft
  categories: Array<GuestCategory>
  onSave: (item: GuestItem) => Promise<void>
}) {
  const [title, setTitle] = useState(draft.title)
  const [brand, setBrand] = useState(draft.brand)
  const [sourceUrl, setSourceUrl] = useState(draft.sourceUrl)
  const [notes, setNotes] = useState(draft.notes)
  const [categoryId, setCategoryId] = useState(draft.categoryId ?? NONE)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<Partial<Record<'title' | 'brand' | 'sourceUrl' | 'notes', string>>>({})
  const [saving, setSaving] = useState(false)
  const previewUrl = useObjectUrl(imageFile ?? draft.image)
  const shownPreview = previewUrl ?? (imageFile ? null : draft.imageUrl)

  async function save() {
    const parsed = itemDraftSchema.safeParse({ title, brand, notes, sourceUrl })
    if (!parsed.success) {
      const next: typeof fieldError = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'title' || key === 'brand' || key === 'sourceUrl' || key === 'notes') {
          next[key] ??= issue.message
        }
      }
      setFieldError(next)
      return
    }
    if (imageFile) {
      const fileError = validateImageFile(imageFile)
      if (fileError) {
        setImageError(fileError)
        return
      }
    }

    const now = Date.now()
    const nextImage = imageFile ?? draft.image
    setSaving(true)
    try {
      await onSave({
        id: draft.id ?? crypto.randomUUID(),
        title: parsed.data.title,
        brand: parsed.data.brand,
        notes: parsed.data.notes,
        sourceUrl: parsed.data.sourceUrl,
        categoryId: categoryId === NONE ? null : categoryId,
        status: draft.status,
        image: nextImage,
        imageType: imageFile ? imageFile.type : nextImage ? draft.imageType : null,
        imageUrl: imageFile ? null : draft.imageUrl,
        createdAt: draft.createdAt ?? now,
        updatedAt: now,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="editor-fields">
      <Input
        label="Name"
        value={title}
        error={fieldError.title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Input
        label="Brand"
        value={brand}
        error={fieldError.brand}
        onChange={(event) => setBrand(event.target.value)}
      />
      <Input
        label="Link"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="go"
        value={sourceUrl}
        error={fieldError.sourceUrl}
        onChange={(event) => setSourceUrl(event.target.value)}
      />
      <Textarea
        label="Notes"
        rows={4}
        value={notes}
        error={fieldError.notes}
        onChange={(event) => setNotes(event.target.value)}
      />
      <Select
        label="Category"
        value={categoryId}
        onValueChange={setCategoryId}
        options={[
          { value: NONE, label: 'No category' },
          ...categories.map((category) => ({
            value: category.id,
            label: `#${category.name.trim().toLowerCase()}`,
          })),
        ]}
      />
      <div>
        {shownPreview ? (
          <img
            src={shownPreview}
            alt=""
            referrerPolicy="no-referrer"
            className="mb-3 h-24 w-24 rounded-md object-contain"
            style={{ background: 'var(--surface-muted)' }}
          />
        ) : null}
        <label className="grid gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Photo
          <input
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
              if (!fileError) setImageFile(file)
            }}
          />
        </label>
        {imageError ? (
          <p className="match-error" role="alert">
            {imageError}
          </p>
        ) : (
          <p className="match-note">JPEG, PNG, WebP, or GIF. 8 MB maximum.</p>
        )}
      </div>
      <div className="dialog-actions">
        <DialogClose asChild>
          <Button type="button" variant="secondary">
            Cancel
          </Button>
        </DialogClose>
        <Button type="button" variant="primary" loading={saving} onClick={() => void save()}>
          Save
        </Button>
      </div>
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
