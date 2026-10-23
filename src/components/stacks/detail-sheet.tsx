import { useEffect, useState } from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowSquareOutIcon,
  CheckIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
} from '@phosphor-icons/react'

import { Input } from '#/components/arc/input/input'
import { Textarea } from '#/components/arc/textarea/textarea'
import { GotStamp } from '#/components/stacks/got-stamp'
import { ItemImage } from '#/components/stacks/pile-card'
import { instant, t } from '#/components/stacks/tokens'
import { MOBILE_QUERY, useMedia } from '#/components/stacks/use-media'
import { itemDraftSchema } from '#/lib/item-draft'
import {
  addedLabel,
  categoryTag,
  formatPrice,
  gotTime,
  hostOf,
} from '#/lib/stacks/stacks'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

type Mode = 'view' | 'edit' | 'confirm'

/**
 * Item details: a 420px right panel on desktop, a bottom sheet (28px top
 * radius, grabber) below 768px. Edit and delete-confirm stay in the sheet.
 * Radix handles the focus trap, Esc and returning focus to the opener.
 */
export function DetailSheet({
  item,
  categories,
  readOnly = false,
  initialMode = 'view',
  onClose,
  onGot,
  onSave,
  onDelete,
  onChangeImage,
  onCreateCategory,
}: {
  item: GuestItem | null
  categories: ReadonlyArray<GuestCategory>
  readOnly?: boolean
  initialMode?: 'view' | 'edit'
  onClose: () => void
  onGot: (item: GuestItem) => void
  onSave: (item: GuestItem) => Promise<void>
  onDelete: (item: GuestItem) => void
  onChangeImage: (item: GuestItem) => void
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
}) {
  const mobile = useMedia(MOBILE_QUERY)
  const reduced = useReducedMotion() ?? false
  const open = item !== null
  const [shown, setShown] = useState<GuestItem | null>(item)
  useEffect(() => {
    if (item) setShown(item)
  }, [item])

  const panel = mobile
    ? { hidden: { y: '100%' }, visible: { y: 0 } }
    : { hidden: { x: '105%' }, visible: { x: 0 } }

  return (
    <SheetPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <AnimatePresence>
        {open && shown ? (
          <SheetPrimitive.Portal forceMount>
            <SheetPrimitive.Overlay asChild forceMount>
              <motion.div
                className="stk-scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  transition: reduced
                    ? instant
                    : { duration: t.d.exit, ease: t.ease.exit },
                }}
                transition={
                  reduced
                    ? instant
                    : { duration: t.d.standard, ease: t.ease.enter }
                }
              />
            </SheetPrimitive.Overlay>
            <SheetPrimitive.Content
              asChild
              forceMount
              aria-describedby={undefined}
            >
              <motion.div
                className="stk-sheet"
                data-mobile={mobile || undefined}
                initial={reduced ? { opacity: 0 } : panel.hidden}
                animate={reduced ? { opacity: 1 } : panel.visible}
                exit={
                  reduced
                    ? { opacity: 0, transition: instant }
                    : {
                        ...panel.hidden,
                        transition: { duration: t.d.exit, ease: t.ease.exit },
                      }
                }
                transition={reduced ? instant : t.spring.smooth}
              >
                <SheetBody
                  key={`${shown.id}:${initialMode}`}
                  item={shown}
                  categories={categories}
                  readOnly={readOnly}
                  initialMode={initialMode}
                  mobile={mobile}
                  onGot={onGot}
                  onSave={onSave}
                  onDelete={onDelete}
                  onChangeImage={onChangeImage}
                  onCreateCategory={onCreateCategory}
                />
              </motion.div>
            </SheetPrimitive.Content>
          </SheetPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </SheetPrimitive.Root>
  )
}

