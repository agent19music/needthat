import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { categories, wishesIn } from './data'
import type { Category, Wish } from './data'

function Shell({
  category,
  onCategory,
  children,
  hint,
}: {
  category: Category
  onCategory: (category: Category) => void
  children: ReactNode
  hint: string
}) {
  return (
    <div className="proto-wrap proto-enter">
      <p className="proto-kicker">List</p>
      <h1 className="proto-title">#needthat</h1>
      <div className="proto-chips" role="tablist" aria-label="Categories">
        {categories.map((name) => (
          <button
            key={name}
            type="button"
            className="proto-chip"
            role="tab"
            aria-selected={category === name}
            aria-current={category === name ? 'true' : undefined}
            onClick={() => onCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>
      {children}
      <p className="crate-hint">{hint}</p>
    </div>
  )
}

function useCategory() {
  const [category, setCategory] = useState<Category>('All')
  const items = wishesIn(category)
  return { category, setCategory, items }
}

export function Crate() {
  const { category, setCategory, items } = useCategory()

  return (
    <Shell
      category={category}
      onCategory={setCategory}
      hint="Swipe sideways. The next want peeks in from the edge."
    >
      {items.length === 0 ? (
        <p className="proto-empty">Nothing in {category} yet.</p>
      ) : (
        <div className="crate-viewport">
          <div className="crate-track">
            {items.map((wish) => (
              <article key={wish.id} className="crate-card">
                <img className="proto-photo" src={wish.image} alt="" />
                <div className="crate-copy">
                  <h2 className="clamp-2 proto-title">{wish.title}</h2>
                  <p className="proto-meta">
                    {wish.source} · {wish.price}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}

export function Ledger() {
  const { category, setCategory, items } = useCategory()
  const [bought, setBought] = useState<Record<string, boolean>>({})
  const [removed, setRemoved] = useState<Record<string, boolean>>({})
  const visible = items.filter((wish) => !removed[wish.id])

  return (
    <Shell
      category={category}
      onCategory={setCategory}
      hint="Swipe a row left for purchased or remove."
    >
      {visible.length === 0 ? (
        <p className="proto-empty">Nothing in {category} yet.</p>
      ) : (
        <ul className="ledger">
          {visible.map((wish) => (
            <LedgerRow
              key={wish.id}
              wish={wish}
              bought={Boolean(bought[wish.id])}
              onBuy={() => setBought((current) => ({ ...current, [wish.id]: !current[wish.id] }))}
              onRemove={() => setRemoved((current) => ({ ...current, [wish.id]: true }))}
            />
          ))}
        </ul>
      )}
    </Shell>
  )
}

function LedgerRow({
  wish,
  bought,
  onBuy,
  onRemove,
}: {
  wish: Wish
  bought: boolean
  onBuy: () => void
  onRemove: () => void
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [open, setOpen] = useState(false)
  const start = useRef(0)
  const offsetRef = useRef(0)
  const draggingRef = useRef(false)

  function move(next: number) {
    offsetRef.current = next
    setOffset(next)
  }

  return (
    <li className="ledger-row">
      <div className="ledger-actions">
        <button type="button" onClick={onBuy}>
          {bought ? 'Wanted' : 'Purchased'}
        </button>
        <button type="button" onClick={onRemove}>
          Remove
        </button>
      </div>
      <div
        className="ledger-face"
        data-dragging={dragging || undefined}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          start.current = event.clientX - offsetRef.current
          draggingRef.current = true
          setDragging(true)
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            // A synthetic pointer has no capture target. Touch and mouse still drag.
          }
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return
          move(Math.min(0, Math.max(-148, event.clientX - start.current)))
        }}
        onPointerUp={() => {
          const revealed = offsetRef.current < -56
          setOpen(revealed)
          move(revealed ? -148 : 0)
          draggingRef.current = false
          setDragging(false)
        }}
        onPointerCancel={() => {
          move(open ? -148 : 0)
          draggingRef.current = false
          setDragging(false)
        }}
      >
        <span className="ledger-photo">
          <img className="proto-photo" src={wish.image} alt="" />
        </span>
        <span>
          <span className="clamp-1" style={{ fontWeight: 500 }}>
            {wish.title}
          </span>
          <span className="ledger-source">
            {wish.source}
            {bought ? ' · Purchased' : ''}
          </span>
        </span>
      </div>
    </li>
  )
}

export function Spotlight() {
  const { category, setCategory, items } = useCategory()
  const listRef = useRef<HTMLUListElement>(null)
  const [near, setNear] = useState(0)

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const update = () => {
      const rows = [...list.querySelectorAll<HTMLElement>('[data-spot]')]
      const mid = window.innerHeight / 2
      let closest = 0
      let best = Number.POSITIVE_INFINITY
      rows.forEach((row, index) => {
        const box = row.getBoundingClientRect()
        const distance = Math.abs(box.top + box.height / 2 - mid)
        if (distance < best) {
          best = distance
          closest = index
        }
      })
      setNear(closest)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [items])

  return (
    <Shell
      category={category}
      onCategory={(next) => {
        setCategory(next)
        setNear(0)
      }}
      hint="Scroll. The want nearest the middle comes forward."
    >
      {items.length === 0 ? (
        <p className="proto-empty">Nothing in {category} yet.</p>
      ) : (
        <ul ref={listRef} className="spot-list">
          {items.map((wish, index) => (
            <li key={wish.id} data-spot className="spot-row" data-near={index === near}>
              <span className="spot-photo">
                <img className="proto-photo" src={wish.image} alt="" />
              </span>
              <span>
                <span className={index === near ? 'clamp-2' : 'clamp-1'} style={{ fontWeight: 500 }}>
                  {wish.title}
                </span>
                <span className="proto-meta">
                  {wish.category} · {wish.price}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}
