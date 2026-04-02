import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSupabaseInsert } from './useSupabaseCrud'
import type { FocusSession, FocusSessionInsert } from '@/types/database'

export function useFocusSessions(date: string) {
  return useQuery<FocusSession[]>({
    queryKey: ['focus_sessions', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .gte('completed_at', `${date}T00:00:00`)
        .lt('completed_at', `${date}T24:00:00`)
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

export const useCreateFocusSession = () =>
  useSupabaseInsert<FocusSessionInsert, FocusSession>('focus_sessions', [['focus_sessions']])

/** Compute consecutive days with at least one focus session (streak). */
export function useFocusStreak() {
  return useQuery({
    queryKey: ['focus_sessions', '_streak'],
    queryFn: async () => {
      // Fetch distinct dates with focus sessions (last 90 days max)
      const since = new Date()
      since.setDate(since.getDate() - 90)
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('completed_at')
        .eq('mode', 'focus')
        .gte('completed_at', since.toISOString())
        .order('completed_at', { ascending: false })
      if (error) throw error

      // Extract unique dates (local)
      const dates = new Set<string>()
      for (const row of data ?? []) {
        dates.add(new Date(row.completed_at).toLocaleDateString('en-CA')) // YYYY-MM-DD
      }

      // Count consecutive days backwards from today
      let streak = 0
      const d = new Date()
      while (true) {
        const key = d.toLocaleDateString('en-CA')
        if (dates.has(key)) {
          streak++
          d.setDate(d.getDate() - 1)
        } else {
          break
        }
      }
      return streak
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
