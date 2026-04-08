import type { QueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useScheduleStore } from '@/store/scheduleStore'
import { BACKEND_URL } from '@/lib/backendFetch'

let debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Debounced background rescheduling.
 * Called from mutation onSuccess hooks so the schedule stays reactive.
 */
export function refreshSchedule(qc: QueryClient) {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const params = new URLSearchParams({ tz, force: 'false' })
      const res = await fetch(`${BACKEND_URL}/api/schedule?${params}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (res.ok) {
        const data = await res.json()
        qc.invalidateQueries({ queryKey: ['subtasks', '_all'] })
        qc.invalidateQueries({ queryKey: ['overview-summary'] })
        if (data.changes?.length > 0) {
          useScheduleStore.getState().setPendingChanges(data.changes)
        }
      }
    } catch {
      // Silently fail
    }
  }, 500)
}
