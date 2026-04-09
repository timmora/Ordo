import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import rrulePlugin from '@fullcalendar/rrule'
import multiMonthPlugin from '@fullcalendar/multimonth'
import type { DateSelectArg, EventClickArg, EventContentArg, EventDropArg } from '@fullcalendar/core'
import type { EventReceiveArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { useCourses } from '@/hooks/useCourses'
import { useEvents, useUpdateEvent } from '@/hooks/useEvents'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useAllSubtasks, useUpdateSubtask } from '@/hooks/useSubtasks'
import { dbEventsToFC, courseScheduleToFC, tasksToFC, scheduledSubtasksToFC } from '@/lib/calendarUtils'
import { CalendarTabSkeleton } from '@/components/skeletons'
import type { Event, Task, Subtask } from '@/types/database'
import { useMemo, useRef, useEffect, useState } from 'react'
import { CalendarDays, List, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { priorityVariant } from '@/lib/dateUtils'
import { InlineEmptyState } from '@/components/shared/InlineEmptyState'
import { RowEditAction } from '@/components/shared/RowEditAction'
import { RowMetaGroup, RowMetaText } from '@/components/shared/RowMeta'

type ViewMode = 'calendar' | 'list'

const VIEW_OPTIONS = [
  { value: 'timeGridDay', label: 'Day' },
  { value: 'timeGrid3Day', label: '3 Days' },
  { value: 'timeGridWeek', label: 'Week' },
  { value: 'dayGridMonth', label: 'Month' },
  { value: 'multiMonthYear', label: 'Year' },
]

interface CalendarViewProps {
  onDateSelect: (arg: DateSelectArg) => void
  onEventClick: (event: Event) => void
  onTaskClick: (task: Task) => void
  onSubtaskClick: (subtask: Subtask) => void
  onNewTodo: () => void
}

export function CalendarView({ onDateSelect, onEventClick, onTaskClick, onSubtaskClick, onNewTodo }: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [calendarView, setCalendarView] = useState('timeGridWeek')
  const [calendarTitle, setCalendarTitle] = useState('')
  const [showRecentDone, setShowRecentDone] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => calendarRef.current?.getApi().updateSize())
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { data: courses = [], isLoading: coursesLoading } = useCourses()
  const { data: events = [], isLoading: eventsLoading } = useEvents()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: allSubtasksMap } = useAllSubtasks()
  const updateTask = useUpdateTask()
  const updateSubtask = useUpdateSubtask()
  const updateEvent = useUpdateEvent()

  const allSubtasks = useMemo(
    () => Array.from(allSubtasksMap?.values() ?? []).flat(),
    [allSubtasksMap],
  )

  const fcEvents = useMemo(() => [
    ...dbEventsToFC(events, courses),
    ...courseScheduleToFC(courses),
    ...tasksToFC(tasks, courses),
    ...scheduledSubtasksToFC(allSubtasks, tasks, courses),
  ], [events, courses, tasks, allSubtasks])

  const courseMap = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  )

  const unscheduledTasks = useMemo(
    () => tasks.filter((t) => !t.due_date && t.status !== 'done'),
    [tasks],
  )
  const recentDoneTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.due_date && t.status === 'done')
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [tasks],
  )
  const unscheduledSubtasks = useMemo(
    () => allSubtasks.filter((s) => s.status !== 'complete' && (s.is_todo || !s.scheduled_start || !s.scheduled_end)),
    [allSubtasks],
  )
  const recentDoneSubtasks = useMemo(
    () =>
      allSubtasks
        .filter((s) => s.status === 'complete' && (s.is_todo || !s.scheduled_start || !s.scheduled_end))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 5),
    [allSubtasks],
  )
  const taskMap = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  )

  function changeView(view: string) {
    setCalendarView(view)
    calendarRef.current?.getApi().changeView(view)
  }

  function handleEventClick(arg: EventClickArg) {
    const { type, dbEvent, dbTask, dbSubtask } = arg.event.extendedProps as {
      type: string
      dbEvent?: Event
      dbTask?: Task
      dbSubtask?: Subtask
    }

    // Centralise toggle here — FullCalendar's event-level hit-test determines which event was
    // clicked, avoiding misfires when tiny checkbox buttons from adjacent events are close together.
    const isCheckbox = !!(arg.jsEvent.target as HTMLElement).closest('[data-role="checkbox"]')
    if (isCheckbox) {
      if (type === 'task' && dbTask) {
        updateTask.mutate({ id: dbTask.id, status: dbTask.status === 'done' ? 'todo' : 'done' })
      } else if (type === 'subtask' && dbSubtask) {
        updateSubtask.mutate({ id: dbSubtask.id, status: dbSubtask.status === 'complete' ? 'pending' : 'complete' })
      }
      return
    }

    if (type === 'event' && dbEvent) onEventClick(dbEvent)
    if (type === 'task' && dbTask) onTaskClick(dbTask)
    if (type === 'subtask' && dbSubtask) onSubtaskClick(dbSubtask)
  }

  function handleEventDrop(arg: EventDropArg) {
    const { type, dbTask, dbSubtask, dbEvent } = arg.event.extendedProps as {
      type: string; dbTask?: Task; dbSubtask?: Subtask; dbEvent?: Event
    }
    if (type === 'task' && dbTask) {
      const newDate = arg.event.startStr.slice(0, 10)
      const newTime = arg.event.allDay ? null : arg.event.startStr.slice(11, 16)
      updateTask.mutate({ id: dbTask.id, due_date: newDate, due_time: newTime || null })
    }
    if (type === 'subtask' && dbSubtask) {
      updateSubtask.mutate({
        id: dbSubtask.id,
        scheduled_start: arg.event.startStr,
        scheduled_end: arg.event.endStr ?? undefined,
        is_todo: false,
      })
    }
    if (type === 'event' && dbEvent) {
      updateEvent.mutate({ id: dbEvent.id, start_time: arg.event.startStr, end_time: arg.event.endStr ?? null })
    }
    arg.revert()
  }

  function handleEventResize(arg: EventResizeDoneArg) {
    const { type, dbSubtask, dbEvent } = arg.event.extendedProps as {
      type: string; dbSubtask?: Subtask; dbEvent?: Event
    }
    if (type === 'subtask' && dbSubtask) {
      updateSubtask.mutate({ id: dbSubtask.id, scheduled_end: arg.event.endStr ?? undefined })
    }
    if (type === 'event' && dbEvent) {
      updateEvent.mutate({ id: dbEvent.id, end_time: arg.event.endStr ?? null })
    }
    arg.revert()
  }

  function handleEventReceive(arg: EventReceiveArg) {
    const { dbTask } = arg.event.extendedProps as { dbTask?: Task }
    if (dbTask) {
      const newDate = arg.event.startStr.slice(0, 10)
      const newTime = arg.event.allDay ? null : arg.event.startStr.slice(11, 16)
      updateTask.mutate({ id: dbTask.id, due_date: newDate, due_time: newTime || null })
    }
    arg.revert()
  }

  function renderEventContent(arg: EventContentArg) {
    const { type, dbTask, dbSubtask } = arg.event.extendedProps as {
      type: string
      dbTask?: Task
      dbSubtask?: Subtask
    }

    if (type === 'subtask' && dbSubtask) {
      const subDone = dbSubtask.status === 'complete'
      const borderCol = arg.event.borderColor || '#94a3b8'
      const parentTitle = (arg.event.extendedProps as { parentTaskTitle?: string }).parentTaskTitle
      return (
        <div className="relative flex flex-col h-full overflow-hidden pl-3 pr-1 py-px">
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: borderCol }} />
          <div className="flex items-center gap-1 overflow-hidden min-h-0">
            <button
              type="button"
              data-role="checkbox"
              className="w-3 h-3 rounded shrink-0 flex items-center justify-center"
              style={{
                borderWidth: '1.5px',
                borderStyle: 'solid',
                borderColor: borderCol,
                backgroundColor: subDone ? borderCol : 'transparent',
              }}
            >
              {subDone && (
                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <span className={`truncate text-xs text-white ${subDone ? 'line-through opacity-50' : ''}`}>
              {dbSubtask.title}
            </span>
          </div>
          {parentTitle && (
            <span className="truncate leading-none mt-px text-white/60" style={{ fontSize: '9px' }}>
              {parentTitle}
            </span>
          )}
        </div>
      )
    }

    if (type === 'task' && dbTask) {
      const done = dbTask.status === 'done'
      const borderCol = arg.event.borderColor || '#94a3b8'
      return (
        <div className="flex items-center gap-1 px-1 overflow-hidden">
          <button
            type="button"
            data-role="checkbox"
            className="w-3 h-3 rounded shrink-0 flex items-center justify-center"
            style={{
              borderWidth: '1.5px',
              borderStyle: 'solid',
              borderColor: 'white',
              backgroundColor: done ? 'white' : 'transparent',
            }}
          >
            {done && (
              <svg className="w-2 h-2" style={{ color: borderCol }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className={`truncate text-xs text-white ${done ? 'line-through opacity-50' : ''}`}>
            {arg.event.title}
          </span>
        </div>
      )
    }

    return (
      <div className="fc-event-main-frame px-1 overflow-hidden">
        {arg.timeText && (
          <span className="fc-event-time">{arg.timeText.replace(/\s*[-–]\s*$/, '')} </span>
        )}
        <span className="fc-event-title truncate">{arg.event.title}</span>
      </div>
    )
  }

  const currentViewLabel = VIEW_OPTIONS.find((v) => v.value === calendarView)?.label ?? 'Week'

  if (coursesLoading || eventsLoading || tasksLoading) return <CalendarTabSkeleton />

  const viewToggle = (
    <button
      type="button"
      className="fc-button fc-button-primary shrink-0"
      style={{ borderRadius: '9999px', padding: '0.4em 0.75em', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '0.55em' }}
      onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
      aria-label={viewMode === 'calendar' ? 'Switch to list view' : 'Switch to calendar view'}
    >
      <CalendarDays className={`size-4 ${viewMode !== 'calendar' ? 'opacity-40' : ''}`} />
      <span className="w-px self-stretch bg-current opacity-30" />
      <List className={`size-4 ${viewMode !== 'list' ? 'opacity-40' : ''}`} />
    </button>
  )

  return (
    <div ref={containerRef} className="h-full flex flex-col fc-custom">

      {/* ── CUSTOM TOOLBAR — always in normal flow, never shifts position ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center shrink-0 min-w-0" style={{ marginBottom: '1.5em' }}>

        {/* Left */}
        <div className="flex items-center gap-2">
          {viewMode === 'calendar' ? (
            <button
              type="button"
              className="fc-button fc-button-primary shrink-0"
              onClick={() => calendarRef.current?.getApi().today()}
              aria-label="Go to today"
            >
              Today
            </button>
          ) : (
            <button
              type="button"
              className="fc-button fc-button-primary shrink-0 flex items-center gap-1"
              onClick={onNewTodo}
                aria-label="Add to-do task"
            >
              Add
              <Plus className="size-4" />
            </button>
          )}
        </div>

        {/* Center: arrows flanking the title (calendar), or plain title (list) */}
        <div className="flex items-center justify-center gap-1">
          {viewMode === 'calendar' && (
            <button
              type="button"
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => calendarRef.current?.getApi().prev()}
              aria-label="Previous"
            >
              <ChevronLeft className="size-5" />
            </button>
          )}
          <h2 className="min-w-0 truncate font-bold" style={{ fontSize: '1.75em', margin: 0 }}>
            {viewMode === 'calendar' ? calendarTitle : 'To-do'}
          </h2>
          {viewMode === 'calendar' && (
            <button
              type="button"
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => calendarRef.current?.getApi().next()}
              aria-label="Next"
            >
              <ChevronRight className="size-5" />
            </button>
          )}
        </div>

        {/* Right: dropdown (calendar only) + split toggle */}
        <div className="flex items-center gap-2 justify-end">
          {viewMode === 'calendar' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Choose calendar range" className="fc-button fc-button-primary shrink-0 flex items-center gap-1">
                  {currentViewLabel}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {VIEW_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onSelect={() => changeView(opt.value)}
                      className={calendarView === opt.value ? 'font-medium' : ''}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {viewToggle}
        </div>
      </div>

      {/* ── CALENDAR CONTENT ── */}
      {viewMode === 'calendar' && (
        <div className="flex-1 min-h-0 [&_.fc]:h-full [&_.fc-view-harness]:rounded-lg [&_.fc-view-harness]:overflow-hidden [&_.fc-scrollgrid]:rounded-lg">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin]}
            initialView={calendarView}
            views={{ timeGrid3Day: { type: 'timeGrid', duration: { days: 3 } } }}
            headerToolbar={false}
            datesSet={(info) => setCalendarTitle(info.view.title)}
            height="100%"
            selectable
            selectMirror
            editable
            droppable
            eventAllow={(_dropInfo, movingEvent) => {
              const t = movingEvent?.extendedProps?.type
              return t === 'task' || t === 'subtask' || t === 'event'
            }}
            dayMaxEvents={3}
            nowIndicator
            select={onDateSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventReceive={handleEventReceive}
            eventContent={renderEventContent}
            events={fcEvents}
            slotMinTime="00:00:00"
            slotMaxTime="24:00:00"
            allDaySlot
            eventDisplay="block"
            slotEventOverlap={false}
            nextDayThreshold="00:00:00"
            defaultTimedEventDuration="00:30:00"
          />
        </div>
      )}

      {/* ── LIST CONTENT ── */}
      {viewMode === 'list' && (
        <div className="flex-1 min-h-0 flex justify-center overflow-y-auto py-4">
          <div className="w-full max-w-2xl bg-card border rounded-xl shadow-sm p-4 space-y-1.5 h-fit">
            {unscheduledTasks.length === 0 && unscheduledSubtasks.length === 0 ? (
              <div className="py-8">
                <InlineEmptyState message="No unscheduled tasks." actionLabel="Add one" onAction={onNewTodo} />
              </div>
            ) : (
              <>
                {unscheduledTasks.map((task) => {
                  const course = task.course_id ? courseMap.get(task.course_id) : null
                  const done = task.status === 'done'
                  return (
                    <div
                      key={task.id}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`Mark "${task.title}" as ${done ? 'incomplete' : 'complete'}`}
                        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                          done
                            ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
                            : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
                        }`}
                        onClick={() => updateTask.mutate({ id: task.id, status: done ? 'todo' : 'done' })}
                      >
                        {done && (
                          <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                      </button>
                      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onTaskClick(task)}>
                        <div className="flex items-center gap-3">
                          {course && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: course.color }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {course && <p className="text-xs text-muted-foreground">{course.name}</p>}
                          </div>
                        </div>
                      </button>
                      <RowMetaGroup>
                        {task.estimated_hours && (
                          <RowMetaText>{task.estimated_hours}h</RowMetaText>
                        )}
                        <Badge variant={priorityVariant(task.priority)} className="text-xs shrink-0">{task.priority}</Badge>
                        <RowEditAction onClick={(_e) => onTaskClick(task)} />
                      </RowMetaGroup>
                    </div>
                  )
                })}
                {unscheduledSubtasks.map((subtask) => {
                  const parent = taskMap.get(subtask.task_id)
                  const course = parent?.course_id ? courseMap.get(parent.course_id) : null
                  const done = subtask.status === 'complete'
                  return (
                    <div key={subtask.id} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`Mark subtask "${subtask.title}" as ${done ? 'incomplete' : 'complete'}`}
                        className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 ${
                          done
                            ? 'bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500'
                            : 'border-muted-foreground hover:border-green-500 dark:hover:border-emerald-400'
                        }`}
                        onClick={() => updateSubtask.mutate({ id: subtask.id, status: done ? 'pending' : 'complete' })}
                      >
                        {done && <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>}
                      </button>
                      <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onSubtaskClick(subtask)}>
                        <div className="flex items-center gap-3">
                          {course && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: course.color }} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{subtask.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{parent?.title ?? 'Subtask'}</p>
                          </div>
                        </div>
                      </button>
                      <RowMetaGroup>
                        {parent && (
                          <Badge variant={priorityVariant(parent.priority)} className="text-xs">
                            {parent.priority}
                          </Badge>
                        )}
                        <RowMetaText>{subtask.estimated_minutes}m</RowMetaText>
                        <RowEditAction onClick={(_e) => onSubtaskClick(subtask)} />
                      </RowMetaGroup>
                    </div>
                  )
                })}
              </>
            )}
            {(recentDoneTasks.length > 0 || recentDoneSubtasks.length > 0) && (
              <div className="pt-3 mt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecentDone((v) => !v)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showRecentDone ? 'Hide recent done' : 'Show recent done'}
                </button>
                {showRecentDone && (
                  <div className="space-y-1.5 mt-2">
                    {recentDoneTasks.map((task) => {
                      const course = task.course_id ? courseMap.get(task.course_id) : null
                      return (
                        <div
                          key={`done-task-${task.id}`}
                          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left opacity-70"
                        >
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked
                            aria-label={`Mark "${task.title}" as incomplete`}
                            className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500"
                            onClick={() => updateTask.mutate({ id: task.id, status: 'todo' })}
                          >
                            <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </span>
                          </button>
                          <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onTaskClick(task)}>
                            <div className="flex items-center gap-3">
                              {course && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: course.color }} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate line-through text-muted-foreground">{task.title}</p>
                                {course && <p className="text-xs text-muted-foreground">{course.name}</p>}
                              </div>
                            </div>
                          </button>
                          <RowMetaGroup>
                            {task.estimated_hours && (
                              <RowMetaText>{task.estimated_hours}h</RowMetaText>
                            )}
                            <Badge variant={priorityVariant(task.priority)} className="text-xs shrink-0">{task.priority}</Badge>
                            <RowEditAction onClick={(_e) => onTaskClick(task)} />
                          </RowMetaGroup>
                        </div>
                      )
                    })}
                    {recentDoneSubtasks.map((subtask) => {
                      const parent = taskMap.get(subtask.task_id)
                      const course = parent?.course_id ? courseMap.get(parent.course_id) : null
                      return (
                        <div key={`done-subtask-${subtask.id}`} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors text-left opacity-70">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked
                            aria-label={`Mark subtask "${subtask.title}" as incomplete`}
                            className="w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all duration-200 bg-green-500 dark:bg-emerald-500 border-green-500 dark:border-emerald-500"
                            onClick={() => updateSubtask.mutate({ id: subtask.id, status: 'pending' })}
                          >
                            <span className="animate-in fade-in-0 zoom-in-75 duration-150 flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></span>
                          </button>
                          <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onSubtaskClick(subtask)}>
                            <div className="flex items-center gap-3">
                              {course && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: course.color }} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate line-through text-muted-foreground">{subtask.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{parent?.title ?? 'Subtask'}</p>
                              </div>
                            </div>
                          </button>
                          <RowMetaGroup>
                            {parent && (
                              <Badge variant={priorityVariant(parent.priority)} className="text-xs">
                                {parent.priority}
                              </Badge>
                            )}
                            <RowMetaText>{subtask.estimated_minutes}m</RowMetaText>
                            <RowEditAction onClick={(_e) => onSubtaskClick(subtask)} />
                          </RowMetaGroup>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
