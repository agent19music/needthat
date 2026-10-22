import { useEffect, useRef, useState } from 'react'

import { Input } from '#/components/arc/input/input'
import { normalizeQuery } from '#/lib/discovery/candidates'
import type { ProductCandidate } from '#/lib/discovery/candidates'
import { searchProducts } from '#/lib/discovery/search-products'

const describeLabels = [
  'What are you buying next?',
  'Once that cheque hits, I need…',
  'The one you keep coming back to',
  'Say the exact thing you want',
]

function SendIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      fill="currentColor"
      viewBox="0 0 256 256"
      aria-hidden="true"
    >
      <path d="M184,104v32a8,8,0,0,1-8,8H99.31l10.35,10.34a8,8,0,0,1-11.32,11.32l-24-24a8,8,0,0,1,0-11.32l24-24a8,8,0,0,1,11.32,11.32L99.31,128H168V104a8,8,0,0,1,16,0Zm48-48V200a16,16,0,0,1-16,16H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56ZM216,200V56H40V200H216Z" />
    </svg>
  )
}

type CachedSearch = {
  candidates: Array<ProductCandidate>
  note: string | null
  error: string | null
}

export function ProductSearch({
  id,
  value,
  error,
  onChange,
  onSelect,
}: {
  id: string
  value: string
  error?: string
  onChange: (value: string) => void
  onSelect: (candidate: ProductCandidate) => void
}) {
  const [candidates, setCandidates] = useState<Array<ProductCandidate>>([])
  const [note, setNote] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeQuery, setActiveQuery] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const [labelIndex, setLabelIndex] = useState(0)
  const requestId = useRef(0)
  const cache = useRef(new Map<string, CachedSearch>())
  const queryKey = normalizeQuery(value)
  const resultsMatch = activeQuery !== null && activeQuery === queryKey
  const holdLabel = focused || value.trim().length > 0

  useEffect(() => {
    if (holdLabel) return
    const timer = window.setInterval(() => {
      setLabelIndex((index) => (index + 1) % describeLabels.length)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [holdLabel])

  function showCached(key: string, entry: CachedSearch) {
    setCandidates(entry.candidates)
    setNote(entry.note)
    setSearchError(entry.error)
    setActiveQuery(key)
    setSearching(false)
    setOpen(true)
  }

  async function search() {
    const query = value.trim()
    if (query.length < 2) {
      setSearchError('Describe the item in a few words, then press Enter.')
      setOpen(false)
      return
    }

    const key = normalizeQuery(query)
    const idForRequest = requestId.current + 1
    requestId.current = idForRequest
    const cached = cache.current.get(key)
    if (cached) {
      showCached(key, cached)
      return
    }

    setCandidates([])
    setNote(null)
    setSearchError(null)
    setActiveQuery(null)
    setSearching(true)
    setOpen(true)

    try {
      const result = await searchProducts({ data: { query } })
      if (requestId.current !== idForRequest) return
      if (!result.ok) {
        setCandidates([])
        setNote(null)
        setSearchError(result.message)
        setActiveQuery(key)
        return
      }
      const entry: CachedSearch = {
        candidates: result.candidates,
        note: result.note,
        error:
          result.candidates.length === 0
            ? 'No matches. You can still save the description as typed.'
            : null,
      }
      cache.current.set(key, entry)
      showCached(key, entry)
    } catch {
      if (requestId.current !== idForRequest) return
      setCandidates([])
      setNote(null)
      setSearchError('Search failed. Your description is still here.')
      setActiveQuery(key)
    } finally {
      if (requestId.current === idForRequest) setSearching(false)
    }
  }

  const showList =
    open &&
    (searching ||
      (resultsMatch && (candidates.length > 0 || note || searchError)))

  return (
    <div className="grid gap-2">
      <div className="relative">
      <Input
        id={id}
        name={id}
        label={describeLabels[labelIndex] ?? describeLabels[0]}
        description={open ? undefined : 'Press Enter for discovered matches.'}
        error={error}
        value={value}
        aria-expanded={showList}
        aria-controls={`${id}-matches`}
        aria-autocomplete="list"
        placeholder="White Nike Shox"
        className="describe-input"
        end={
          <button
            type="button"
            className="describe-send"
            aria-label="Send"
            disabled={searching || value.trim().length < 2}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              void search()
            }}
          >
            <SendIcon />
          </button>
        }
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            void search()
          }
          if (event.key === 'Escape') setOpen(false)
        }}
      />
      {showList ? (
        <div id={`${id}-matches`} className="match-list">
          {searching && !resultsMatch ? (
            <p className="match-status px-3 py-3">Looking…</p>
          ) : null}
          {resultsMatch && searchError ? (
            <p role="alert" className="match-error">
              {searchError}
            </p>
          ) : null}
          {resultsMatch && candidates.length > 0 ? (
            <ul role="listbox" aria-label="Discovered matches" className="grid">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    role="option"
                    className="match-option"
                    onClick={() => {
                      onSelect(candidate)
                      setOpen(false)
                    }}
                  >
                    <span className="match-thumb">
                      {candidate.imageUrl ? (
                        <img
                          src={candidate.imageUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain p-1"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0">
                      <span className="match-title">{candidate.title}</span>
                      <span className="match-source">{candidate.source}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  )
}
