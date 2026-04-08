import { useState, useEffect } from 'react'
import { format, parse } from 'date-fns'
import { tryParseDate } from '@/lib/dateUtils'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { CalendarIcon, Clock8Icon, ChevronDownIcon } from 'lucide-react'
import { ColorPickerField, PRESET_COLORS } from '@/components/shared/ColorPickerField'
import { CourseDropdown } from '@/components/shared/CourseDropdown'
import { RecurrenceSelect } from '@/components/shared/RecurrenceSelect'
import { useCourses, useCreateCourse } from '@/hooks/useCourses'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateEvent, useUpdateEvent } from '@/hooks/useEvents'
import { supabase } from '@/lib/supabase'
import { undoableDelete } from '@/lib/undoableDelete'
import { toast } from 'sonner'
import type { Event, EventInsert } from '@/types/database'

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
  const [allDay, setAllDay] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState<string>('none')
  const [error, setError] = useState('')
  const [reminderEnabled, setReminderEnabled] = useState(false)
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState<number>(30)
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
      setReminderEnabled(event.reminder_enabled ?? false)
      setReminderMinutesBefore(event.reminder_minutes_before ?? 30)
      setAddingCourse(false)
      setNewCourseName('')
      setNewCourseColor(PRESET_COLORS[0])
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
      setReminderEnabled(false)
      setReminderMinutesBefore(30)
      setAddingCourse(false)
      setNewCourseName('')
      setNewCourseColor(PRESET_COLORS[0])
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
      reminder_enabled: reminderEnabled,
      reminder_minutes_before: reminderEnabled ? reminderMinutesBefore : null,
      reminder_last_sent_at: null,
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
            <RecurrenceSelect value={recurrence} onChange={setRecurrence} />
          </div>

          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="event-reminder-enabled">Reminder</Label>
              <button
                type="button"
                role="checkbox"
                aria-checked={reminderEnabled}
                aria-label="Enable event reminders"
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
