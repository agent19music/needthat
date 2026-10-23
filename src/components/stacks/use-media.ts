import { useEffect, useState } from 'react'

/** SSR-safe matchMedia hook; false until mounted. */
export function useMedia(query: string) {
  const [matches, setMatches] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return
    const list = window.matchMedia(query)
    setMatches(list.matches)
    const onChange = () => setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])
  return matches
}

export const MOBILE_QUERY = '(max-width: 767px)'
