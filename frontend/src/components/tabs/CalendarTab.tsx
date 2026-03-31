import { CalendarView } from '@/components/calendar/CalendarView'
import type { DateSelectArg } from '@fullcalendar/core'
import type { Event, Task, Subtask } from '@/types/database'

interface Props {
  onDateSelect: (arg: DateSelectArg) => void
  onEventClick: (event: Event) => void
  onTaskClick: (task: Task) => void
  onSubtaskClick: (subtask: Subtask) => void
  onNewTodo: () => void
}

export function CalendarTab({ onDateSelect, onEventClick, onTaskClick, onSubtaskClick, onNewTodo }: Props) {
  return (
    <div className="h-full">
      <CalendarView
        onDateSelect={onDateSelect}
        onEventClick={onEventClick}
        onTaskClick={onTaskClick}
        onSubtaskClick={onSubtaskClick}
        onNewTodo={onNewTodo}
      />
    </div>
  )
}
