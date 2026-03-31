import { useState, useEffect, useRef } from 'react'
import { BlockPicker } from 'react-color'
import { format, parse, isValid } from 'date-fns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Sparkles, CalendarIcon, Clock8Icon, Paperclip, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCourses, useCreateCourse } from '@/hooks/useCourses'
import { useCreateTask, useUpdateTask } from '@/hooks/useTasks'
import { useSubtasks } from '@/hooks/useSubtasks'
import { SubtaskList } from '@/components/tasks/SubtaskList'
import { supabase } from '@/lib/supabase'
import { undoableDelete } from '@/lib/undoableDelete'
import { toast } from 'sonner'
import type { Task, TaskInsert } from '@/types/database'

const PRESET_COLORS = [
  '#9B0F06', '#b45309', '#FAE251', '#047857',
  '#636CCB', '#E491C9',
]

export interface DecomposeContext {
  task: Task
  description?: string
  fileContent?: string
  fileName?: string
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
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
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    }
    setAddingCourse(false)
    setNewCourseName('')
    setNewCourseColor(PRESET_COLORS[0])
    setPickerOpen(false)
    setDescription('')
    setFileName('')
    setFileContent('')
    setError('')
  }, [task, open, defaultDueDate])

  useEffect(() => {
    setDueDateInput(dueDate ? format(parse(dueDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
  }, [dueDate])

  function tryParseDate(input: string): Date | null {
    if (!input.trim()) return null
    const ref = new Date()
    const fmts = ['MMM d, yyyy', 'MMMM d, yyyy', 'M/d/yyyy', 'MM/dd/yyyy', 'M/d/yy', 'yyyy-MM-dd', 'MMM d']
    for (const fmt of fmts) {
      const d = parse(input.trim(), fmt, ref)
      if (isValid(d)) return d
    }
    return null
  }

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
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setFileContent(reader.result as string)
    reader.readAsText(file)
  }

  function removeFile() {
    setFileName('')
    setFileContent('')
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
                <div className="flex gap-1.5 flex-wrap items-center">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="size-6 rounded-full"
                      style={{
                        backgroundColor: c,
                        outline: newCourseColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                      onClick={() => { setNewCourseColor(c); setPickerOpen(false) }}
                    />
                  ))}
                  {customColors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="size-6 rounded-full"
                      style={{
                        backgroundColor: c,
                        outline: newCourseColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                      onClick={() => { setNewCourseColor(c); setPickerOpen(false) }}
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
                        <div className="absolute top-8 left-0 z-50">
                          <BlockPicker
                            color={newCourseColor}
                            onChangeComplete={(c) => {
                              setNewCourseColor(c.hex)
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between font-normal">
                    {courseId === 'none' ? 'No course' : courses.find((c) => c.id === courseId)?.name ?? 'No course'}
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuGroup>
                    {courseId !== 'none' && <DropdownMenuItem onSelect={() => setCourseId('none')}>No course</DropdownMenuItem>}
                    {courses.filter((c) => c.id !== courseId).map((c) => (
                      <DropdownMenuItem key={c.id} onSelect={() => setCourseId(c.id)}>{c.name}</DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setAddingCourse(true)}>+ Add course</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal">
                  {{ none: 'Does not repeat', 'FREQ=DAILY': 'Daily', 'FREQ=WEEKLY': 'Weekly', 'FREQ=MONTHLY': 'Monthly' }[recurrence] ?? 'Does not repeat'}
                  <ChevronDownIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                <DropdownMenuGroup>
                  {recurrence !== 'none' && <DropdownMenuItem onSelect={() => setRecurrence('none')}>Does not repeat</DropdownMenuItem>}
                  {recurrence !== 'FREQ=DAILY' && <DropdownMenuItem onSelect={() => setRecurrence('FREQ=DAILY')}>Daily</DropdownMenuItem>}
                  {recurrence !== 'FREQ=WEEKLY' && <DropdownMenuItem onSelect={() => setRecurrence('FREQ=WEEKLY')}>Weekly</DropdownMenuItem>}
                  {recurrence !== 'FREQ=MONTHLY' && <DropdownMenuItem onSelect={() => setRecurrence('FREQ=MONTHLY')}>Monthly</DropdownMenuItem>}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
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
                  accept=".txt,.md,.csv,.json,.html,.py,.js,.ts,.tex,.rtf"
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
                    {{ todo: 'In Progress', in_progress: 'In Progress', done: 'Done' }[status]}
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
                  <DropdownMenuGroup>
                    {status !== 'todo' && status !== 'in_progress' && <DropdownMenuItem onSelect={() => setStatus('todo')}>In Progress</DropdownMenuItem>}
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
            {!task && onDecompose && (description || fileContent) && (
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
