import type { EventInput } from '@fullcalendar/core'
import type { Course, Event, Task } from '@/types/database'

// FullCalendar daysOfWeek uses: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
const DAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** Convert DB events → FullCalendar EventInput[] */
export function dbEventsToFC(events: Event[], courses: Course[]): EventInput[] {
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  return events.map((ev) => {
    const course = ev.course_id ? courseMap.get(ev.course_id) : undefined
    return {
      id: ev.id,
      title: ev.title,
      start: ev.start_time,
      end: ev.end_time ?? undefined,
      allDay: ev.all_day,
      backgroundColor: ev.color ?? course?.color ?? '#6366f1',
      borderColor: ev.color ?? course?.color ?? '#6366f1',
      rrule: ev.recurrence_rule ?? undefined,
      extendedProps: { type: 'event', dbEvent: ev },
    }
  })
}

/** Convert course schedule blocks → FullCalendar EventInput[] (recurring) */
export function courseScheduleToFC(courses: Course[]): EventInput[] {
  const events: EventInput[] = []

  for (const course of courses) {
    for (const block of course.schedule) {
      const dayNum = DAY_MAP[block.day]
      if (dayNum === undefined) continue

      events.push({
        id: `schedule-${course.id}-${block.day}-${block.start}`,
        title: course.name + (block.location ? ` · ${block.location}` : ''),
        startTime: block.start,
        endTime: block.end,
        daysOfWeek: [dayNum],
        backgroundColor: course.color,
        borderColor: course.color,
        extendedProps: { type: 'schedule', courseId: course.id },
      })
    }
  }

  return events
}

/** Convert tasks → FullCalendar all-day EventInput[] on their due date */
export function tasksToFC(tasks: Task[], courses: Course[]): EventInput[] {
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  return tasks
    .filter((t) => t.status !== 'done')
    .map((task) => {
      const course = task.course_id ? courseMap.get(task.course_id) : undefined
      const color = course?.color ?? '#94a3b8'
      return {
        id: `task-${task.id}`,
        title: `📋 ${task.title}`,
        start: task.due_date,
        allDay: true,
        backgroundColor: color + '33',  // 20% opacity
        borderColor: color,
        textColor: '#1e293b',
        extendedProps: { type: 'task', dbTask: task },
      }
    })
}
