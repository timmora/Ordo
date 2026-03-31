import type { EventInput } from '@fullcalendar/core'
import type { Course, Event, Task, Subtask } from '@/types/database'

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
    const color = ev.color ?? course?.color ?? '#6366f1'

    // Recurring events need rrule object with dtstart; non-recurring use start/end
    if (ev.recurrence_rule) {
      const dtstart = ev.start_time
      // Calculate duration if end_time exists
      const duration = ev.end_time
        ? { milliseconds: new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime() }
        : undefined
      return {
        id: ev.id,
        title: ev.title,
        allDay: ev.all_day,
        backgroundColor: color,
        borderColor: color,
        rrule: {
          freq: ev.recurrence_rule.replace('FREQ=', '').toLowerCase(),
          dtstart,
        },
        duration: duration
          ? `${String(Math.floor(duration.milliseconds / 3600000)).padStart(2, '0')}:${String(Math.floor((duration.milliseconds % 3600000) / 60000)).padStart(2, '0')}`
          : undefined,
        extendedProps: { type: 'event', dbEvent: ev },
      }
    }

    return {
      id: ev.id,
      title: ev.title,
      start: ev.start_time,
      end: ev.end_time ?? undefined,
      allDay: ev.all_day,
      backgroundColor: color,
      borderColor: color,
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
        editable: false,
        extendedProps: { type: 'schedule', courseId: course.id },
      })
    }
  }

  return events
}

/** Convert tasks → FullCalendar all-day EventInput[] on their due date */
export function tasksToFC(tasks: Task[], courses: Course[]): EventInput[] {
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  return tasks.filter((task) => !!task.due_date).map((task) => {
      const course = task.course_id ? courseMap.get(task.course_id) : undefined
      const color = course?.color ?? '#94a3b8'
      const hasTime = !!task.due_time
      const lateNight = hasTime && task.due_time! >= '23:30' // 11:30 PM+
      // Shift late-night tasks earlier so they don't get cut off at the bottom
      const start = hasTime
        ? lateNight ? `${task.due_date}T23:30` : `${task.due_date}T${task.due_time}`
        : task.due_date

      // Recurring tasks use rrule (same pattern as events)
      if (task.recurrence_rule) {
        const dtstart = hasTime ? `${task.due_date}T${task.due_time}` : task.due_date
        return {
          id: `task-${task.id}`,
          title: task.title,
          allDay: !hasTime,
          backgroundColor: color,
          borderColor: color,
          textColor: '#fff',
          rrule: {
            freq: task.recurrence_rule.replace('FREQ=', '').toLowerCase(),
            dtstart,
          },
          extendedProps: { type: 'task', dbTask: task },
        }
      }

      return {
        id: `task-${task.id}`,
        title: task.title,
        start,
        end: lateNight ? `${task.due_date}T23:59` : undefined,
        allDay: !hasTime,
        backgroundColor: color,
        borderColor: color,
        textColor: '#fff',
        extendedProps: { type: 'task', dbTask: task },
      }
    })
}

/** Convert scheduled subtasks → FullCalendar time-block EventInput[] */
export function scheduledSubtasksToFC(
  subtasks: Subtask[],
  tasks: Task[],
  courses: Course[],
): EventInput[] {
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const courseMap = new Map(courses.map((c) => [c.id, c]))

  return subtasks
    .filter((s) => s.scheduled_start && s.scheduled_end)
    .map((s) => {
      const task = taskMap.get(s.task_id)
      const course = task?.course_id ? courseMap.get(task.course_id) : undefined
      const color = course?.color ?? '#94a3b8'
      const done = s.status === 'complete'

      return {
        id: `subtask-${s.id}`,
        title: done ? `\u2713 ${s.title}` : s.title,
        start: s.scheduled_start!,
        end: s.scheduled_end!,
        backgroundColor: done ? color + '15' : color + '40',
        borderColor: done ? color + '60' : color,
        textColor: done ? color + '80' : color,
        extendedProps: { type: 'subtask', dbSubtask: s, dbTask: task, parentTaskTitle: task?.title ?? '' },
      }
    })
}
