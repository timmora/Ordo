import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Subtask, SubtaskInsert, SubtaskUpdate } from '@/types/database'

export function useTasksWithSubtasks() {
  return useQuery({
    queryKey: ['subtasks', '_task_ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('task_id')
      if (error) throw error
      return new Set((data ?? []).map((r: { task_id: string }) => r.task_id))
    },
  })
}

export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      if (!taskId) return []
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('order_index')
      if (error) throw error
      return (data ?? []) as Subtask[]
    },
    enabled: !!taskId,
  })
}

export function useCreateSubtasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (inputs: SubtaskInsert[]) => {
      const { data, error } = await supabase
        .from('subtasks')
        .insert(inputs)
        .select()
      if (error) throw error
      return (data ?? []) as Subtask[]
    },
    onSuccess: (_data, variables) => {
      const taskId = variables[0]?.task_id
      if (taskId) qc.invalidateQueries({ queryKey: ['subtasks', taskId] })
      qc.invalidateQueries({ queryKey: ['subtasks', '_task_ids'] })
    },
  })
}

export function useUpdateSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: SubtaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('subtasks')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Subtask
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['subtasks', data.task_id] })
    },
  })
}

export function useDeleteSubtask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, taskId }: { id: string; taskId: string }) => {
      const { error } = await supabase.from('subtasks').delete().eq('id', id)
      if (error) throw error
      return taskId
    },
    onSuccess: (taskId) => {
      qc.invalidateQueries({ queryKey: ['subtasks', taskId] })
    },
  })
}

export function useDeleteTaskSubtasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('task_id', taskId)
      if (error) throw error
      return taskId
    },
    onSuccess: (taskId) => {
      qc.invalidateQueries({ queryKey: ['subtasks', taskId] })
    },
  })
}
