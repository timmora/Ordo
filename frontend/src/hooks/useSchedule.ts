import { useMutation, useQueryClient } from '@tanstack/react-query'
import { backendFetch } from '@/lib/backendFetch'
import type { ScheduleChange } from '@/types/database'
import { useScheduleStore } from '@/store/scheduleStore'

interface ScheduleResult {
  scheduled_count: number
  unschedulable: string[]
  changes: ScheduleChange[]
}

export function useSchedule() {
  const qc = useQueryClient()
  const setPendingChanges = useScheduleStore((s) => s.setPendingChanges)

  return useMutation({
    mutationFn: async ({ force = false }: { force?: boolean } = {}): Promise<ScheduleResult> => {
      return backendFetch<ScheduleResult>('/api/schedule', {
        method: 'POST',
        params: { force: String(force) },
      })
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['subtasks', '_all'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (data.changes.length > 0) {
        setPendingChanges(data.changes)
      }
    },
  })
}
