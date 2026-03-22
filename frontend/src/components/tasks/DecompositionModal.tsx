import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronUp, ChevronDown, X, Plus, Loader2, RefreshCw } from 'lucide-react'
import { useDecompose } from '@/hooks/useDecompose'
import { useSubtasks, useCreateSubtasks, useDeleteTaskSubtasks } from '@/hooks/useSubtasks'
import type { Task } from '@/types/database'

interface DraftSubtask {
  tempId: string
  title: string
  estimated_minutes: number
}

interface Props {
  open: boolean
  onClose: () => void
  task?: Task
}

export function DecompositionModal({ open, onClose, task }: Props) {
  const [drafts, setDrafts] = useState<DraftSubtask[]>([])
  const [hasGenerated, setHasGenerated] = useState(false)

  const decompose = useDecompose()
  const createSubtasks = useCreateSubtasks()
  const deleteTaskSubtasks = useDeleteTaskSubtasks()
  const { data: existingSubtasks = [] } = useSubtasks(task?.id)

  // Auto-trigger decomposition when modal opens with a task
  useEffect(() => {
    if (open && task && !hasGenerated) {
      generate()
    }
    if (!open) {
      setDrafts([])
      setHasGenerated(false)
      decompose.reset()
    }
  }, [open, task?.id])

  function generate() {
    if (!task) return
    setHasGenerated(true)
    decompose.mutate(task.id, {
      onSuccess: (suggestions) => {
        setDrafts(
          suggestions.map((s) => ({
            tempId: crypto.randomUUID(),
            title: s.title,
            estimated_minutes: s.estimated_minutes,
          }))
        )
      },
    })
  }

  function handleRegenerate() {
    setDrafts([])
    decompose.reset()
    setHasGenerated(false)
    // Small delay so the reset takes effect before re-triggering
    setTimeout(() => generate(), 0)
  }

  function updateDraft(tempId: string, field: keyof DraftSubtask, value: string | number) {
    setDrafts((prev) =>
      prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d))
    )
  }

  function removeDraft(tempId: string) {
    setDrafts((prev) => prev.filter((d) => d.tempId !== tempId))
  }

  function moveUp(index: number) {
    if (index === 0) return
    setDrafts((prev) => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
  }

  function moveDown(index: number) {
    setDrafts((prev) => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), title: '', estimated_minutes: 30 },
    ])
  }

  async function handleConfirm() {
    if (!task || drafts.length === 0) return

    // Delete existing subtasks if re-decomposing
    if (existingSubtasks.length > 0) {
      await deleteTaskSubtasks.mutateAsync(task.id)
    }

    const inserts = drafts.map((d, i) => ({
      task_id: task.id,
      title: d.title,
      order_index: i,
      estimated_minutes: d.estimated_minutes,
    }))

    await createSubtasks.mutateAsync(inserts)
    onClose()
  }

  const totalMinutes = drafts.reduce((sum, d) => sum + d.estimated_minutes, 0)
  const totalHours = Math.floor(totalMinutes / 60)
  const remainingMinutes = totalMinutes % 60
  const totalDisplay = totalHours > 0
    ? `${totalHours}h ${remainingMinutes}m`
    : `${remainingMinutes}m`

  const isConfirming = createSubtasks.isPending || deleteTaskSubtasks.isPending
  const isLoading = decompose.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-6">
            Break Down: {task?.title ?? 'Task'}
          </DialogTitle>
          {task && (
            <p className="text-sm text-muted-foreground">
              Due {task.due_date}
              {task.estimated_hours ? ` \u00b7 ${task.estimated_hours}h estimated` : ''}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2 space-y-3">
          {/* Loading state */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-8 animate-spin mb-3" />
              <p className="text-sm">Breaking down your task...</p>
            </div>
          )}

          {/* Error state */}
          {decompose.isError && (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-destructive mb-3">
                {decompose.error?.message || 'Something went wrong'}
              </p>
              <Button variant="outline" size="sm" onClick={handleRegenerate}>
                <RefreshCw className="size-4 mr-1.5" />
                Try again
              </Button>
            </div>
          )}

          {/* Review state */}
          {!isLoading && !decompose.isError && drafts.length > 0 && (
            <>
              {existingSubtasks.length > 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                  This task has {existingSubtasks.length} existing subtask{existingSubtasks.length > 1 ? 's' : ''}.
                  Confirming will replace them.
                </p>
              )}

              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{drafts.length} subtask{drafts.length !== 1 ? 's' : ''}</span>
                <span>Total: {totalDisplay}</span>
              </div>

              {drafts.map((draft, i) => (
                <div
                  key={draft.tempId}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <span className="text-xs text-muted-foreground w-5 text-center shrink-0">
                    {i + 1}
                  </span>

                  <Input
                    className="flex-1 h-8 text-sm"
                    placeholder="Subtask title"
                    value={draft.title}
                    onChange={(e) => updateDraft(draft.tempId, 'title', e.target.value)}
                  />

                  <Input
                    className="w-16 h-8 text-sm text-center"
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={draft.estimated_minutes}
                    onChange={(e) =>
                      updateDraft(draft.tempId, 'estimated_minutes', parseInt(e.target.value) || 0)
                    }
                  />
                  <span className="text-xs text-muted-foreground shrink-0">min</span>

                  <div className="flex flex-col shrink-0">
                    <button
                      type="button"
                      className="p-0.5 hover:bg-accent rounded disabled:opacity-30"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      className="p-0.5 hover:bg-accent rounded disabled:opacity-30"
                      onClick={() => moveDown(i)}
                      disabled={i === drafts.length - 1}
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded shrink-0"
                    onClick={() => removeDraft(draft.tempId)}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}

              <Button variant="ghost" size="sm" className="w-full" onClick={addDraft}>
                <Plus className="size-4 mr-1.5" />
                Add subtask
              </Button>
            </>
          )}
        </div>

        <DialogFooter className="flex justify-between pt-2 border-t">
          {!isLoading && drafts.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RefreshCw className="size-4 mr-1.5" />
              Regenerate
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {!isLoading && drafts.length > 0 && (
              <Button
                onClick={handleConfirm}
                disabled={isConfirming || drafts.some((d) => !d.title.trim())}
              >
                {isConfirming ? 'Saving...' : 'Confirm'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
