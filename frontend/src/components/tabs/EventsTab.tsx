import { useMemo, useState } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useCourses } from '@/hooks/useCourses'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon, CalendarPlus } from 'lucide-react'
import type { Event } from '@/types/database'

type FilterTab = 'upcoming' | 'past' | 'all'

interface Props {
  onEventClick: (event: Event) => void
  onNewEvent: () => void
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function EventsTab({ onEventClick, onNewEvent }: Props) {
  const { data: events = [] } = useEvents()
  const { data: courses = [] } = useCourses()

  const [filterTab, setFilterTab] = useState<FilterTab>('upcoming')
  const [courseFilter, setCourseFilter] = useState<string>('all')

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses],
  )

  const filtered = useMemo(() => {
    const today = todayStr()

    return events.filter((e) => {
      const eventDate = e.start_time.slice(0, 10)
      if (filterTab === 'upcoming' && eventDate < today) return false
      if (filterTab === 'past' && eventDate >= today) return false
      if (courseFilter !== 'all' && e.course_id !== courseFilter) return false
      return true
    })
  }, [events, filterTab, courseFilter])

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="space-y-4 py-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        <Button size="sm" onClick={onNewEvent}>
          <CalendarPlus className="size-4 mr-1.5" />
          New Event
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tab filter */}
        <div className="flex rounded-md border overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filterTab === tab.id
                  ? 'bg-foreground text-background'
                  : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Course filter */}
        {courses.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="w-40 justify-between font-normal text-sm">
                {courseFilter === 'all' ? 'All courses' : courses.find((c) => c.id === courseFilter)?.name ?? 'All courses'}
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuGroup>
                {courseFilter !== 'all' && <DropdownMenuItem onSelect={() => setCourseFilter('all')}>All courses</DropdownMenuItem>}
                {courses.filter((c) => c.id !== courseFilter).map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => setCourseFilter(c.id)}>{c.name}</DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No events match your filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const course = event.course_id ? courseMap[event.course_id] : null
            const eventDate = event.start_time.slice(0, 10)

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer"
                onClick={() => onEventClick(event)}
              >
                {/* Course color dot */}
                {course && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: course.color }}
                  />
                )}

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{event.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {course && (
                      <span className="text-xs text-muted-foreground">{course.name}</span>
                    )}
                    {event.location && (
                      <span className="text-xs text-muted-foreground">· {event.location}</span>
                    )}
                    {event.recurrence_rule && (
                      <span className="text-xs text-muted-foreground">· Recurring</span>
                    )}
                  </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-muted-foreground">
                    {formatDate(eventDate)}
                  </span>
                  {!event.all_day && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatTime(event.start_time)}
                    </span>
                  )}
                  {event.all_day && (
                    <span className="text-xs text-muted-foreground">All day</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
