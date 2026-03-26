import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { BACKEND_URL } from '@/lib/backendFetch'

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let abortController: AbortController | null = null

/**
 * Debounced, deduplicated background summary regeneration.
 * Called from mutation hooks so the daily briefing stays reactive.
 *
 * - Debounced at 3s so rapid checkbox toggles produce a single AI call
 * - Aborts any in-flight request before starting a new one (no race conditions)
 */
export function refreshSummary(qc: QueryClient) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    // Abort previous in-flight request
    if (abortController) abortController.abort()
    abortController = new AbortController()

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const params = new URLSearchParams({ tz, force: 'true' })
      const res = await fetch(`${BACKEND_URL}/api/overview-summary?${params}`, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        const data = await res.json()
        qc.setQueryData(['overview-summary'], data)
      }
    } catch {
      // Silently fail — aborted requests and network errors are fine
    }
  }, 3000)
}