function SheetBody({
  item,
  categories,
  readOnly,
  initialMode,
  mobile,
  onGot,
  onSave,
  onDelete,
  onChangeImage,
  onCreateCategory,
}: {
  item: GuestItem
  categories: ReadonlyArray<GuestCategory>
  readOnly: boolean
  initialMode: 'view' | 'edit'
  mobile: boolean
  onGot: (item: GuestItem) => void
  onSave: (item: GuestItem) => Promise<void>
  onDelete: (item: GuestItem) => void
  onChangeImage: (item: GuestItem) => void
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
}) {
  const [mode, setMode] = useState<Mode>(readOnly ? 'view' : initialMode)
  const category = categories.find((entry) => entry.id === item.categoryId)
  const price = formatPrice(item.price)
  const got = item.status === 'purchased'

  return (
    <>
      {mobile ? <span className="stk-grabber" aria-hidden="true" /> : null}
      <div className="stk-sheet-top">
        <span className="stk-chip">
          {category ? categoryTag(category.name) : '#all'}
        </span>
        <SheetPrimitive.Close
          className="stk-round"
          data-small
          aria-label="Close"
        >
          <XIcon size={14} aria-hidden="true" />
        </SheetPrimitive.Close>
      </div>
      {mode === 'edit' ? (
        <EditForm
          item={item}
          categories={categories}
          onCancel={() => setMode('view')}
          onSave={async (next) => {
            await onSave(next)
            setMode('view')
          }}
          onChangeImage={() => onChangeImage(item)}
          onCreateCategory={onCreateCategory}
        />
      ) : (
        <>
          <div className="stk-sheet-scroll">
            <div className="stk-big">
              <ItemImage item={item} />
              {got ? (
                <span className="stk-big-stamp">
                  <GotStamp date={gotTime(item)} />
                </span>
              ) : null}
            </div>
            <div className="stk-sheet-body">
              <SheetPrimitive.Title className="stk-sheet-title">
                {item.title}
              </SheetPrimitive.Title>
              <p className="stk-sheet-brand">
                {[item.brand, price].filter(Boolean).map((part, index) =>
                  index === 1 ? (
                    <b key="price" className="stk-mono">
                      {' · '}
                      {part}
                    </b>
                  ) : (
                    <span key="brand">{part}</span>
                  ),
                )}
              </p>
              <dl className="stk-dl">
                {item.sourceUrl ? (
                  <div>
                    <dt>Link</dt>
                    <dd>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        {hostOf(item.sourceUrl) ?? item.sourceUrl} ↗
                      </a>
                    </dd>
                  </div>
                ) : null}
                {item.notes ? (
                  <div>
                    <dt>Notes</dt>
                    <dd>{item.notes}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Added</dt>
                  <dd>{addedLabel(item.createdAt)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{got ? `Got · ${addedLabel(gotTime(item))}` : 'Want'}</dd>
                </div>
              </dl>
            </div>
          </div>
          {readOnly ? null : mode === 'confirm' ? (
            <div
              className="stk-sheet-foot"
              role="group"
              aria-label="Delete this item?"
            >
              <span className="stk-confirm-text">Delete this item?</span>
              <button
                type="button"
                className="stk-btn"
                autoFocus
                onClick={() => setMode('view')}
              >
                Keep
              </button>
              <button
                type="button"
                className="stk-btn"
                data-danger-fill
                onClick={() => onDelete(item)}
              >
                Delete
              </button>
            </div>
          ) : (
            <div className="stk-sheet-foot">
              <button
                type="button"
                className="stk-btn"
                data-primary
                onClick={() => onGot(item)}
              >
                <CheckIcon size={13} aria-hidden="true" />
                {got ? 'Want again' : 'Got it'}
              </button>
              <button
                type="button"
                className="stk-btn"
                onClick={() => setMode('edit')}
              >
                <PencilSimpleIcon size={13} aria-hidden="true" />
                Edit
              </button>
              {item.sourceUrl ? (
                <a
                  className="stk-btn"
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowSquareOutIcon size={13} aria-hidden="true" />
                  Open
                </a>
              ) : null}
              <button
                type="button"
                className="stk-btn"
                data-danger
                onClick={() => setMode('confirm')}
              >
                <TrashIcon size={13} aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

function EditForm({
  item,
  categories,
  onCancel,
  onSave,
  onChangeImage,
  onCreateCategory,
}: {
  item: GuestItem
  categories: ReadonlyArray<GuestCategory>
  onCancel: () => void
  onSave: (item: GuestItem) => Promise<void>
  onChangeImage: () => void
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
}) {
  const [title, setTitle] = useState(item.title)
  const [brand, setBrand] = useState(item.brand)
  const [sourceUrl, setSourceUrl] = useState(item.sourceUrl)
  const [notes, setNotes] = useState(item.notes)
  const [categoryId, setCategoryId] = useState<string | null>(
    item.categoryId ?? null,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newError, setNewError] = useState<string | null>(null)

  async function save() {
    const parsed = itemDraftSchema.safeParse({ title, brand, notes, sourceUrl })
    if (!parsed.success) {
      const next: Record<string, string> = {}
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = issue.message
      setErrors(next)
      return
    }
    setErrors({})
    setSaving(true)
    try {
      await onSave({
        ...item,
        title: parsed.data.title,
        brand: parsed.data.brand,
        notes: parsed.data.notes,
        sourceUrl: parsed.data.sourceUrl,
        categoryId,
        updatedAt: Date.now(),
      })
    } catch {
      setErrors({ form: 'That did not save. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function addCategory() {
    const result = await onCreateCategory(newName)
    if (typeof result === 'string') {
      setNewError(result)
      return
    }
    setCategoryId(result.id)
    setAdding(false)
    setNewName('')
    setNewError(null)
  }

  return (
    <form
      className="stk-edit"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="stk-sheet-scroll">
        <SheetPrimitive.Title className="stk-sheet-title">
          Edit item
        </SheetPrimitive.Title>
        <div className="editor-fields stk-fields">
          <Input
            label="Name"
            value={title}
            error={errors.title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Input
            label="Brand"
            value={brand}
            error={errors.brand}
            onChange={(event) => setBrand(event.target.value)}
          />
          <Input
            label="Link"
            value={sourceUrl}
            inputMode="url"
            error={errors.sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
          />
          <fieldset className="stk-field">
            <legend>Category</legend>
            <div className="stk-chips">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className="stk-chip"
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                >
                  {categoryTag(category.name)}
                </button>
              ))}
              {adding ? null : (
                <button
                  type="button"
                  className="stk-chip"
                  data-new
                  onClick={() => setAdding(true)}
                >
                  + New
                </button>
              )}
            </div>
            {adding ? (
              <div className="stk-new-category">
                <Input
                  label="New category"
                  value={newName}
                  autoFocus
                  error={newError ?? undefined}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void addCategory()
                    }
                  }}
                />
                <button
                  type="button"
                  className="stk-btn"
                  onClick={() => void addCategory()}
                >
                  Add
                </button>
              </div>
            ) : null}
          </fieldset>
          <Textarea
            label="Notes"
            value={notes}
            error={errors.notes}
            onChange={(event) => setNotes(event.target.value)}
          />
          <div>
            <button type="button" className="stk-btn" onClick={onChangeImage}>
              Change image
            </button>
          </div>
          {errors.form ? (
            <p role="alert" className="wishlist-alert">
              {errors.form}
            </p>
          ) : null}
        </div>
      </div>
      <div className="stk-sheet-foot">
        <button
          type="submit"
          className="stk-btn"
          data-primary
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="stk-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
