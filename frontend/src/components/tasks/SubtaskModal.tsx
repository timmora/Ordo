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
  const updateSubtask = useUpdateSubtask()
  const deleteSubtask = useDeleteSubtask()

  useEffect(() => {
    if (subtask) {
      setTitle(subtask.title)
      setMinutes(String(subtask.estimated_minutes))
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
      },
      {
        onSuccess: () => {
          toast.success('Subtask updated')
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
