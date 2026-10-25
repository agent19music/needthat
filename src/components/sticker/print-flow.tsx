import { useEffect, useRef, useState } from 'react'
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  ClipboardTextIcon,
  ImageSquareIcon,
  InfoIcon,
  LinkIcon,
  NotePencilIcon,
  PencilSimpleIcon,
  PlusIcon,
  ScissorsIcon,
  StickerIcon,
  UploadSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from '@phosphor-icons/react'

import { PriceDot, StickerArt } from '#/components/sticker/sticker'
import { searchProducts } from '#/lib/discovery/search-products'
import type { ProductCandidate } from '#/lib/discovery/candidates'
import { normaliseLink } from '#/lib/discovery/link-reader'
import type { LinkProduct } from '#/lib/discovery/link-reader'
import { readProductLink } from '#/lib/discovery/read-link'
import { cutForPrint, printFromLink } from '#/lib/images/print-sticker'
import type { PrintedSticker } from '#/lib/images/print-sticker'
import { linkChip } from '#/lib/sticker/link-chip'
import { categoryTag, formatPrice, tagColors } from '#/lib/sticker/sheets'
import type { GuestCategory, GuestItem } from '#/lib/guest-wishlist'

type Phase = 'idle' | 'reading' | 'results' | 'cutting' | 'ready' | 'error'

type Print = PrintedSticker | { kind: 'upload'; blob: Blob; url: null }

/** A link when it has a dot and no spaces; anything else is a name search. */
export function looksLikeLink(input: string) {
  const trimmed = input.trim()
  return /^[^\s]+\.[^\s]{2,}/.test(trimmed) && normaliseLink(trimmed) !== null
}

/**
 * S6/S6b "Print a sticker": paste a link (or type a name), we read the shop
 * page, cut the photo (flood fill + quality gate, Q10) or keep it as a photo
 * sticker, pick the sheet, print.
 */
