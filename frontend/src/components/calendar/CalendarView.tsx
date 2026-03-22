import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import rrulePlugin from '@fullcalendar/rrule'
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core'
import { useCourses } from '@/hooks/useCourses'
import { useEvents } from '@/hooks/useEvents'
import { useTasks } from '@/hooks/useTasks'
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

  return (
    <div className="h-full [&_.fc]:h-full [&_.fc-view-harness]:flex-1 fc-custom">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'today',
          center: 'prev title next',
          right: 'dayGridMonth,timeGridWeek',
        }}
        buttonText={{
          today: 'Today',
          month: 'Month',
          week: 'Week',
        }}
        height="100%"
        selectable
        selectMirror
        dayMaxEvents={3}
        nowIndicator
        select={onDateSelect}
        eventClick={handleEventClick}
        events={fcEvents}
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        allDaySlot
        eventDisplay="block"
      />
    </div>
  )
}
