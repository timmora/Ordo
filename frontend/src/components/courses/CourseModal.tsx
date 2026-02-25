import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCreateCourse, useUpdateCourse, useDeleteCourse } from '@/hooks/useCourses'
import type { Course, ScheduleBlock } from '@/types/database'

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#64748b',
]

const DAYS: ScheduleBlock['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  open: boolean
  onClose: () => void
  course?: Course
}

const emptyBlock = (): ScheduleBlock => ({ day: 'Mon', start: '09:00', end: '10:00', location: '' })

export function CourseModal({ open, onClose, course }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([])

  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()
  const deleteCourse = useDeleteCourse()

  useEffect(() => {
    if (course) {
      setName(course.name)
      setColor(course.color)
      setSchedule(course.schedule)
    } else {
      setName('')
      setColor(PRESET_COLORS[0])
      setSchedule([])
    }
  }, [course, open])

  function addBlock() {
    setSchedule((s) => [...s, emptyBlock()])
  }

  function removeBlock(i: number) {
    setSchedule((s) => s.filter((_, idx) => idx !== i))
  }

  function updateBlock(i: number, patch: Partial<ScheduleBlock>) {
    setSchedule((s) => s.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }

  async function handleSave() {
    if (!name.trim()) return
    if (course) {
      await updateCourse.mutateAsync({ id: course.id, name: name.trim(), color, schedule })
    } else {
      await createCourse.mutateAsync({ name: name.trim(), color, schedule })
    }
    onClose()
  }

  async function handleDelete() {
    if (!course) return
    await deleteCourse.mutateAsync(course.id)
    onClose()
  }

  const isPending = createCourse.isPending || updateCourse.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'Add Course'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Course name</Label>
            <Input
              placeholder="e.g. CS 421"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  className="size-7 rounded-full ring-offset-2 transition-all"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : 'none',
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Schedule blocks */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Class schedule (optional)</Label>
              <Button size="sm" variant="ghost" onClick={addBlock}>
                <Plus className="size-4 mr-1" /> Add time slot
              </Button>
            </div>
            <div className="space-y-2">
              {schedule.map((block, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select
                    value={block.day}
                    onValueChange={(v) => updateBlock(i, { day: v as ScheduleBlock['day'] })}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="time"
                    className="w-28"
                    value={block.start}
                    onChange={(e) => updateBlock(i, { start: e.target.value })}
                  />
                  <span className="text-muted-foreground text-sm">to</span>
                  <Input
                    type="time"
                    className="w-28"
                    value={block.end}
                    onChange={(e) => updateBlock(i, { end: e.target.value })}
                  />
                  <Input
                    placeholder="Room"
                    className="flex-1"
                    value={block.location ?? ''}
                    onChange={(e) => updateBlock(i, { location: e.target.value })}
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeBlock(i)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {course && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCourse.isPending}>
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
