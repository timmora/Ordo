import { useState, useEffect, useRef } from 'react'
import { format, parse } from 'date-fns'
import { tryParseDate } from '@/lib/dateUtils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Sparkles, CalendarIcon, Clock8Icon, Paperclip, X } from 'lucide-react'
import { ColorPickerField, PRESET_COLORS } from '@/components/shared/ColorPickerField'
import { CourseDropdown } from '@/components/shared/CourseDropdown'
import { RecurrenceSelect } from '@/components/shared/RecurrenceSelect'
import { useQueryClient } from '@tanstack/react-query'
import { useCourses, useCreateCourse } from '@/hooks/useCourses'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useSubtasks } from '@/hooks/useSubtasks'
import { SubtaskList } from '@/components/tasks/SubtaskList'
import { supabase } from '@/lib/supabase'
import { undoableDelete } from '@/lib/undoableDelete'
import { toast } from 'sonner'
import type { Task, TaskInsert } from '@/types/database'

export interface DecomposeContext {
  task: Task
  description?: string
  fileContent?: string
  fileName?: string
  fileData?: string
  fileMediaType?: string
}

interface Props {
  open: boolean
  onClose: () => void
  task?: Task
  defaultDueDate?: string
  onDecompose?: (ctx: DecomposeContext) => void
}

