import { useCallback, useEffect, useState } from 'react'

/**
 * Local draft for a text input whose committed value lives elsewhere (usually
 * the URL). Typing updates the draft immediately; `onCommit` runs once the user
 * pauses for `delayMs`. External changes to `committed` (Back, "clear all")
 * replace the draft unless they are the echo of our own commit. `cancel`
 * drops a pending draft before an external reset, so the timer cannot write
 * it back afterwards.
 */
export function useDebouncedInput(
  committed: string,
  onCommit: (value: string) => void,
  delayMs = 300,
) {
  const [draft, setDraft] = useState(committed)
  const [lastCommitted, setLastCommitted] = useState(committed)
  const [lastPushed, setLastPushed] = useState<string | null>(null)

  if (committed !== lastCommitted) {
    setLastCommitted(committed)
    if (committed !== lastPushed) setDraft(committed)
  }

  useEffect(() => {
    if (draft === committed) return
    const timer = setTimeout(() => {
      setLastPushed(draft)
      onCommit(draft)
    }, delayMs)
    return () => clearTimeout(timer)
  }, [draft, committed, onCommit, delayMs])

  const cancel = useCallback(() => {
    setDraft(committed)
    setLastPushed(null)
  }, [committed])

  return [draft, setDraft, cancel] as const
}
