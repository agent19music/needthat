import { useEffect, useId, useRef, useState } from 'react'
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import { Minus, Plus } from 'lucide-react'

import { Alert } from '#/components/arc/alert/alert'
import { Avatar } from '#/components/arc/avatar/avatar'
import { Button } from '#/components/arc/button/button'
import {
  Dialog,
  DialogContent,
} from '#/components/arc/dialog/dialog'
import {
  CROP_CIRCLE,
  CROP_ZOOM_MAX,
  CROP_ZOOM_MIN,
  cropLayout,
  isImageFile,
  panForZoom,
  preparePhoto,
  renderAvatar,
} from '#/lib/avatar-image'
import type { PreparedPhoto } from '#/lib/avatar-image'
import styles from './profile-photo.module.css'

type Frame = {
  zoom: number
  panX: number
  panY: number
}

const restFrame: Frame = { zoom: 1, panX: 0, panY: 0 }

export function ProfilePhoto({
  name,
  src,
  onUpload,
}: {
  name: string
  src?: string
  onUpload: (image: Blob) => Promise<void>
}) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const draftRef = useRef<PreparedPhoto | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<number | null>(null)
  const [draft, setDraft] = useState<PreparedPhoto | null>(null)
  const [frame, setFrame] = useState<Frame>(restFrame)
  const [dropping, setDropping] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function replaceDraft(next: PreparedPhoto | null) {
    draftRef.current?.revoke()
    draftRef.current = next
    setDraft(next)
  }

  useEffect(() => {
    return () => {
      draftRef.current?.revoke()
    }
  }, [])

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return
      }
      const file = [...(event.clipboardData?.files ?? [])].find((item) =>
        isImageFile(item),
      )
      if (!file) return
      event.preventDefault()
      void openFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  useEffect(() => {
    const node = stageRef.current
    if (!node || !draft) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const image = imageRef.current
      if (!image?.naturalWidth || !image.naturalHeight) return
      const rect = node.getBoundingClientRect()
      const unit = event.deltaMode === 1 ? 16 : 1
      const delta = event.deltaY * unit
      const factor = event.ctrlKey ? 0.012 : 0.0016
      setFrame((current) => ({
        ...current,
        ...panForZoom(
          image.naturalWidth,
          image.naturalHeight,
          current.zoom,
          current.panX,
          current.panY,
          current.zoom * Math.exp(-delta * factor),
          ((event.clientX - rect.left) / rect.width) * 100,
          ((event.clientY - rect.top) / rect.height) * 100,
        ),
      }))
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [draft])

  async function openFile(file: File) {
    setError(null)
    setNotice(null)
    setPreparing(true)
    setReady(false)
    try {
      const next = await preparePhoto(file)
      replaceDraft(next)
      setFrame(restFrame)
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setPreparing(false)
    }
  }

  function closeCrop() {
    if (saving) return
    replaceDraft(null)
    setReady(false)
    setFrame(restFrame)
    pointers.current.clear()
    pinch.current = null
  }

  async function saveCrop() {
    const image = imageRef.current
    if (!image || !ready || saving) return
    setSaving(true)
    setError(null)
    try {
      const blob = await renderAvatar(
        image,
        frame.zoom,
        frame.panX,
        frame.panY,
      )
      await onUpload(blob)
      replaceDraft(null)
      setReady(false)
      setNotice('Photo updated.')
    } catch (caught) {
      setError(messageFrom(caught))
    } finally {
      setSaving(false)
    }
  }

  function onFiles(list: FileList | null) {
    const file = list?.[0]
    if (file) void openFile(file)
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDropping(false)
    onFiles(event.dataTransfer.files)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    pinch.current = null
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    const image = imageRef.current
    const stage = stageRef.current
    if (!image || !stage) return
    if (pointers.current.size >= 2) {
      const [first, second] = [...pointers.current.values()]
      const distance = Math.hypot(first.x - second.x, first.y - second.y)
      const last = pinch.current
      pinch.current = distance
      if (!last) return
      const rect = stage.getBoundingClientRect()
      setFrame((current) => ({
        ...current,
        ...panForZoom(
          image.naturalWidth,
          image.naturalHeight,
          current.zoom,
          current.panX,
          current.panY,
          current.zoom * (distance / last),
          (((first.x + second.x) / 2 - rect.left) / rect.width) * 100,
          (((first.y + second.y) / 2 - rect.top) / rect.height) * 100,
        ),
      }))
      return
    }
    const rect = stage.getBoundingClientRect()
    setFrame((current) => ({
      ...current,
      panX: current.panX + ((event.clientX - previous.x) / rect.width) * 100,
      panY: current.panY + ((event.clientY - previous.y) / rect.height) * 100,
    }))
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    pinch.current = null
  }

  function zoomAroundCenter(nextZoom: number) {
    const image = imageRef.current
    if (!image?.naturalWidth || !image.naturalHeight) return
    setFrame((current) => ({
      ...current,
      ...panForZoom(
        image.naturalWidth,
        image.naturalHeight,
        current.zoom,
        current.panX,
        current.panY,
        nextZoom,
        50,
        50,
      ),
    }))
  }

  const layout = draft
    ? cropLayout(draft.width, draft.height, frame.zoom, frame.panX, frame.panY)
    : null
  const zoomLabel = `${Math.round(frame.zoom * 100)}%`

  return (
    <div
      className={styles.photo}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes('Files')) return
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={onDrop}
    >
      <button
        type="button"
        className={styles.avatarButton}
        data-dropping={dropping ? 'true' : undefined}
        aria-label={src ? 'Change profile photo' : 'Upload profile photo'}
        onClick={() => inputRef.current?.click()}
      >
        <Avatar aria-hidden="true" name={name} src={src} size="xl" />
      </button>
      <div className={styles.copy}>
        <p className={styles.label}>Profile photo</p>
        <p className={styles.note}>
          Drop, paste, or choose a photo. Large photos are reduced here before
          they upload.
        </p>
        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={preparing}
            onClick={() => inputRef.current?.click()}
          >
            {src ? 'Replace photo' : 'Upload photo'}
          </Button>
        </div>
        {error && !draft ? (
          <Alert tone="danger" title="Photo not added">
            {error}
          </Alert>
        ) : null}
        <p className={styles.status} role="status">
          {notice}
        </p>
      </div>
      <input
        id={inputId}
        ref={inputRef}
        className={styles.file}
        type="file"
        accept="image/*,.heic,.heif"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          onFiles(event.target.files)
          event.target.value = ''
        }}
      />
      {draft ? (
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) closeCrop()
        }}
      >
        <DialogContent
          title="Adjust photo"
          description="Drag to reposition. Scroll or pinch to zoom."
        >
          {draft ? (
            <div className={styles.crop}>
              <div
                ref={stageRef}
                className={styles.stage}
                role="group"
                tabIndex={0}
                aria-label={`Crop photo, zoom ${zoomLabel}. Arrow keys move it. Plus and minus zoom. Zero resets. Enter saves.`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={(event) => {
                  const step = (event.shiftKey ? 0.1 : 0.02) * 100 * CROP_CIRCLE
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    setFrame((current) => ({ ...current, panX: current.panX - step }))
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    setFrame((current) => ({ ...current, panX: current.panX + step }))
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault()
                    setFrame((current) => ({ ...current, panY: current.panY - step }))
                  } else if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    setFrame((current) => ({ ...current, panY: current.panY + step }))
                  } else if (event.key === '+' || event.key === '=') {
                    event.preventDefault()
                    zoomAroundCenter(frame.zoom * 1.08)
                  } else if (event.key === '-' || event.key === '_') {
                    event.preventDefault()
                    zoomAroundCenter(frame.zoom / 1.08)
                  } else if (event.key === '0') {
                    event.preventDefault()
                    setFrame((current) => ({ ...current, zoom: 1, panX: 0, panY: 0 }))
                  } else if (event.key === 'Enter') {
                    event.preventDefault()
                    void saveCrop()
                  }
                }}
              >
                <img
                  ref={imageRef}
                  className={styles.image}
                  src={draft.url}
                  alt=""
                  draggable={false}
                  style={
                    layout
                      ? {
                          width: `${layout.width}%`,
                          height: `${layout.height}%`,
                          left: `${layout.left}%`,
                          top: `${layout.top}%`,
                        }
                      : undefined
                  }
                  onLoad={() => setReady(true)}
                />
                <div
                  className={styles.mask}
                  style={{
                    width: `${CROP_CIRCLE * 100}%`,
                    height: `${CROP_CIRCLE * 100}%`,
                  }}
                />
              </div>
              <div className={styles.zoom}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Zoom out"
                  onClick={() => zoomAroundCenter(frame.zoom / 1.08)}
                >
                  <Minus size={16} />
                </Button>
                <input
                  className={styles.range}
                  type="range"
                  min={CROP_ZOOM_MIN}
                  max={CROP_ZOOM_MAX}
                  step={0.01}
                  value={frame.zoom}
                  aria-valuetext={zoomLabel}
                  aria-label="Zoom"
                  onChange={(event) => zoomAroundCenter(Number(event.target.value))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Zoom in"
                  onClick={() => zoomAroundCenter(frame.zoom * 1.08)}
                >
                  <Plus size={16} />
                </Button>
              </div>
              {error ? (
                <Alert tone="danger" title="Photo not saved">
                  {error}
                </Alert>
              ) : null}
              <div className={styles.actions}>
                <Button
                  type="button"
                  loading={saving}
                  disabled={!ready}
                  onClick={() => void saveCrop()}
                >
                  Save photo
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving}
                  onClick={closeCrop}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      ) : null}
    </div>
  )
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'The photo could not be saved.'
}
