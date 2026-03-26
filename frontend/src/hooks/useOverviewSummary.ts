import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useRef } from 'react'
import { backendFetch } from '@/lib/backendFetch'

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
  return backendFetch<OverviewSummary>('/api/overview-summary', {
    method: 'POST',
    params: { force: String(force) },
  })
}

export function useOverviewSummary() {
  const qc = useQueryClient()
  const forceRef = useRef(false)

  const query = useQuery<OverviewSummary>({
    queryKey: ['overview-summary'],
    queryFn: () => {
      const force = forceRef.current
      forceRef.current = false
      return fetchSummary(force)
    },
    staleTime: Infinity,
    retry: 1,
  })

  /** Force-regenerate the summary (calls Claude again) */
  const regenerateSummary = useCallback(async () => {
    forceRef.current = true
    await qc.invalidateQueries({ queryKey: ['overview-summary'] })
  }, [qc])

  return { ...query, regenerateSummary }
}
