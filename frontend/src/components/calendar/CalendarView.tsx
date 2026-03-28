import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import rrulePlugin from '@fullcalendar/rrule'
import multiMonthPlugin from '@fullcalendar/multimonth'
import type { DateSelectArg, EventClickArg, EventContentArg } from '@fullcalendar/core'
import { useCourses } from '@/hooks/useCourses'
import { useEvents } from '@/hooks/useEvents'
import { useTasks, useUpdateTask } from '@/hooks/useTasks'
import { useAllSubtasks, useUpdateSubtask } from '@/hooks/useSubtasks'
import { dbEventsToFC, courseScheduleToFC, tasksToFC, scheduledSubtasksToFC } from '@/lib/calendarUtils'
import { CalendarTabSkeleton } from '@/components/skeletons'
import type { Event, Task, Subtask } from '@/types/database'
import { useMemo } from 'react'
import { Calendar } from 'lucide-react'

interface CalendarViewProps {
  onDateSelect: (arg: DateSelectArg) => void
  onEventClick: (event: Event) => void
  onTaskClick: (task: Task) => void
  onSubtaskClick: (subtask: Subtask) => void
}

export function CalendarView({ onDateSelect, onEventClick, onTaskClick, onSubtaskClick }: CalendarViewProps) {
  const { data: courses = [], isLoading: coursesLoading } = useCourses()
  const { data: events = [], isLoading: eventsLoading } = useEvents()
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: allSubtasksMap } = useAllSubtasks()
  const updateTask = useUpdateTask()
  const updateSubtask = useUpdateSubtask()

  const allSubtasks = useMemo(
    () => Array.from(allSubtasksMap?.values() ?? []).flat(),
    [allSubtasksMap],
  )

  const fcEvents = [
    ...dbEventsToFC(events, courses),
    ...courseScheduleToFC(courses),
    ...tasksToFC(tasks, courses),
    ...scheduledSubtasksToFC(allSubtasks, tasks, courses),
  ]

  function handleEventClick(arg: EventClickArg) {
    const { type, dbEvent, dbTask, dbSubtask } = arg.event.extendedProps as {
      type: string
      dbEvent?: Event
      dbTask?: Task
      dbSubtask?: Subtask
    }
    if (type === 'event' && dbEvent) onEventClick(dbEvent)
    if (type === 'task' && dbTask) onTaskClick(dbTask)
    if (type === 'subtask' && dbSubtask) onSubtaskClick(dbSubtask)
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
          {/* Inset colored bar — clipped by overflow:hidden so it never overflows the event block */}
          <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: borderCol }} />
          <div className="flex items-center gap-1 overflow-hidden min-h-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                updateSubtask.mutate({ id: dbSubtask.id, status: subDone ? 'pending' : 'complete' })
              }}
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
            onClick={(e) => {
              e.stopPropagation()
              updateTask.mutate({ id: dbTask.id, status: done ? 'todo' : 'done' })
            }}
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
        {arg.timeText && <span className="fc-event-time">{arg.timeText} </span>}
        <span className="fc-event-title truncate">{arg.event.title}</span>
      </div>
    )
  }

  if (coursesLoading || eventsLoading || tasksLoading) return <CalendarTabSkeleton />

  const hasContent = fcEvents.length > 0

  return (
    <div className="h-full flex flex-col relative [&_.fc]:flex-1 [&_.fc]:min-h-0 [&_.fc-view-harness]:flex-1 [&_.fc-view-harness]:rounded-lg [&_.fc-view-harness]:overflow-hidden [&_.fc-scrollgrid]:rounded-lg fc-custom">
      {courses.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-1 pb-2 text-xs text-muted-foreground">
          {courses.map((c) => (
            <span key={c.id} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              {c.name}
            </span>
          ))}
        </div>
      )}
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin, multiMonthPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'today',
          center: 'prev title next',
          right: 'multiMonthYear,dayGridMonth,timeGridWeek',
        }}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
          year: 'Year',
        }}
        height="100%"
        selectable
        selectMirror
        dayMaxEvents={3}
        nowIndicator
        select={onDateSelect}
        eventClick={handleEventClick}
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
      {!hasContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
          <Calendar className="size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No events yet</p>
          <p className="text-xs text-muted-foreground/60">Click any time slot to create one</p>
        </div>
      )}
    </div>
  )
}
