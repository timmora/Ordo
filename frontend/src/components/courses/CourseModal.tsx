import { useState, useEffect } from 'react'
import { BlockPicker } from 'react-color'
import { Plus, Trash2, Clock8Icon } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
import { useCreateCourse, useUpdateCourse, useDeleteCourse } from '@/hooks/useCourses'
import { toast } from 'sonner'
import type { Course, ScheduleBlock } from '@/types/database'

const PRESET_COLORS = [
  '#9B0F06', '#b45309', '#FAE251', '#047857',
  '#636CCB', '#E491C9',
]

const DAYS: ScheduleBlock['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface Props {
  open: boolean
  onClose: () => void
  course?: Course
  /** Called with the newly created course when used as a stacked dialog */
  onCourseCreated?: (course: Course) => void
}

const emptyBlock = (): ScheduleBlock => ({ day: 'Mon', start: '09:00', end: '10:00', location: '' })

export function CourseModal({ open, onClose, course, onCourseCreated }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()
  const deleteCourse = useDeleteCourse()

  useEffect(() => {
    if (course) {
      setName(course.name)
      setColor(course.color)
      setSchedule(course.schedule)
      setCustomColors(PRESET_COLORS.includes(course.color) ? [] : [course.color])
    } else {
      setName('')
      setColor(PRESET_COLORS[0])
      setSchedule([])
      setCustomColors([])
    }
    setPickerOpen(false)
    setError('')
    setConfirmDelete(false)
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
    try {
      setError('')
      if (course) {
        await updateCourse.mutateAsync({ id: course.id, name: name.trim(), color, schedule })
        toast.success(`"${name.trim()}" updated`)
      } else {
        const created = await createCourse.mutateAsync({ name: name.trim(), color, schedule })
        onCourseCreated?.(created)
        toast.success(`"${name.trim()}" created`)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save course')
    }
  }

  async function handleDelete() {
    if (!course) return
    try {
      setError('')
      await deleteCourse.mutateAsync(course.id)
      toast.success(`"${course?.name}" deleted`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course')
    }
  }

  const isPending = createCourse.isPending || updateCourse.isPending

  return (
    <>
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
            <div className="flex gap-2 flex-wrap items-center">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-6 rounded-full"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                  onClick={() => { setColor(c); setPickerOpen(false) }}
                />
              ))}
              {customColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="size-6 rounded-full"
                  style={{
                    backgroundColor: c,
                    outline: color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                  onClick={() => { setColor(c); setPickerOpen(false) }}
                />
              ))}
              <div className="relative flex items-center">
                <button
                  type="button"
                  className="size-6 rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground transition-colors"
                  title="Custom color"
                  onClick={() => setPickerOpen((o) => !o)}
                />
                {pickerOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
                    <div className="absolute top-9 left-0 z-50">
                      <BlockPicker
                        color={color}
                        onChangeComplete={(c) => {
                          setColor(c.hex)
                          setPickerOpen(false)
                          setCustomColors((prev) =>
                            prev.includes(c.hex) ? prev : [...prev, c.hex]
                          )
                        }}
                        triangle="hide"
                      />
                    </div>
                  </>
                )}
              </div>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-20 justify-between font-normal">
                        {block.day}
                        <ChevronDownIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuGroup>
                        {DAYS.filter((d) => d !== block.day).map((d) => (
                          <DropdownMenuItem key={d} onSelect={() => updateBlock(i, { day: d })}>{d}</DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="relative w-32">
                    <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                      <Clock8Icon className="size-4" />
                    </div>
                    <Input
                      type="time"
                      value={block.start}
                      onChange={(e) => updateBlock(i, { start: e.target.value })}
                      className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>
                  <span className="text-muted-foreground text-sm">to</span>
                  <div className="relative w-32">
                    <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
                      <Clock8Icon className="size-4" />
                    </div>
                    <Input
                      type="time"
                      value={block.end}
                      onChange={(e) => updateBlock(i, { end: e.target.value })}
                      className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                    />
                  </div>

                  <Button size="icon" variant="ghost" onClick={() => removeBlock(i)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex justify-between">
          {course && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleteCourse.isPending}>
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

    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete course?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove &ldquo;{course?.name}&rdquo; and unlink it from all associated events and tasks. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
