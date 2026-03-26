import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { refreshSchedule } from '@/lib/scheduleRefresh'
import type { Subtask, SubtaskInsert, SubtaskUpdate } from '@/types/database'

export function useAllSubtasks() {
  return useQuery({
    queryKey: ['subtasks', '_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .order('order_index')
      if (error) throw error
      const map = new Map<string, Subtask[]>()
      for (const s of (data ?? []) as Subtask[]) {
        const list = map.get(s.task_id) ?? []
        list.push(s)
        map.set(s.task_id, list)
      }
      return map
    },
  })
}

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
      qc.invalidateQueries({ queryKey: ['subtasks', '_all'] })
      refreshSchedule(qc)
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
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['subtasks'] })

      // Snapshot all subtask queries for rollback
      const snapshot = qc.getQueriesData({ queryKey: ['subtasks'] })

      const apply = (list: Subtask[]) =>
        list.map((s) => (s.id === variables.id ? { ...s, ...variables } : s))

      // Optimistically update per-task array caches
      for (const [key, data] of snapshot) {
        if (Array.isArray(data)) {
          qc.setQueryData(key, apply(data))
        }
      }

      // Optimistically update the _all Map cache
      const allMap = qc.getQueryData<Map<string, Subtask[]>>(['subtasks', '_all'])
      if (allMap) {
        const next = new Map<string, Subtask[]>()
        for (const [taskId, subs] of allMap) {
          next.set(taskId, apply(subs))
        }
        qc.setQueryData(['subtasks', '_all'], next)
      }

      return { snapshot }
    },
    onError: (_err, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) {
        qc.setQueryData(key, data)
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['subtasks'] })
      refreshSchedule(qc)
    },
  })
}

/** Reorder subtasks by updating order_index for each. */
export function useReorderSubtasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: { id: string; order_index: number }[]) => {
      // Batch update order indices
      const promises = items.map(({ id, order_index }) =>
        supabase.from('subtasks').update({ order_index }).eq('id', id)
      )
      await Promise.all(promises)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['subtasks'] })
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
      qc.invalidateQueries({ queryKey: ['subtasks', '_all'] })
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
      qc.invalidateQueries({ queryKey: ['subtasks', '_all'] })
      qc.invalidateQueries({ queryKey: ['subtasks', '_task_ids'] })
    },
  })
}
