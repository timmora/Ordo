import { useState, useEffect, useRef } from 'react'
import { BlockPicker } from 'react-color'
import { Plus, Trash2, Clock8Icon, Upload, Loader2, AlertTriangle, X } from 'lucide-react'
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
import { useCreateCourse, useUpdateCourse, useDeleteCourse, useCourses } from '@/hooks/useCourses'
import { useCreateTask, useTasks } from '@/hooks/useTasks'
import { useParseSyllabus } from '@/hooks/useSyllabus'
import type { SyllabusScheduleBlock, SyllabusTask } from '@/hooks/useSyllabus'
import { toast } from 'sonner'
import type { Course, ScheduleBlock } from '@/types/database'

const PRESET_COLORS = [
  '#9B0F06', '#b45309', '#FAE251', '#047857',
  '#636CCB', '#E491C9',
]

const DAYS: ScheduleBlock['day'][] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const TYPE_LABELS: Record<string, string> = {
  exam: 'Exam', homework: 'HW', project: 'Project', quiz: 'Quiz', reading: 'Reading', other: 'Other',
}

interface Props {
  open: boolean
  onClose: () => void
  course?: Course
  /** Called with the newly created course when used as a stacked dialog */
  onCourseCreated?: (course: Course) => void
}

const emptyBlock = (): ScheduleBlock => ({ day: 'Mon', start: '09:00', end: '10:00', location: '' })

