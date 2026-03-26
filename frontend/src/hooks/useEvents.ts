import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from './useSupabaseCrud'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { refreshSummary } from '@/lib/summaryRefresh'
import { refreshSchedule } from '@/lib/scheduleRefresh'
import type { Event, EventInsert } from '@/types/database'
import type { QueryClient } from '@tanstack/react-query'

const eventSideEffects = (qc: QueryClient) => {
  refreshSummary(qc)
  refreshSchedule(qc)
}

export const useEvents = () => useSupabaseQuery<Event>('events', ['events'], 'start_time')
export const useCreateEvent = () => useSupabaseInsert<EventInsert, Event>('events', [['events']], eventSideEffects)
export const useUpdateEvent = () => useSupabaseUpdate<Event>('events', [['events']], eventSideEffects)
export const useDeleteEvent = () => useSupabaseDelete('events', [['events']], eventSideEffects)

export function useBulkDeleteEvents() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('events').delete().in('id', ids)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['events'] })
      eventSideEffects(qc)
    },
  })
}
