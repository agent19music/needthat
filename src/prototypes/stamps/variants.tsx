import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

import { categories, clipWords, swatchFor, wishesIn } from './data'
import type { Category, Wish } from './data'
import { Stamp } from './stamp'

function useCategory() {
  const [category, setCategory] = useState<Category>('All')
  return { category, setCategory, items: wishesIn(category) }
}

function Header({ hint }: { hint: string }) {
  return (
    <header className="stamp-head">
      <p className="stamp-kicker">List</p>
      <h1>#needthat</h1>
      <p className="stamp-hint">{hint}</p>
    </header>
  )
}

function CategoryNav({
  category,
  counts,
  onCategory,
}: {
  category: Category
  counts: Record<Category, number>
  onCategory: (category: Category) => void
}) {
  return (
    <nav className="stamp-nav" aria-label="Categories">
      <p>Categories</p>
      {categories.map((name) => (
        <button
          key={name}
          type="button"
          aria-current={category === name ? 'true' : undefined}
          onClick={() => onCategory(name)}
        >
          <span>{name}</span>
          <span className="stamp-count">{counts[name]}</span>
        </button>
      ))}
    </nav>
  )
}

function Shell({
  category,
  counts,
  onCategory,
  hint,
  children,
}: {
  category: Category
  counts: Record<Category, number>
  onCategory: (category: Category) => void
  hint: string
  children: ReactNode
}) {
  return (
    <div className="stamp-shell proto-enter">
      <CategoryNav category={category} counts={counts} onCategory={onCategory} />
      <div className="stamp-main">
        <Header hint={hint} />
        {children}
      </div>
    </div>
  )
}

function countsFrom(hidden: Record<string, boolean> = {}) {
  return Object.fromEntries(
    categories.map((name) => [
      name,
      wishesIn(name).filter((wish) => !hidden[wish.id]).length,
    ]),
  ) as Record<Category, number>
}