export function CourseModal({ open, onClose, course, onCourseCreated }: Props) {
  const [activeTab, setActiveTab] = useState<'manual' | 'syllabus'>('manual')

  // Manual tab state
  const [name, setName] = useState('')
  const [color, setColor] = useState(PRESET_COLORS[0])
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Syllabus tab state
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null)
  const [syllabusCourseName, setSyllabusCourseName] = useState('')
  const [syllabusBlocks, setSyllabusBlocks] = useState<SyllabusScheduleBlock[]>([])
  const [syllabusTasks, setSyllabusTasks] = useState<SyllabusTask[]>([])
  const [syllabusReviewing, setSyllabusReviewing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createCourse = useCreateCourse()
  const updateCourse = useUpdateCourse()
  const deleteCourse = useDeleteCourse()
  const createTask = useCreateTask()
  const parseSyllabus = useParseSyllabus()
  const { data: courses = [] } = useCourses()
  const { data: existingTasks = [] } = useTasks()

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
    setActiveTab('manual')
    setSyllabusFile(null)
    setSyllabusReviewing(false)
    setSyllabusCourseName('')
    setSyllabusBlocks([])
    setSyllabusTasks([])
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
        toast.success('Course updated')
      } else {
        const created = await createCourse.mutateAsync({ name: name.trim(), color, schedule })
        onCourseCreated?.(created)
        toast.success('Course created')
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
      toast.success('Course deleted')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course')
    }
  }

  async function handleParseSyllabus() {
    if (!syllabusFile) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      // strip "data:application/pdf;base64,"
      const base64 = dataUrl.split(',')[1]
      try {
        const result = await parseSyllabus.mutateAsync({ fileData: base64, fileName: syllabusFile.name })
        setSyllabusCourseName(result.course_name)
        setSyllabusBlocks(result.schedule_blocks)
        setSyllabusTasks(result.tasks)
        setSyllabusReviewing(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not parse syllabus')
      }
    }
    reader.readAsDataURL(syllabusFile)
  }

  async function handleImport() {
    if (!syllabusCourseName.trim()) return
    try {
      // Map syllabus blocks → ScheduleBlock (add empty location if missing)
      const scheduleBlocks: ScheduleBlock[] = syllabusBlocks.map((b) => ({
        day: b.day as ScheduleBlock['day'],
        start: b.start,
        end: b.end,
        location: b.location ?? '',
      }))

      const created = await createCourse.mutateAsync({
        name: syllabusCourseName.trim(),
        color,
        schedule: scheduleBlocks,
      })

      // Batch-create tasks, skipping duplicates (same title + due_date)
      const existingSet = new Set(
        existingTasks.map((t) => `${t.title.toLowerCase()}|${t.due_date ?? ''}`)
      )
      let created_count = 0
      for (const t of syllabusTasks) {
        const key = `${t.title.toLowerCase()}|${t.due_date}`
        if (existingSet.has(key)) continue
        await createTask.mutateAsync({
          title: t.title,
          due_date: t.due_date,
          due_time: t.due_time ?? null,
          estimated_hours: t.estimated_hours ?? null,
          course_id: created.id,
          status: 'todo',
          priority: 'medium',
        })
        created_count++
      }

      onCourseCreated?.(created)
      toast.success(`Course imported with ${created_count} task${created_count !== 1 ? 's' : ''}`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import syllabus')
    }
  }

  const duplicateCourse = courses.find(
    (c) => c.name.toLowerCase() === syllabusCourseName.trim().toLowerCase() && c.id !== course?.id
  )

  const isPending = createCourse.isPending || updateCourse.isPending

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'Add Course'}</DialogTitle>
        </DialogHeader>

        {/* Tab bar — only show for new course */}
        {!course && (
          <div className="flex gap-1 border-b pb-0 -mx-6 px-6">
            {(['manual', 'syllabus'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'manual' ? 'Manual' : 'From Syllabus'}
              </button>
            ))}
          </div>
        )}

        {/* ——— MANUAL TAB ——— */}
        {(activeTab === 'manual' || course) && (
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Course name</Label>
              <Input
                placeholder="e.g. CS 421"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

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
        )}

        {/* ——— SYLLABUS TAB ——— */}
        {activeTab === 'syllabus' && !course && (
          <div className="space-y-4 py-2">
            {!syllabusReviewing ? (
              /* Upload step */
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-8 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm font-medium">
                    {syllabusFile ? syllabusFile.name : 'Click to upload syllabus PDF'}
                  </p>
                  {syllabusFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {(syllabusFile.size / 1024).toFixed(0)} KB
                    </p>
                  )}
                  {!syllabusFile && (
                    <p className="text-xs text-muted-foreground mt-1">PDF files only</p>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) setSyllabusFile(f)
                    }}
                  />
                </div>

                {/* Color picker for syllabus tab too */}
                <div className="space-y-1.5">
                  <Label>Course color</Label>
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
                        onClick={() => setColor(c)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Review step */
              <div className="space-y-4">
                {duplicateCourse && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>A course named &ldquo;{duplicateCourse.name}&rdquo; already exists. Importing will create a new course with the same name.</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Course name</Label>
                  <Input
                    value={syllabusCourseName}
                    onChange={(e) => setSyllabusCourseName(e.target.value)}
                  />
                </div>

                {syllabusBlocks.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Class schedule</Label>
                    <div className="space-y-1">
                      {syllabusBlocks.map((b, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-10 shrink-0 font-medium">{b.day}</span>
                          <span className="text-muted-foreground">{b.start}–{b.end}</span>
                          {b.location && <span className="text-muted-foreground">· {b.location}</span>}
                          <button
                            type="button"
                            className="ml-auto text-muted-foreground hover:text-destructive"
                            onClick={() => setSyllabusBlocks((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {syllabusTasks.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Tasks ({syllabusTasks.length})</Label>
                    <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                      {syllabusTasks.map((t, i) => {
                        const isDup = existingTasks.some(
                          (et) => et.title.toLowerCase() === t.title.toLowerCase() && et.due_date === t.due_date
                        )
                        return (
                          <div
                            key={i}
                            className={`flex items-center gap-2 px-1 py-0.5 rounded text-sm ${isDup ? 'opacity-50' : ''}`}
                          >
                            <span className="flex-1 truncate min-w-0">{t.title}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{t.due_date}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">
                              {TYPE_LABELS[t.type] ?? t.type}
                            </span>
                            {isDup && <span className="text-xs text-muted-foreground shrink-0">dup</span>}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => setSyllabusTasks((prev) => prev.filter((_, idx) => idx !== i))}
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                    {existingTasks.some((et) =>
                      syllabusTasks.some(
                        (t) => t.title.toLowerCase() === et.title.toLowerCase() && et.due_date === t.due_date
                      )
                    ) && (
                      <p className="text-xs text-muted-foreground">Dimmed tasks already exist and will be skipped.</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={() => { setSyllabusReviewing(false); setSyllabusFile(null) }}
                >
                  ← Upload a different file
                </button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex justify-between">
          {course && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={deleteCourse.isPending}>
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>

            {(activeTab === 'manual' || course) && (
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            )}

            {activeTab === 'syllabus' && !course && !syllabusReviewing && (
              <Button
                onClick={handleParseSyllabus}
                disabled={!syllabusFile || parseSyllabus.isPending}
              >
                {parseSyllabus.isPending ? (
                  <><Loader2 className="size-4 mr-2 animate-spin" /> Parsing…</>
                ) : 'Parse PDF'}
              </Button>
            )}

            {activeTab === 'syllabus' && !course && syllabusReviewing && (
              <Button
                onClick={handleImport}
                disabled={!syllabusCourseName.trim() || createCourse.isPending}
              >
                {createCourse.isPending ? 'Importing…' : `Import${syllabusTasks.length > 0 ? ` (${syllabusTasks.length} tasks)` : ''}`}
              </Button>
            )}
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
