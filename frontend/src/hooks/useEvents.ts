import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Event, EventInsert } from '@/types/database'

export function useEvents() {
  return useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as Event[]
    },
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EventInsert) => {
      const { data, error } = await supabase
        .from('events')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Event
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from('events')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Event
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  })
}
