import { useRef, useState } from 'react'

import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { ProductCandidate } from '#/lib/discovery/candidates'
import { searchProducts } from '#/lib/discovery/search-products'

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
  const requestId = useRef(0)

  async function search() {
    const query = value.trim()
    if (query.length < 2) {
      setSearchError('Describe the item in a few words, then press Enter.')
      setOpen(false)
      return
    }

    const idForRequest = requestId.current + 1
    requestId.current = idForRequest
    setSearching(true)
    setSearchError(null)
    setOpen(true)

    try {
      const result = await searchProducts({ data: { query } })
      if (requestId.current !== idForRequest) return
      if (!result.ok) {
        setSearchError(result.message)
        return
      }
      setCandidates(result.candidates)
      setNote(result.note)
      if (result.candidates.length === 0) {
        setSearchError('No matches. You can still save the description as typed.')
      }
    } catch {
      if (requestId.current !== idForRequest) return
      setSearchError('Search failed. Your description is still here.')
    } finally {
      if (requestId.current === idForRequest) setSearching(false)
    }
  }

  const showList = open && (searching || candidates.length > 0 || note || searchError)

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Describe it</Label>
      <div className="relative">
      <Input
        id={id}
        name={id}
        value={value}
        aria-invalid={Boolean(error)}
        aria-expanded={open}
        aria-controls={`${id}-matches`}
        aria-autocomplete="list"
        placeholder="White Nike Shox"
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
        <div
          id={`${id}-matches`}
          className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-md bg-white shadow-[0_8px_24px_oklch(0_0_0/0.12),inset_0_0_0_1px_oklch(0_0_0/0.08)]"
        >
          {note ? (
            <p className="px-3 py-2 text-xs leading-4 text-[#5c5a55]">{note}</p>
          ) : null}
          {searching ? (
            <p className="px-3 py-3 text-sm text-[#5c5a55]">Looking…</p>
          ) : null}
          {searchError ? (
            <p role="alert" className="px-3 py-3 text-sm text-[#8a2f2f]">
              {searchError}
            </p>
          ) : null}
          {candidates.length > 0 ? (
            <ul role="listbox" aria-label="Discovered matches" className="grid">
              {candidates.map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-[#f6f5f2]"
                    onClick={() => {
                      onSelect(candidate)
                      setOpen(false)
                    }}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[#f6f5f2] shadow-[inset_0_0_0_1px_oklch(0_0_0/0.1)]">
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
                      <span className="block truncate text-sm text-[#1c1c1a]">
                        {candidate.title}
                      </span>
                      <span className="block truncate text-xs text-[#5c5a55]">
                        {candidate.source}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      </div>
      <p className="text-xs leading-4 text-[#5c5a55]">
        Press Enter for discovered matches.
      </p>
      {error ? <p className="text-sm text-[#8a2f2f]">{error}</p> : null}
    </div>
  )
}