export function TaskModal({ open, onClose, task, defaultDueDate, onDecompose }: Props) {
  const queryClient = useQueryClient()
  const { data: courses = [] } = useCourses()
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const createCourse = useCreateCourse()
  const { data: subtasks = [] } = useSubtasks(task?.id)

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string>('none')
  const [addingCourse, setAddingCourse] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseColor, setNewCourseColor] = useState(PRESET_COLORS[0])
  const [noDueDate, setNoDueDate] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [dueDateInput, setDueDateInput] = useState('')
  const [dueDateOpen, setDueDateOpen] = useState(false)
  const [estimatedHours, setEstimatedHours] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [status, setStatus] = useState<Task['status']>('todo')
  const [recurrence, setRecurrence] = useState<string>('none')
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [fileData, setFileData] = useState('')
  const [fileMediaType, setFileMediaType] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(30)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setCourseId(task.course_id ?? 'none')
      setNoDueDate(!task.due_date)
      setDueDate(task.due_date ?? '')
      setDueTime(task.due_time ?? '')
      setEstimatedHours(task.estimated_hours?.toString() ?? '')
      setPriority(task.priority)
      setStatus(task.status)
      setRecurrence(task.recurrence_rule ?? 'none')
      setReminderEnabled(task.reminder_enabled ?? false)
      setReminderMinutesBefore(task.reminder_minutes_before ?? 30)
    } else {
      setTitle('')
      setCourseId('none')
      setNoDueDate(false)
      setDueDate(defaultDueDate ?? '')
      setDueTime('')
      setEstimatedHours('')
      setPriority('medium')
      setStatus('todo')
      setRecurrence('none')
      setReminderEnabled(false)
      setReminderMinutesBefore(30)
    }
    setAddingCourse(false)
    setNewCourseName('')
    setNewCourseColor(PRESET_COLORS[0])
    setDescription('')
    setFileName('')
    setFileContent('')
    setFileData('')
    setFileMediaType('')
    setError('')
  }, [task, open, defaultDueDate])

  useEffect(() => {
    setDueDateInput(dueDate ? format(parse(dueDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
  }, [dueDate])

  function buildPayload(): TaskInsert {
    return {
      title: title.trim(),
      course_id: courseId === 'none' ? null : courseId,
      due_date: noDueDate ? null : dueDate || null,
      due_time: dueTime || null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      priority,
      status,
      recurrence_rule: recurrence === 'none' ? null : recurrence,
      reminder_enabled: reminderEnabled,
      reminder_minutes_before: reminderEnabled ? reminderMinutesBefore : null,
      reminder_last_sent_at: null,
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    const reader = new FileReader()
    if (isPdf) {
      reader.onload = () => {
        const dataUrl = reader.result as string
        setFileData(dataUrl.split(',')[1] ?? '')
        setFileMediaType('application/pdf')
        setFileContent('')
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = () => {
        setFileContent(reader.result as string)
        setFileData('')
        setFileMediaType('')
      }
      reader.readAsText(file)
    }
  }

  function removeFile() {
    setFileName('')
    setFileContent('')
    setFileData('')
    setFileMediaType('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSave() {
    if (!title.trim()) return
    try {
      setError('')
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...buildPayload() })
        toast.success(`"${title.trim()}" updated`)
      } else {
        await createTask.mutateAsync(buildPayload())
        toast.success(`"${title.trim()}" created`)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task')
    }
  }

  async function handleSaveAndDecompose() {
    if (!title.trim() || !onDecompose) return
    try {
      setError('')
      const created = await createTask.mutateAsync(buildPayload())
      toast.success('Task created')
      onClose()
      onDecompose({
        task: created,
        description: description.trim() || undefined,
        fileContent: fileContent || undefined,
        fileName: fileName || undefined,
        fileData: fileData || undefined,
        fileMediaType: fileMediaType || undefined,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task')
    }
  }

  function handleDelete() {
    if (!task) return
    onClose()
    undoableDelete({
      queryClient,
      queryKey: ['tasks'],
      items: [task],
      deleteFn: async () => {
        const { error } = await supabase.from('tasks').delete().eq('id', task.id)
        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ['subtasks'] })
      },
      message: `"${task.title}" deleted`,
    })
  }

  const isPending = createTask.isPending || updateTask.isPending

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 overflow-y-auto px-1 -mx-1">
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
            {addingCourse ? (
              <div className="space-y-2">
                <Input
                  placeholder="Course name"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!newCourseName.trim()) return
                      createCourse.mutate({ name: newCourseName.trim(), color: newCourseColor, schedule: [] }, {
                        onSuccess: (course) => {
                          setCourseId(course.id)
                          setAddingCourse(false)
                          setNewCourseName('')
                          setNewCourseColor(PRESET_COLORS[0])
                        },
                      })
                    }
                  }}
                  autoFocus
                />
                <ColorPickerField color={newCourseColor} onChange={setNewCourseColor} swatchSize="sm" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setAddingCourse(false); setNewCourseName(''); setNewCourseColor(PRESET_COLORS[0]) }}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newCourseName.trim()) return
                      createCourse.mutate({ name: newCourseName.trim(), color: newCourseColor, schedule: [] }, {
                        onSuccess: (course) => {
                          setCourseId(course.id)
                          setAddingCourse(false)
                          setNewCourseName('')
                          setNewCourseColor(PRESET_COLORS[0])
                        },
                      })
                    }}
                    disabled={createCourse.isPending || !newCourseName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <CourseDropdown courseId={courseId} onChange={setCourseId} onAddCourse={() => setAddingCourse(true)} />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Date</Label>
              <button
                type="button"
                onClick={() => { setNoDueDate((v) => !v); setDueDate(''); setDueTime('') }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {noDueDate ? 'Add due date' : 'No due date'}
              </button>
            </div>
            {!noDueDate && (
              <div className="grid grid-cols-2 gap-3">
                <Popover open={dueDateOpen} onOpenChange={setDueDateOpen}>
                  <div className="relative">
                    <Input
                      placeholder="mm/dd/yyyy"
                      value={dueDateInput}
                      onChange={(e) => setDueDateInput(e.target.value)}
                      onBlur={() => {
                        const d = tryParseDate(dueDateInput)
                        if (d) setDueDate(format(d, 'yyyy-MM-dd'))
                        else setDueDateInput(dueDate ? format(parse(dueDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
                      }}
                      className="pr-9"
                    />
                    <PopoverTrigger asChild>
                      <button type="button" className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors">
                        <CalendarIcon className="size-4" />
                      </button>
                    </PopoverTrigger>
                  </div>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dueDate ? parse(dueDate, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) { setDueDate(format(date, 'yyyy-MM-dd')); setDueDateOpen(false) }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <Input
                    type="time"
                    placeholder="Time (optional)"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="bg-background appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3">
                    <Clock8Icon className="size-4" />
                  </div>
                </div>
              </div>
            )}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {{ low: 'Low', medium: 'Medium', high: 'High' }[priority]}
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

          <div className="space-y-1.5">
            <Label>Repeat</Label>
            <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="task-reminder-enabled">Reminder</Label>
              <button
                type="button"
                role="checkbox"
                aria-checked={reminderEnabled}
                aria-label="Enable task reminders"
                onClick={() => setReminderEnabled((v) => !v)}
                className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                  reminderEnabled
                    ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
                    : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
                }`}
              >
                {reminderEnabled && (
                  <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
            {reminderEnabled && (
              <div className="space-y-1.5">
                <Label>Remind me</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      {{
                        5: '5 minutes before',
                        10: '10 minutes before',
                        15: '15 minutes before',
                        30: '30 minutes before',
                        60: '1 hour before',
                        120: '2 hours before',
                        1440: '1 day before',
                      }[reminderMinutesBefore as 5 | 10 | 15 | 30 | 60 | 120 | 1440]}
                      <ChevronDownIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                    <DropdownMenuGroup>
                      {reminderMinutesBefore !== 5 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(5)}>5 minutes before</DropdownMenuItem>}
                      {reminderMinutesBefore !== 10 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(10)}>10 minutes before</DropdownMenuItem>}
                      {reminderMinutesBefore !== 15 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(15)}>15 minutes before</DropdownMenuItem>}
                      {reminderMinutesBefore !== 30 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(30)}>30 minutes before</DropdownMenuItem>}
                      {reminderMinutesBefore !== 60 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(60)}>1 hour before</DropdownMenuItem>}
                      {reminderMinutesBefore !== 120 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(120)}>2 hours before</DropdownMenuItem>}
                      {reminderMinutesBefore !== 1440 && <DropdownMenuItem onSelect={() => setReminderMinutesBefore(1440)}>1 day before</DropdownMenuItem>}
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* AI context — only for new tasks */}
          {!task && (
            <div className="space-y-3 rounded-md border border-dashed p-3">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Sparkles className="size-3.5" />
                AI Breakdown (optional)
              </div>
              <div className="space-y-1.5">
                <Label>Describe the assignment</Label>
                <Textarea
                  placeholder="e.g. Write a 10-page research paper on ML ethics with 5+ academic sources..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Attach a file</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,.html,.py,.js,.ts,.tex,.rtf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {fileName ? (
                  <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <Paperclip className="size-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{fileName}</span>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="size-4 mr-1.5" />
                    Choose file
                  </Button>
                )}
              </div>
            </div>
          )}

          {task && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {{ todo: 'To Do', in_progress: 'In Progress', done: 'Done' }[status]}
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuGroup>
                    {status !== 'todo' && <DropdownMenuItem onSelect={() => setStatus('todo')}>To Do</DropdownMenuItem>}
                    {status !== 'in_progress' && <DropdownMenuItem onSelect={() => setStatus('in_progress')}>In Progress</DropdownMenuItem>}
                    {status !== 'done' && <DropdownMenuItem onSelect={() => setStatus('done')}>Done</DropdownMenuItem>}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {task && (
            <SubtaskList
              taskId={task.id}
              courseColor={courses.find((c) => c.id === task.course_id)?.color}
              reorderable
              limit={3}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex justify-between">
          {task && (
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
              {onDecompose && subtasks.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => { onDecompose({ task }); onClose() }}
                >
                  <Sparkles className="size-4 mr-1.5" />
                  Break it down
                </Button>
              )}
            </div>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            {!task && onDecompose && (description || fileContent || fileData) && (
              <Button
                variant="outline"
                onClick={handleSaveAndDecompose}
                disabled={isPending || !title.trim()}
              >
                <Sparkles className="size-4 mr-1.5" />
                {isPending ? 'Saving…' : 'Save & Break Down'}
              </Button>
            )}
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </>
  )
}
