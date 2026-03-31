import { useMemo, useState } from 'react'
import { useEvents } from '@/hooks/useEvents'
import { useCourses } from '@/hooks/useCourses'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon, CalendarPlus, Trash2, X } from 'lucide-react'
import { relativeDueLabel, todayStr, formatTime } from '@/lib/dateUtils'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { undoableDelete } from '@/lib/undoableDelete'
import { ListTabSkeleton } from '@/components/skeletons'
import type { Event } from '@/types/database'

type FilterTab = 'upcoming' | 'past' | 'all'

interface Props {
  onEventClick: (event: Event) => void
  onNewEvent: () => void
}

export function EventsTab({ onEventClick, onNewEvent }: Props) {
  const queryClient = useQueryClient()
  const { data: events = [], isLoading: eventsLoading } = useEvents()
  const { data: courses = [], isLoading: coursesLoading } = useCourses()

  const [filterTab, setFilterTab] = useState<FilterTab>('upcoming')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const clearSelection = () => { setSelectedIds(new Set()); setSelectMode(false) }

  const bulkDeleteSelected = () => {
    const ids = [...selectedIds]
    const items = events.filter((e) => selectedIds.has(e.id))
    clearSelection()
    undoableDelete({
      queryClient,
      queryKey: ['events'],
      items,
      deleteFn: async () => {
        const { error } = await supabase.from('events').delete().in('id', ids)
        if (error) throw error
      },
      message: `${ids.length} event${ids.length > 1 ? 's' : ''} deleted`,
    })
  }

  const courseMap = useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])),
    [courses],
  )

  const filtered = useMemo(() => {
    const now = new Date()
    const today = todayStr()

    return events.filter((e) => {
      if (filterTab !== 'all') {
        // Recurring events are always "upcoming" (they have future occurrences)
        if (e.recurrence_rule) {
          if (filterTab === 'past') return false
          // upcoming: always show recurring events
        } else {
          const compareStr = e.end_time || e.start_time
          const compareDate = new Date(compareStr)
          const isPast = e.all_day
            ? e.start_time.slice(0, 10) < today
            : compareDate < now
          if (filterTab === 'upcoming' && isPast) return false
          if (filterTab === 'past' && !isPast) return false
        }
      }
      if (courseFilter !== 'all' && e.course_id !== courseFilter) return false
      return true
    })
  }, [events, filterTab, courseFilter])

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'past', label: 'Past' },
    { id: 'all', label: 'All' },
  ]

  if (eventsLoading || coursesLoading) return <ListTabSkeleton />

  return (
    <div className="space-y-4 py-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-bold" style={{ fontSize: '1.75em' }}>Events</h1>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={selectMode ? 'secondary' : 'outline'}
            onClick={() => { if (selectMode) clearSelection(); else setSelectMode(true) }}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </Button>
          <Button size="sm" onClick={onNewEvent}>
            <CalendarPlus className="size-4 mr-1.5" />
            New Event
          </Button>
        </div>
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

      {/* Bulk action bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
          <span className="text-sm font-medium mr-1">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={bulkDeleteSelected}>
            <Trash2 className="size-3.5 mr-1" /> Delete
          </Button>
          <button type="button" onClick={clearSelection} className="ml-auto p-1 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Event list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          {events.length === 0 ? (
            <>
              <CalendarPlus className="size-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground text-sm">No events yet. Create one to get started.</p>
              <Button size="sm" onClick={onNewEvent}>
                <CalendarPlus className="size-4 mr-1.5" />
                New Event
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No events match your filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const course = event.course_id ? courseMap[event.course_id] : null
            const eventDate = event.start_time.slice(0, 10)

            return (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors cursor-pointer animate-in fade-in-0 duration-200"
                onClick={() => {
                  if (selectMode) toggleSelect(event.id)
                  else onEventClick(event)
                }}
              >
                {/* Select checkbox in select mode */}
                {selectMode && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(event.id) }}
                    className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      selectedIds.has(event.id)
                        ? 'bg-blue-500 dark:bg-blue-400 border-blue-500 dark:border-blue-400'
                        : 'border-muted-foreground/40 hover:border-blue-400 dark:hover:border-blue-300'
                    }`}
                  >
                    {selectedIds.has(event.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}

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
                  <span className="text-xs text-muted-foreground">
                    {relativeDueLabel(eventDate)}
                  </span>
                  {!event.all_day && (
                    <span className="text-xs font-mono text-muted-foreground">
                      {formatTime(event.start_time)}
                    </span>
                  )}
                  {event.all_day && (
                    <span className="text-xs text-muted-foreground">All day</span>
                  )}
                  <span className="w-px h-4 bg-border" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onEventClick(event) }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Edit
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
