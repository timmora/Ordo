import { useSubtasks, useUpdateSubtask } from '@/hooks/useSubtasks'
import { useFocusSessionsByTask } from '@/hooks/useFocusSessions'

interface Props {
  taskId: string
}

export function SubtaskList({ taskId }: Props) {
  const { data: subtasks = [] } = useSubtasks(taskId)
  const { subtaskMinutesMap } = useFocusSessionsByTask(taskId)
  const updateSubtask = useUpdateSubtask()

  if (subtasks.length === 0) return null

  const done = subtasks.filter((s) => s.status === 'complete').length
  const total = subtasks.length

  function toggleStatus(id: string, current: string, index: number) {
    const allPreviousDone = subtasks.slice(0, index).every((s) => s.status === 'complete')
    if (!allPreviousDone && current !== 'complete') return
    updateSubtask.mutate({
      id,
      status: current === 'complete' ? 'pending' : 'complete',
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Subtasks</p>
        <p className="text-xs text-muted-foreground">{done}/{total} done</p>
      </div>
      <div className="space-y-1">
        {subtasks.map((s, i) => {
          const complete = s.status === 'complete'
          const unlocked = complete || subtasks.slice(0, i).every((prev) => prev.status === 'complete')
          const focusedMin = subtaskMinutesMap.get(s.id) ?? 0
          const remaining = Math.max(0, s.estimated_minutes - focusedMin)

          return (
            <div
              key={s.id}
              className={`flex items-center gap-2 rounded border px-2 py-1.5 ${!unlocked ? 'opacity-40' : ''}`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={complete}
                aria-label={`Mark subtask "${s.title}" as ${complete ? 'incomplete' : 'complete'}`}
                onClick={() => toggleStatus(s.id, s.status, i)}
                disabled={!unlocked}
                className={`w-3.5 h-3.5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  complete
                    ? 'bg-green-500 border-green-500'
                    : unlocked
                      ? 'border-muted-foreground hover:border-green-500'
                      : 'border-muted-foreground cursor-not-allowed'
                }`}
              >
                {complete && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={`text-sm flex-1 ${complete ? 'line-through text-muted-foreground' : ''}`}>
                {s.title}
              </span>
              <span className={`text-xs shrink-0 ${
                complete || remaining === 0 ? 'text-green-500' : focusedMin > 0 ? 'text-amber-500' : 'text-muted-foreground'
              }`}>
                {complete
                  ? 'done'
                  : remaining === 0
                    ? `${s.estimated_minutes}m done`
                    : focusedMin > 0
                      ? `${remaining}m left`
                      : `${s.estimated_minutes}m`
                }
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
