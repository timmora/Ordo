import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { FocusSession, FocusSessionInsert } from '../types/database'

export function useFocusSessions(date: string) {
  return useQuery<FocusSession[]>({
    queryKey: ['focus_sessions', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .gte('completed_at', `${date}T00:00:00`)
        .lt('completed_at', `${date}T23:59:59`)
        .order('completed_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateFocusSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (session: FocusSessionInsert) => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .insert(session)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['focus_sessions'] })
    },
  })
}
