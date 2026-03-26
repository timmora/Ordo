import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useSupabaseQuery, useSupabaseInsert, useSupabaseDelete } from './useSupabaseCrud'
import { refreshSummary } from '@/lib/summaryRefresh'
import { refreshSchedule } from '@/lib/scheduleRefresh'
import type { Task, TaskInsert, Subtask } from '@/types/database'
import type { QueryClient } from '@tanstack/react-query'

const taskSideEffects = (qc: QueryClient) => {
  refreshSummary(qc)
  refreshSchedule(qc)
}

export const useTasks = () => useSupabaseQuery<Task>('tasks', ['tasks'], 'due_date')
export const useCreateTask = () => useSupabaseInsert<TaskInsert, Task>('tasks', [['tasks']], taskSideEffects)
export const useDeleteTask = () => useSupabaseDelete('tasks', [['tasks']], taskSideEffects)

/** Bulk-update multiple tasks at once (e.g. mark done, change priority). */
export function useBulkUpdateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<Omit<Task, 'id'>> }) => {
      const { error } = await supabase
        .from('tasks')
        .update(patch)
        .in('id', ids)
      if (error) throw error
      // Cascade subtask status when marking done / undone
      if (patch.status === 'done') {
        await supabase.from('subtasks').update({ status: 'complete' }).in('task_id', ids).neq('status', 'complete')
      } else if (patch.status === 'todo' || patch.status === 'in_progress') {
        await supabase.from('subtasks').update({ status: 'pending' }).in('task_id', ids).neq('status', 'pending')
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['subtasks'] })
      taskSideEffects(qc)
    },
  })
}

/** Bulk-delete multiple tasks at once. */
export function useBulkDeleteTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('tasks').delete().in('id', ids)
      if (error) throw error
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['subtasks'] })
      taskSideEffects(qc)
    },
  })
}

// useUpdateTask has conditional refreshSummary logic and subtask cascade that don't fit the generic pattern
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
    onMutate: async (variables) => {
      await qc.cancelQueries({ queryKey: ['tasks'] })
      const previousTasks = qc.getQueryData<Task[]>(['tasks'])
      qc.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === variables.id ? { ...t, ...variables } : t))
      )

      // Cascade: toggle subtasks when task status changes to/from done
      let previousSubtasks: [readonly unknown[], unknown][] | undefined
      const cascadeStatus = variables.status === 'done' ? 'complete' as const
        : (variables.status === 'todo' || variables.status === 'in_progress') ? 'pending' as const
        : null
      if (cascadeStatus) {
        await qc.cancelQueries({ queryKey: ['subtasks'] })
        previousSubtasks = qc.getQueriesData({ queryKey: ['subtasks'] })

        const applyStatus = (list: Subtask[]) =>
          list.map((s) => s.task_id === variables.id ? { ...s, status: cascadeStatus } : s)

        for (const [key, data] of previousSubtasks) {
          if (Array.isArray(data)) {
            qc.setQueryData(key, applyStatus(data))
          }
        }
        const allMap = qc.getQueryData<Map<string, Subtask[]>>(['subtasks', '_all'])
        if (allMap) {
          const next = new Map(allMap)
          const taskSubs = next.get(variables.id)
          if (taskSubs) next.set(variables.id, taskSubs.map((s) => ({ ...s, status: cascadeStatus })))
          qc.setQueryData(['subtasks', '_all'], next)
        }
      }

      return { previousTasks, previousSubtasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) qc.setQueryData(['tasks'], context.previousTasks)
      if (context?.previousSubtasks) {
        for (const [key, data] of context.previousSubtasks) {
          qc.setQueryData(key, data)
        }
      }
    },
    onSuccess: async (_data, variables) => {
      // Cascade: persist subtask status to DB
      if (variables.status === 'done') {
        await supabase
          .from('subtasks')
          .update({ status: 'complete' })
          .eq('task_id', variables.id)
          .neq('status', 'complete')
      } else if (variables.status === 'todo' || variables.status === 'in_progress') {
        await supabase
          .from('subtasks')
          .update({ status: 'pending' })
          .eq('task_id', variables.id)
          .neq('status', 'pending')
      }
      if ('status' in variables || 'due_date' in variables) {
        refreshSummary(qc)
      }
      refreshSchedule(qc)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['subtasks'] })
    },
  })
}
