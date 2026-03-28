import { useState, useEffect } from 'react'
import { BlockPicker } from 'react-color'
import { format, parse, isValid } from 'date-fns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Clock8Icon } from 'lucide-react'
import { useCourses, useCreateCourse } from '@/hooks/useCourses'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateEvent, useUpdateEvent } from '@/hooks/useEvents'
import { supabase } from '@/lib/supabase'
import { undoableDelete } from '@/lib/undoableDelete'
import { toast } from 'sonner'
import type { Event, EventInsert } from '@/types/database'

const PRESET_COLORS = [
  '#9B0F06', '#b45309', '#FAE251', '#047857',
  '#636CCB', '#E491C9',
]

interface Props {
  open: boolean
  onClose: () => void
  event?: Event
  defaultStart?: Date
  defaultEnd?: Date
  defaultAllDay?: boolean
}

export function EventModal({ open, onClose, event, defaultStart, defaultEnd, defaultAllDay }: Props) {
  const queryClient = useQueryClient()
  const { data: courses = [] } = useCourses()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const createCourse = useCreateCourse()

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string>('none')
  const [addingCourse, setAddingCourse] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseColor, setNewCourseColor] = useState(PRESET_COLORS[0])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>([])
  const [allDay, setAllDay] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState<string>('none')
  const [error, setError] = useState('')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')
  const [startDateOpen, setStartDateOpen] = useState(false)
  const [endDateOpen, setEndDateOpen] = useState(false)

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setCourseId(event.course_id ?? 'none')
      setAllDay(event.all_day)
      const sd = new Date(event.start_time)
      setStartDate(format(sd, 'yyyy-MM-dd'))
      setStartTime(event.all_day ? '00:00' : format(sd, 'HH:mm'))
      if (event.end_time) {
        const ed = new Date(event.end_time)
        setEndDate(format(ed, 'yyyy-MM-dd'))
        setEndTime(event.all_day ? '00:00' : format(ed, 'HH:mm'))
      } else {
        setEndDate('')
        setEndTime('')
      }
      setLocation(event.location ?? '')
      setRecurrence(event.recurrence_rule ?? 'none')
      setAddingCourse(false)
      setNewCourseName('')
      setNewCourseColor(PRESET_COLORS[0])
      setPickerOpen(false)
      setCustomColors([])
    } else {
      setTitle('')
      setCourseId('none')
      setAllDay(defaultAllDay ?? false)
      setStartDate(defaultStart ? format(defaultStart, 'yyyy-MM-dd') : '')
      setStartTime(defaultStart && !defaultAllDay ? format(defaultStart, 'HH:mm') : '')
      setEndDate(defaultEnd ? format(defaultEnd, 'yyyy-MM-dd') : '')
      setEndTime(defaultEnd && !defaultAllDay ? format(defaultEnd, 'HH:mm') : '')
      setLocation('')
      setRecurrence('none')
      setAddingCourse(false)
      setNewCourseName('')
      setNewCourseColor(PRESET_COLORS[0])
      setPickerOpen(false)
      setCustomColors([])
    }
    setError('')
  }, [event, open, defaultStart, defaultEnd, defaultAllDay])

  function buildPayload(): EventInsert {
    const course = courseId === 'none' ? null : courseId
    const startIso = allDay
      ? new Date(startDate + 'T00:00:00').toISOString()
      : new Date(startDate + 'T' + startTime).toISOString()
    const endIso = endDate
      ? (allDay
        ? new Date(endDate + 'T00:00:00').toISOString()
        : new Date(endDate + 'T' + endTime).toISOString())
      : null
    return {
      title: title.trim(),
      course_id: course,
      start_time: startIso,
      end_time: endIso,
      all_day: allDay,
      location: location.trim() || null,
      recurrence_rule: recurrence === 'none' ? null : recurrence,
      color: course ? (courses.find((c) => c.id === course)?.color ?? null) : null,
    }
  }

  async function handleSave() {
    if (!title.trim() || !startDate) return
    try {
      setError('')
      if (event) {
        await updateEvent.mutateAsync({ id: event.id, ...buildPayload() })
        toast.success(`"${title.trim()}" updated`)
      } else {
        await createEvent.mutateAsync(buildPayload())
        toast.success(`"${title.trim()}" created`)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    }
  }

  function handleDelete() {
    if (!event) return
    onClose()
    undoableDelete({
      queryClient,
      queryKey: ['events'],
      items: [event],
      deleteFn: async () => {
        const { error } = await supabase.from('events').delete().eq('id', event.id)
        if (error) throw error
      },
      message: `"${event.title}" deleted`,
    })
  }

  // Sync display strings whenever the underlying date strings change
  useEffect(() => {
    setStartDateInput(startDate ? format(parse(startDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
  }, [startDate])
  useEffect(() => {
    setEndDateInput(endDate ? format(parse(endDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
  }, [endDate])

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

  const startDateParsed = startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined

  function handleStartDateChange(date: Date) {
    const newStart = format(date, 'yyyy-MM-dd')
    setStartDate(newStart)
    if (!endDate || endDate < newStart) setEndDate(newStart)
    if (endDate === newStart && endTime < startTime) setEndTime(startTime)
  }

  function handleStartTimeChange(val: string) {
    setStartTime(val)
    if (startDate && startDate === endDate && endTime < val) setEndTime(val)
  }

  function handleEndDateChange(date: Date) {
    const newEnd = format(date, 'yyyy-MM-dd')
    setEndDate(newEnd)
    if (newEnd === startDate && endTime < startTime) setEndTime(startTime)
  }

  function handleEndTimeChange(val: string) {
    setEndTime(val)
  }

  function clampEndTime() {
    if (startDate === endDate && endTime < startTime) setEndTime(startTime)
  }

  const isPending = createEvent.isPending || updateEvent.isPending

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="Event title"
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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allday"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="allday">All day</Label>
          </div>

          {allDay ? (
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                <div className="relative">
                  <Input
                    placeholder="mm/dd/yyyy"
                    value={startDateInput}
                    onChange={(e) => setStartDateInput(e.target.value)}
                    onBlur={() => {
                      const d = tryParseDate(startDateInput)
                      if (d) setStartDate(format(d, 'yyyy-MM-dd'))
                      else setStartDateInput(startDate ? format(parse(startDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
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
                    selected={startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined}
                    onSelect={(date) => {
                      if (date) { setStartDate(format(date, 'yyyy-MM-dd')); setStartDateOpen(false) }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                  <div className="relative">
                    <Input
                      placeholder="mm/dd/yyyy"
                      value={startDateInput}
                      onChange={(e) => setStartDateInput(e.target.value)}
                      onBlur={() => {
                        const d = tryParseDate(startDateInput)
                        if (d) handleStartDateChange(d)
                        else setStartDateInput(startDate ? format(parse(startDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
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
                      selected={startDate ? parse(startDate, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) { handleStartDateChange(date); setStartDateOpen(false) }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="bg-background appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3">
                    <Clock8Icon className="size-4" />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                  <div className="relative">
                    <Input
                      placeholder="mm/dd/yyyy"
                      value={endDateInput}
                      onChange={(e) => setEndDateInput(e.target.value)}
                      onBlur={() => {
                        const d = tryParseDate(endDateInput)
                        if (d) handleEndDateChange(d)
                        else setEndDateInput(endDate ? format(parse(endDate, 'yyyy-MM-dd', new Date()), 'MMM d, yyyy') : '')
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
                      selected={endDate ? parse(endDate, 'yyyy-MM-dd', new Date()) : undefined}
                      onSelect={(date) => {
                        if (date) { handleEndDateChange(date); setEndDateOpen(false) }
                      }}
                      disabled={startDateParsed ? { before: startDateParsed } : undefined}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <div className="relative">
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    onBlur={clampEndTime}
                    className="bg-background appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                  />
                  <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3">
                    <Clock8Icon className="size-4" />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Location (optional)</Label>
            <Input
              placeholder="e.g. Room 101"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
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

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex justify-between">
          {event && (
            <Button variant="destructive" onClick={handleDelete}>
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

    </>
  )
}
