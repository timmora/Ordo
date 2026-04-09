import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
import { useCourses } from '@/hooks/useCourses'
import { useCreateTask } from '@/hooks/useTasks'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
}

export function TodoModal({ open, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string>('none')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')

  const { data: courses = [] } = useCourses()
  const createTask = useCreateTask()

  useEffect(() => {
    if (open) {
      setTitle('')
      setCourseId('none')
      setPriority('medium')
    }
  }, [open])

  async function handleSave() {
    if (!title.trim()) return
    try {
      await createTask.mutateAsync({
        title: title.trim(),
        course_id: courseId === 'none' ? null : courseId,
        priority,
        due_date: null,
        status: 'todo',
      })
      toast.success('To-do created')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save to-do')
    }
  }

  const selectedCourse = courses.find((c) => c.id === courseId)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New To-do</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="e.g. Read chapter 4"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Course</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  <span className="flex items-center gap-2">
                    {selectedCourse && (
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedCourse.color }} />
                    )}
                    {selectedCourse ? selectedCourse.name : 'None'}
                  </span>
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => setCourseId('none')}>None</DropdownMenuItem>
                  {courses.map((c) => (
                    <DropdownMenuItem key={c.id} onSelect={() => setCourseId(c.id)}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-1.5">
            <Label>Priority</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal capitalize">
                  {priority}
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuGroup>
                  {priority !== 'low' && <DropdownMenuItem onSelect={() => setPriority('low')}>Low</DropdownMenuItem>}
                  {priority !== 'medium' && <DropdownMenuItem onSelect={() => setPriority('medium')}>Medium</DropdownMenuItem>}
                  {priority !== 'high' && <DropdownMenuItem onSelect={() => setPriority('high')}>High</DropdownMenuItem>}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || createTask.isPending}>
            {createTask.isPending ? 'Adding…' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
