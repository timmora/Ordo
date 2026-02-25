import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCourses } from '@/hooks/useCourses'
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/hooks/useTasks'
import type { Task, TaskInsert } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  task?: Task
  defaultDueDate?: string
}

export function TaskModal({ open, onClose, task, defaultDueDate }: Props) {
  const { data: courses = [] } = useCourses()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string>('none')
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [status, setStatus] = useState<Task['status']>('todo')

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setCourseId(task.course_id ?? 'none')
      setDueDate(task.due_date)
      setEstimatedHours(task.estimated_hours?.toString() ?? '')
      setPriority(task.priority)
      setStatus(task.status)
    } else {
      setTitle('')
      setCourseId('none')
      setDueDate(defaultDueDate ?? '')
      setEstimatedHours('')
      setPriority('medium')
      setStatus('todo')
    }
  }, [task, open, defaultDueDate])

  function buildPayload(): TaskInsert {
    return {
      title: title.trim(),
      course_id: courseId === 'none' ? null : courseId,
      due_date: dueDate,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      priority,
      status,
    }
  }

  async function handleSave() {
    if (!title.trim() || !dueDate) return
    if (task) {
      await updateTask.mutateAsync({ id: task.id, ...buildPayload() })
    } else {
      await createTask.mutateAsync(buildPayload())
    }
    onClose()
  }

  async function handleDelete() {
    if (!task) return
    await deleteTask.mutateAsync(task.id)
    onClose()
  }

  const isPending = createTask.isPending || updateTask.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. CS 421 Final Project"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Course (optional)</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="No course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estimated hours</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 3"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Task['priority'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {task && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Task['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          {task && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleteTask.isPending}>
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
