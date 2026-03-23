import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

export interface OverviewSummary {
  summary: string
  stats: {
    focus_hours: number
    tasks_completed: number
    tasks_total: number
  }
  tip: string
}

async function fetchSummary(force: boolean): Promise<OverviewSummary> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const params = new URLSearchParams({ tz, force: String(force) })
  const res = await fetch(`${BACKEND_URL}/api/overview-summary?${params}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Failed to load summary')
  }

  return res.json()
}

export function useOverviewSummary() {
  const qc = useQueryClient()

  const query = useQuery<OverviewSummary>({
    queryKey: ['overview-summary'],
    queryFn: () => fetchSummary(false),
    staleTime: Infinity, // never auto-refetch; only manual invalidation
    retry: 1,
  })

  /** Force-regenerate the summary (calls Claude again) */
  const regenerateSummary = useCallback(async () => {
    const data = await fetchSummary(true)
    qc.setQueryData(['overview-summary'], data)
  }, [qc])

  return { ...query, regenerateSummary }
}