export function PrintFlow({
  initial,
  categories,
  categoryId,
  onClose,
  onPrint,
  onCreateCategory,
}: {
  initial: string
  categories: ReadonlyArray<GuestCategory>
  categoryId: string | null
  onClose: () => void
  onPrint: (item: GuestItem) => Promise<void>
  onCreateCategory: (name: string) => Promise<GuestCategory | string>
}) {
  const itemId = useRef(crypto.randomUUID()).current
  const [text, setText] = useState(initial)
  const [pasted, setPasted] = useState(false)
  const [fieldFocused, setFieldFocused] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const [results, setResults] = useState<Array<ProductCandidate>>([])
  const [product, setProduct] = useState<LinkProduct | null>(null)
  const [imageIndex, setImageIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [printed, setPrinted] = useState<Print | null>(null)
  const [title, setTitle] = useState('')
  const [brand, setBrand] = useState('')
  const [editing, setEditing] = useState(false)
  const [tag, setTag] = useState<string | null>(
    categoryId ?? categories.at(0)?.id ?? null,
  )
  const [newTag, setNewTag] = useState<string | null>(null)
  const [tagError, setTagError] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const run = useRef(0)
  const colors = tagColors(categories)
  const [canPaste, setCanPaste] = useState(false)
  useEffect(() => {
    setCanPaste('clipboard' in navigator)
  }, [])

  useEffect(() => {
    if (initial.trim()) void submit(initial)
    // Only the text the flow opened with.
  }, [])

  async function submit(value = text) {
    const input = value.trim()
    if (!input) return
    const id = ++run.current
    setError(null)
    setManual(false)
    setPrinted(null)
    setResults([])
    if (!looksLikeLink(input)) {
      setPhase('reading')
      try {
        const found = await searchProducts({ data: { query: input } })
        if (id !== run.current) return
        if (!found.ok || found.candidates.length === 0) {
          setPhase('error')
          setError(
            found.ok
              ? 'No matches. Paste the shop link instead, or add it by hand.'
              : found.message,
          )
          setTitle(input)
          return
        }
        setResults(found.candidates)
        setPhase('results')
      } catch {
        if (id !== run.current) return
        setPhase('error')
        setTitle(input)
        setError(
          'Search failed. Paste the shop link instead, or add it by hand.',
        )
      }
      return
    }
    setPhase('reading')
    try {
      const read = await readProductLink({ data: { url: input } })
      if (id !== run.current) return
      if (!read.ok) {
        setPhase('error')
        setError(read.message)
        return
      }
      choose(read.product)
    } catch {
      if (id !== run.current) return
      setPhase('error')
      setError("We couldn't read that link. Add it by hand")
    }
  }

  function choose(next: LinkProduct) {
    setProduct(next)
    setTitle(next.title)
    setBrand(next.brand)
    setImageIndex(0)
    setAttempt(0)
    if (next.images.length === 0) {
      setPhase('ready')
      setPrinted(null)
      setManual(true)
      return
    }
    void cut(next.images[0], 0)
  }

  async function cut(imageUrl: string, tries: number) {
    const id = ++run.current
    setPhase('cutting')
    const result = await printFromLink(itemId, imageUrl, tries).catch(
      () => null,
    )
    if (id !== run.current) return
    // Could not copy the image (e.g. signed out): keep the shop photo.
    setPrinted(
      result ?? { kind: 'photo', url: imageUrl, reason: 'no-backdrop' },
    )
    setPhase('ready')
  }

  async function upload(file: File) {
    const id = ++run.current
    setPhase('cutting')
    const result = await cutForPrint(itemId, { blob: file }).catch(() => null)
    if (id !== run.current) return
    setPrinted(result ?? { kind: 'upload', blob: file, url: null })
    setPhase('ready')
  }

  function tryAnother() {
    if (!product || product.images.length < 2) return
    const next = (imageIndex + 1) % product.images.length
    setImageIndex(next)
    setAttempt(attempt + 1)
    void cut(product.images[next], attempt + 1)
  }

  function tryAgain() {
    if (!product) return
    setAttempt(attempt + 1)
    void cut(product.images[imageIndex], attempt + 1)
  }

  async function paste() {
    try {
      const value = await navigator.clipboard.readText()
      if (!value.trim()) return
      setText(value.trim())
      setPasted(true)
      void submit(value)
    } catch {
      // Clipboard blocked: the field still takes a normal paste.
    }
  }

  async function addTag() {
    if (newTag === null) return
    const result = await onCreateCategory(newTag)
    if (typeof result === 'string') {
      setTagError(result)
      return
    }
    setTag(result.id)
    setNewTag(null)
    setTagError(null)
  }

  async function print() {
    const name = title.trim()
    if (!name || saving) return
    setSaving(true)
    const now = Date.now()
    const item: GuestItem = {
      id: itemId,
      title: name.slice(0, 200),
      brand: brand.trim().slice(0, 120),
      notes: note.trim(),
      sourceUrl:
        product?.url ??
        (looksLikeLink(text) ? (normaliseLink(text) ?? '') : ''),
      categoryId: tag,
      status: 'unresolved',
      image: printed?.kind === 'upload' ? printed.blob : null,
      imageType: printed?.kind === 'upload' ? printed.blob.type : null,
      imageUrl: printed && printed.kind !== 'upload' ? printed.url : null,
      position: null,
      purchasedAt: null,
      price: product?.price ?? null,
      createdAt: now,
      updatedAt: now,
    }
    try {
      if ('vibrate' in navigator) navigator.vibrate(8)
      await onPrint(item)
    } catch {
      setSaving(false)
      setError("Couldn't save. Try again")
    }
  }

  const price = formatPrice(product?.price ?? null)
  const preview = printed
    ? {
        id: itemId,
        title,
        imageUrl: printed.kind === 'upload' ? null : printed.url,
        image: printed.kind === 'upload' ? printed.blob : null,
      }
    : null
  const die = printed?.kind === 'die'
  const canPrint =
    title.trim().length > 0 && phase !== 'cutting' && phase !== 'reading'

  return (
    <div className="nt-print">
      <div className="nt-tb">
        <button
          type="button"
          className="nt-ib"
          aria-label="Close"
          onClick={onClose}
        >
          <XIcon aria-hidden="true" />
        </button>
        <div className="nt-ttl">
          <b>Print a sticker</b>
          <small>From a link</small>
        </div>
        <span style={{ width: 44 }} aria-hidden="true" />
      </div>

      <form
        className="nt-fld"
        data-error={phase === 'error' && !manual ? 'true' : undefined}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <LinkIcon aria-hidden="true" />
        <input
          aria-label="Shop link or product name"
          placeholder="Paste a link or type a name"
          // r2 #31: the formatted link once parsed; the raw URL while editing.
          value={
            phase === 'ready' && !fieldFocused && looksLikeLink(text)
              ? linkChip(text.trim())
              : text
          }
          onFocus={() => setFieldFocused(true)}
          onBlur={() => setFieldFocused(false)}
          inputMode="url"
          enterKeyHint="go"
          autoFocus={!initial}
          onChange={(event) => {
            setText(event.target.value)
            setPasted(false)
          }}
        />
        {/* r2 #27: the Paste pill hides once the field has a value. */}
        {canPaste && !text ? (
          <button type="button" onClick={() => void paste()}>
            <ClipboardTextIcon aria-hidden="true" />
            {pasted ? 'Pasted' : 'Paste'}
          </button>
        ) : null}
      </form>

      {error ? (
        <p className="nt-err" role="alert">
          <WarningCircleIcon aria-hidden="true" /> {error}
          {phase === 'error' && !manual ? (
            <>
              {' '}
              <button type="button" onClick={() => setManual(true)}>
                Add it by hand
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {phase === 'results' ? (
        <div className="nt-results">
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              className="nt-result"
              onClick={() =>
                choose({
                  url: result.url ?? '',
                  title: result.title,
                  brand: '',
                  images: result.imageUrl ? [result.imageUrl] : [],
                  price: null,
                })
              }
            >
              {result.imageUrl ? (
                <img
                  src={result.imageUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <i aria-hidden="true" />
              )}
              <span>
                <b>{result.title}</b>
                <small>{result.source}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {phase === 'reading' ||
      phase === 'cutting' ||
      (phase === 'ready' && preview) ? (
        <div className="nt-mat" aria-busy={phase !== 'ready'}>
          {phase === 'ready' && preview ? (
            <>
              <span className="nt-kicker">
                {die
                  ? 'Preview · cut from the shop photo'
                  : 'Preview · photo sticker'}
              </span>
              <div className="nt-mat-art">
                <StickerArt item={preview} rotate={-4} />
                {price ? (
                  <PriceDot
                    label={price}
                    fill={die ? 'red' : 'yellow'}
                    size={64}
                    rotate={10}
                    style={{ position: 'absolute', right: -14, top: -18 }}
                  />
                ) : null}
              </div>
              {die ? (
                <>
                  <span className="nt-mat-chip" data-tone="ink">
                    <ScissorsIcon weight="bold" aria-hidden="true" />
                    Background removed
                  </span>
                  {product && product.images.length > 1 ? (
                    <button
                      type="button"
                      className="nt-mat-chip"
                      data-tone="paper"
                      onClick={tryAnother}
                    >
                      <ArrowsClockwiseIcon weight="bold" aria-hidden="true" />
                      Try another
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="nt-mat-chip" data-tone="ink">
                    <ImageSquareIcon weight="bold" aria-hidden="true" />
                    Kept the photo
                  </span>
                  {product && product.images.length > 0 ? (
                    <button
                      type="button"
                      className="nt-mat-chip"
                      data-tone="paper"
                      onClick={tryAgain}
                    >
                      <ScissorsIcon weight="bold" aria-hidden="true" />
                      Try cutting again
                    </button>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <div className="nt-cutting" role="status">
              <ScissorsIcon aria-hidden="true" />
              {phase === 'reading' ? 'Reading the link…' : 'Cutting it out…'}
            </div>
          )}
        </div>
      ) : null}

      {phase === 'ready' && printed && !die ? (
        <p className="nt-info">
          <InfoIcon aria-hidden="true" />
          This photo has a busy background, so it prints as a photo sticker.
          Upload a plainer shot to get a cut-out.
        </p>
      ) : null}

      {manual || (phase === 'ready' && !printed) ? (
        <div className="nt-manual">
          <input
            className="nt-input"
            aria-label="Title"
            placeholder="Title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <input
            className="nt-input"
            aria-label="Brand"
            placeholder="Brand"
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
          />
          <label className="nt-pill" data-tone="white">
            <UploadSimpleIcon aria-hidden="true" />
            Upload a photo
            <input
              type="file"
              accept="image/*"
              className="nt-sr"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void upload(file)
              }}
            />
          </label>
        </div>
      ) : null}

      {phase === 'ready' && printed && !manual ? (
        <div className="nt-ptitle">
          {editing ? (
            <input
              aria-label="Title"
              value={title}
              autoFocus
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setEditing(false)
              }}
            />
          ) : (
            // r2 #28: pencil 16 after the title; the meta stays clean.
            <h2>
              {title}
              <button
                type="button"
                className="nt-ptitle-edit"
                aria-label="Edit title"
                onClick={() => setEditing(true)}
              >
                <PencilSimpleIcon aria-hidden="true" />
              </button>
            </h2>
          )}
          <p className="nt-pmeta">
            {[brand, price].filter(Boolean).join(' · ')}
          </p>
        </div>
      ) : null}

      {phase === 'ready' || manual ? (
        <>
          <span className="nt-lbl" id="nt-stick-on">
            Stick it on
          </span>
          <div
            className="nt-tgs"
            role="radiogroup"
            aria-labelledby="nt-stick-on"
          >
            {categories.map((category) => {
              const selected = tag === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  className="nt-tg"
                  data-fill={colors.get(category.id) ?? 'blue'}
                  onClick={() => setTag(category.id)}
                >
                  {selected ? (
                    <CheckIcon weight="bold" aria-hidden="true" />
                  ) : null}
                  {categoryTag(category.name)}
                </button>
              )
            })}
            {newTag === null ? (
              <button
                type="button"
                className="nt-tg"
                data-fill="outline"
                onClick={() => setNewTag('')}
              >
                <PlusIcon aria-hidden="true" />
                New
              </button>
            ) : (
              <form
                className="nt-tg-new"
                onSubmit={(event) => {
                  event.preventDefault()
                  void addTag()
                }}
              >
                #
                <input
                  aria-label="New tag"
                  autoFocus
                  value={newTag}
                  enterKeyHint="done"
                  onChange={(event) => setNewTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setNewTag(null)
                  }}
                />
                <button
                  type="submit"
                  className="nt-ib"
                  aria-label="Add tag"
                  style={{ width: 32, height: 32 }}
                >
                  <CheckIcon weight="bold" aria-hidden="true" />
                </button>
              </form>
            )}
          </div>
          {tagError ? <p className="nt-err">{tagError}</p> : null}
          {noteOpen ? (
            <textarea
              className="nt-textarea"
              aria-label="Note"
              rows={3}
              autoFocus
              placeholder="Size, colour, why"
              value={note}
              style={{ marginTop: 14 }}
              onChange={(event) => setNote(event.target.value)}
            />
          ) : (
            <button
              type="button"
              className="nt-addnote"
              onClick={() => setNoteOpen(true)}
            >
              <NotePencilIcon aria-hidden="true" />
              Add a note: size, colour, why
            </button>
          )}
        </>
      ) : null}

      <div className="nt-dock">
        <button
          type="button"
          className="nt-cta"
          data-tone="yellow"
          disabled={!canPrint || saving}
          onClick={() => void print()}
        >
          <StickerIcon weight="bold" aria-hidden="true" />
          {saving ? 'Printing…' : 'Print sticker'}
        </button>
      </div>
    </div>
  )
}
