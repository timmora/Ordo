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
import { dbEventsToFC, courseScheduleToFC, tasksToFC } from '@/lib/calendarUtils'
import type { Event, Task } from '@/types/database'

interface CalendarViewProps {
  onDateSelect: (arg: DateSelectArg) => void
  onEventClick: (event: Event) => void
  onTaskClick: (task: Task) => void
}

export function CalendarView({ onDateSelect, onEventClick, onTaskClick }: CalendarViewProps) {
  const { data: courses = [] } = useCourses()
  const { data: events = [] } = useEvents()
  const { data: tasks = [] } = useTasks()
  const updateTask = useUpdateTask()

  const fcEvents = [
    ...dbEventsToFC(events, courses),
    ...courseScheduleToFC(courses),
    ...tasksToFC(tasks, courses),
  ]

  function handleEventClick(arg: EventClickArg) {
    const { type, dbEvent, dbTask } = arg.event.extendedProps as {
      type: string
      dbEvent?: Event
      dbTask?: Task
    }
    if (type === 'event' && dbEvent) onEventClick(dbEvent)
    if (type === 'task' && dbTask) onTaskClick(dbTask)
  }

  function renderEventContent(arg: EventContentArg) {
    const { type, dbTask } = arg.event.extendedProps as {
      type: string
      dbTask?: Task
    }

    if (type === 'task' && dbTask) {
      const done = dbTask.status === 'done'
      return (
        <div className="flex items-center gap-1.5 px-1 overflow-hidden">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const btn = e.currentTarget
              if (!done) {
                btn.style.backgroundColor = 'white'
                btn.style.borderWidth = '2px'
              } else {
                btn.style.backgroundColor = ''
              }
              updateTask.mutate({ id: dbTask.id, status: done ? 'todo' : 'done' })
            }}
            className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center transition-all"
            style={{
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'white',
              backgroundColor: done ? 'white' : undefined,
            }}
            onMouseEnter={(e) => { if (!done) e.currentTarget.style.borderWidth = '4px' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderWidth = '2px' }}
          >
            {done && (
              <svg className="w-2.5 h-2.5" style={{ color: arg.event.borderColor || '#94a3b8' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <span className={`truncate text-xs text-white ${done ? 'line-through opacity-60' : ''}`}>{arg.event.title}</span>
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

  return (
    <div className="h-full [&_.fc]:h-full [&_.fc-view-harness]:flex-1 [&_.fc-view-harness]:rounded-lg [&_.fc-view-harness]:overflow-hidden [&_.fc-scrollgrid]:rounded-lg fc-custom">
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
        nextDayThreshold="00:00:00"
        defaultTimedEventDuration="00:30:00"
      />
    </div>
  )
}
