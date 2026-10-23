import { useEffect, useState } from 'react'

const fineHoverQuery = '(hover: hover) and (pointer: fine)'

/** True when the primary pointer can hover precisely. JS hover gestures have no CSS gate. */
export function useFineHover() {
  const [fine, setFine] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(fineHoverQuery)
    const apply = () => setFine(query.matches)
    apply()
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [])

  return fine
}
