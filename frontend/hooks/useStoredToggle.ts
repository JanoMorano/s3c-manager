import { useCallback, useEffect, useState } from 'react'

/**
 * Boolean UI preference remembered per browser (e.g. a collapsed filter rail).
 * Starts from `initial` on the server and first render, then reads storage,
 * so hydration stays consistent. Storage failures fall back to memory.
 */
export function useStoredToggle(storageKey: string, initial = false) {
  const [value, setValue] = useState(initial)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage after hydration
      if (stored === '1' || stored === '0') setValue(stored === '1')
    } catch { /* storage unavailable */ }
  }, [storageKey])

  const toggle = useCallback(() => {
    setValue((current) => {
      const next = !current
      try { window.localStorage.setItem(storageKey, next ? '1' : '0') } catch { /* storage unavailable */ }
      return next
    })
  }, [storageKey])

  return [value, toggle] as const
}
