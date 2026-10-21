import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { Album, Peel, Sorter } from './variants'

import './picker.css'
import './stamps.css'

const variants = [
  { name: 'Album', render: Album },
  { name: 'Peel', render: Peel },
  { name: 'Sorter', render: Sorter },
] as const

export function StampPrototype() {
  const [index, setIndex] = useState(0)
  const [mount, setMount] = useState(0)
  const [ready, setReady] = useState(false)
  const pickerRef = useRef<HTMLElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const fromUrl = Number(new URLSearchParams(window.location.search).get('v'))
    if (fromUrl >= 1 && fromUrl <= variants.length) setIndex(fromUrl - 1)
  }, [])

  useLayoutEffect(() => {
    const picker = pickerRef.current
    const highlight = highlightRef.current
    if (!picker || !highlight) return
    function move() {
      const buttons = [
        ...picker!.querySelectorAll<HTMLButtonElement>(
          '.proto-picker-item:not(.proto-picker-replay)',
        ),
      ]
      const button = buttons[index]
      if (!button) return
      highlight!.style.width = `${button.offsetWidth}px`
      highlight!.style.transform = `translateX(${button.offsetLeft}px)`
    }
    move()
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [index, ready])

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setReady(true))
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const number = Number.parseInt(event.key, 10)
      if (number >= 1 && number <= variants.length) choose(number - 1)
      else if (event.key === 'ArrowRight') choose((index + 1) % variants.length)
      else if (event.key === 'ArrowLeft') choose((index - 1 + variants.length) % variants.length)
      else if (event.key === 'r' || event.key === 'R') setMount((current) => current + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index])

  function choose(next: number) {
    if (next < 0 || next >= variants.length) return
    setIndex(next)
    setMount((current) => current + 1)
    const url = new URL(window.location.href)
    url.searchParams.set('v', String(next + 1))
    window.history.replaceState(null, '', url)
  }

  const Active = variants[index].render

  return (
    <div className="proto-stage">
      <div key={`${index}:${mount}`}>
        <Active />
      </div>
      <nav
        ref={pickerRef}
        className="proto-picker"
        aria-label="Prototype variants"
        data-ready={ready || undefined}
      >
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {variants.map((variant, variantIndex) => (
          <button
            key={variant.name}
            type="button"
            className="proto-picker-item"
            data-active={variantIndex === index || undefined}
            aria-current={variantIndex === index ? 'true' : undefined}
            onClick={() => choose(variantIndex)}
          >
            {variant.name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          type="button"
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={() => setMount((current) => current + 1)}
        >
          ↻
        </button>
      </nav>
    </div>
  )
}
