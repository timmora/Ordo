import { CalendarView } from '@/components/calendar/CalendarView'
import type { DateSelectArg } from '@fullcalendar/core'
import type { Event, Task } from '@/types/database'

interface Props {
  onDateSelect: (arg: DateSelectArg) => void
  onEventClick: (event: Event) => void
  onTaskClick: (task: Task) => void
}

export function CalendarTab({ onDateSelect, onEventClick, onTaskClick }: Props) {
  return (
    <div className="h-full max-w-7xl mx-auto">
      <CalendarView
        onDateSelect={onDateSelect}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
      />
    </div>
  )
}
