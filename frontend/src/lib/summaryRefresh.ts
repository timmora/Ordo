import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

/**
 * Force-regenerate the daily briefing in the background.
 * Called from mutation onSuccess hooks so the summary stays reactive.
 */
export async function refreshSummary(qc: QueryClient) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const params = new URLSearchParams({ tz, force: 'true' })
    const res = await fetch(`${BACKEND_URL}/api/overview-summary?${params}`, {
      method: 'POST',
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
    // Silently fail — summary will refresh on next page load
  }
}
