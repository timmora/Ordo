import { useMemo } from 'react'
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

export function useFocusSessionsByTask(taskId: string | undefined) {
  const query = useQuery<FocusSession[]>({
    queryKey: ['focus_sessions', 'task', taskId],
    queryFn: async () => {
      if (!taskId) return []
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('task_id', taskId)
        .eq('mode', 'focus')
      if (error) throw error
      return data ?? []
    },
    enabled: !!taskId,
  })

  // Build a map of subtask_id -> total focused seconds
  const subtaskMinutesMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of query.data ?? []) {
      if (s.subtask_id) {
        map.set(s.subtask_id, (map.get(s.subtask_id) ?? 0) + Math.round(s.duration_seconds / 60))
      }
    }
    return map
  }, [query.data])

  return { ...query, subtaskMinutesMap }
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
    onError: (err) => {
      console.error('Failed to save focus session:', err)
    },
  })
}