export function Album() {
  const { category, setCategory, items } = useCategory()
  const [bought, setBought] = useState<Record<string, boolean>>({})

  return (
    <Shell
      category={category}
      counts={countsFrom()}
      onCategory={setCategory}
      hint="Tap a row when you’ve got it. The stamp sits flat."
    >
      {items.length === 0 ? (
        <p className="stamp-empty">Nothing in {category} yet.</p>
      ) : (
        <ul className="stamp-list">
          {items.map((wish, index) => {
            const owned = Boolean(bought[wish.id])
            const title = clipWords(wish.title)
            return (
              <li key={wish.id}>
                <button
                  type="button"
                  className="album-row"
                  aria-pressed={owned}
                  aria-label={`${wish.title}, ${wish.source}, ${wish.price}${owned ? ', got it' : ''}`}
                  onClick={() =>
                    setBought((current) => ({ ...current, [wish.id]: !current[wish.id] }))
                  }
                >
                  <Stamp
                    src={wish.image}
                    size={76}
                    tilt={index % 2 === 0 ? 'left' : 'right'}
                    flat={owned}
                  />
                  <span className="stamp-copy">
                    <span className="stamp-title" title={title === wish.title ? undefined : wish.title}>
                      {title}
                    </span>
                    <span className="stamp-meta">
                      {owned ? <span className="stamp-got">Got it</span> : null}
                      {wish.source} · {wish.price}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Shell>
  )
}

export function Peel() {
  const { category, setCategory } = useCategory()
  const [bought, setBought] = useState<Record<string, boolean>>({})
  const [dropped, setDropped] = useState<Record<string, boolean>>({})
  const items = wishesIn(category).filter((wish) => !dropped[wish.id])

  return (
    <Shell
      category={category}
      counts={countsFrom(dropped)}
      onCategory={setCategory}
      hint="Drag a stamp right if you’ve got it, left to let it go."
    >
      {items.length === 0 ? (
        <p className="stamp-empty">Nothing in {category} yet.</p>
      ) : (
        <ul className="stamp-list">
          {items.map((wish) => (
            <PeelRow
              key={wish.id}
              wish={wish}
              bought={Boolean(bought[wish.id])}
              onBought={() =>
                setBought((current) => ({ ...current, [wish.id]: !current[wish.id] }))
              }
              onDrop={() => setDropped((current) => ({ ...current, [wish.id]: true }))}
            />
          ))}
        </ul>
      )}
    </Shell>
  )
}

function PeelRow({
  wish,
  bought,
  onBought,
  onDrop,
}: {
  wish: Wish
  bought: boolean
  onBought: () => void
  onDrop: () => void
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const startX = useRef(0)
  const origin = useRef(0)
  const offsetRef = useRef(0)
  const draggingRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)
  const title = clipWords(wish.title)
  const rest = bought || leaving ? 0 : -2
  const lift = Math.min(10, Math.abs(offset) * 0.08)

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  function setDrag(next: number) {
    offsetRef.current = next
    setOffset(next)
  }

  function drop() {
    if (leaving) return
    draggingRef.current = false
    setDragging(false)
    setLeaving(true)
    setDrag(-180)
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    timeoutRef.current = window.setTimeout(() => onDrop(), reduce ? 0 : 210)
  }

  function finish() {
    draggingRef.current = false
    setDragging(false)
    const next = offsetRef.current
    if (next > 84) {
      if (!bought) onBought()
      setDrag(0)
      return
    }
    if (next < -84) {
      drop()
      return
    }
    setDrag(0)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (leaving || event.button !== 0) return
    startX.current = event.clientX
    origin.current = offsetRef.current
    draggingRef.current = true
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is unavailable for this event. The move handlers still run.
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const next = Math.max(-140, Math.min(140, origin.current + event.clientX - startX.current))
    setDrag(next)
  }

  return (
    <li className="peel-row" data-bought={bought || undefined}>
      <div className="peel-slot">
        <span
          className="peel-wash"
          data-side={offset > 16 ? 'got' : offset < -16 ? 'drop' : undefined}
          style={{ opacity: Math.min(1, Math.abs(offset) / 84) }}
        />
        <Stamp ghost size={76} />
        <div
          className="peel-live"
          role="button"
          tabIndex={0}
          data-dragging={dragging || undefined}
          aria-label={`Drag stamp for ${wish.title}. Drag right when you’ve got it, left to drop it.`}
          style={{
            transform: `translate3d(${offset}px, ${-lift}px, 0) rotate(${rest + offset / 14}deg)`,
            opacity: leaving ? 0 : 1,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finish}
          onPointerCancel={() => {
            draggingRef.current = false
            setDragging(false)
            setDrag(0)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onBought()
          }}
        >
          <Stamp src={wish.image} size={76} />
        </div>
      </div>
      <div className="stamp-copy">
        <p className="stamp-title" title={title === wish.title ? undefined : wish.title}>
          {title}
        </p>
        <p className="stamp-meta">
          {bought ? <span className="stamp-got">Got it</span> : null}
          {wish.source} · {wish.price}
        </p>
      </div>
      <div className="peel-actions">
        <button type="button" onClick={onBought}>
          {bought ? 'Want it' : 'Got it'}
        </button>
        <button type="button" onClick={drop}>
          Drop
        </button>
      </div>
    </li>
  )
}

export function Sorter() {
  const { category, setCategory, items } = useCategory()
  const [openId, setOpenId] = useState<string | null>(null)
  const [dir, setDir] = useState(0)
  const [edge, setEdge] = useState<'start' | 'end' | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const locked = useRef(false)
  const swiped = useRef(false)

  function select(next: Category) {
    const nextIndex = categories.indexOf(next)
    const currentIndex = categories.indexOf(category)
    setDir(nextIndex === currentIndex ? 0 : nextIndex > currentIndex ? 1 : -1)
    setOpenId(null)
    setCategory(next)
  }

  function step(delta: number) {
    const index = categories.indexOf(category)
    const next = index + delta
    if (next < 0 || next >= categories.length) {
      setEdge(null)
      window.requestAnimationFrame(() => setEdge(next < 0 ? 'start' : 'end'))
      return
    }
    select(categories[next])
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    start.current = { x: event.clientX, y: event.clientY }
    locked.current = false
    swiped.current = false
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current || locked.current) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
    if (Math.abs(dx) > Math.abs(dy)) {
      locked.current = true
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Pointer capture is unavailable for this event. The swipe still completes on release.
      }
    } else {
      start.current = null
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!start.current) return
    const dx = event.clientX - start.current.x
    const dy = event.clientY - start.current.y
    start.current = null
    locked.current = false
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) return
    swiped.current = true
    step(dx < 0 ? 1 : -1)
  }

  return (
    <div
      className="sorter-wrap proto-enter"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        start.current = null
        locked.current = false
      }}
      onClickCapture={(event) => {
        if (!swiped.current) return
        event.preventDefault()
        event.stopPropagation()
        swiped.current = false
      }}
    >
      <Header hint="Swipe the list to change category. Tap a row to read the long name." />
      <div className="sorter-rail" role="tablist" aria-label="Categories">
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            className="sorter-tab"
            role="tab"
            aria-selected={category === name}
            onClick={() => select(name)}
          >
            <Stamp size={48} fill={swatchFor(name)} flat={category === name} />
            <span>{name}</span>
          </button>
        ))}
      </div>
      <div className="sorter-nudge" data-edge={edge || undefined}>
        <div
          key={category}
          className="sorter-sheet"
          data-dir={dir === 0 ? undefined : String(dir)}
        >
          {items.length === 0 ? (
            <p className="stamp-empty">Nothing in {category} yet.</p>
          ) : (
            <ul className="stamp-list">
              {items.map((wish) => {
                const title = clipWords(wish.title)
                const open = openId === wish.id
                const longer = title !== wish.title
                return (
                  <li key={wish.id}>
                    <button
                      type="button"
                      className="album-row sorter-row"
                      aria-expanded={longer ? open : undefined}
                      aria-label={wish.title}
                      onClick={() => setOpenId(open ? null : wish.id)}
                    >
                      <Stamp src={wish.image} size={104} flat={open} />
                      <span className="stamp-copy">
                        <span className="stamp-title">{open ? wish.title : title}</span>
                        <span className="stamp-meta">
                          {wish.category} · {wish.source} · {wish.price}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
