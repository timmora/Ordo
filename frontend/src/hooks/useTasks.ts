import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { refreshSummary } from '@/lib/summaryRefresh'
import type { Task, TaskInsert } from '@/types/database'

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date')
      if (error) throw error
      return (data ?? []) as Task[]
    },
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TaskInsert) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      refreshSummary(qc)
    },
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if ('status' in variables || 'due_date' in variables) {
        refreshSummary(qc)
      }
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      refreshSummary(qc)
    },
  })
}
