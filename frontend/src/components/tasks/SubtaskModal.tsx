import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUpdateSubtask, useDeleteSubtask } from '@/hooks/useSubtasks'
import { toast } from 'sonner'
import type { Subtask } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  subtask: Subtask | null
}

export function SubtaskModal({ open, onClose, subtask }: Props) {
  const [title, setTitle] = useState('')
  const [minutes, setMinutes] = useState('')
  const [asTodo, setAsTodo] = useState(false)
  const updateSubtask = useUpdateSubtask()
  const deleteSubtask = useDeleteSubtask()

  useEffect(() => {
    if (subtask) {
      setTitle(subtask.title)
      setMinutes(String(subtask.estimated_minutes))
      setAsTodo(subtask.is_todo || !subtask.scheduled_start || !subtask.scheduled_end)
    }
  }, [subtask])

  function handleSave() {
    if (!subtask || !title.trim()) return
    const mins = parseInt(minutes, 10)
    updateSubtask.mutate(
      {
        id: subtask.id,
        title: title.trim(),
        ...(Number.isFinite(mins) && mins > 0 ? { estimated_minutes: mins } : {}),
        ...(asTodo
          ? { scheduled_start: null, scheduled_end: null, is_todo: true }
          : { is_todo: false }),
      },
      {
        onSuccess: () => {
          toast.success('Subtask saved')
          onClose()
        },
      },
    )
  }

  function handleDelete() {
    if (!subtask) return
    deleteSubtask.mutate({ id: subtask.id, taskId: subtask.task_id }, {
      onSuccess: () => {
        toast.success('Subtask deleted')
        onClose()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Subtask</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="subtask-title">Title</Label>
            <Input
              id="subtask-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subtask-minutes">Estimated minutes</Label>
            <Input
              id="subtask-minutes"
              type="number"
              min={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Make this a to-do</p>
              <p className="text-xs text-muted-foreground">Removes scheduled time until you place it again.</p>
            </div>
            <button
              type="button"
              role="checkbox"
              aria-checked={asTodo}
              aria-label="Mark subtask as to-do"
              onClick={() => setAsTodo((v) => !v)}
              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                asTodo
                  ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
                  : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
              }`}
            >
              {asTodo && (
                <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleteSubtask.isPending}
          >
            Delete
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={updateSubtask.isPending || !title.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
