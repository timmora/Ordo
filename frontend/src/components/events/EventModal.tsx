import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCourses } from '@/hooks/useCourses'
import { useCreateEvent, useUpdateEvent, useDeleteEvent } from '@/hooks/useEvents'
import type { Event, EventInsert } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  event?: Event
  defaultStart?: Date
  defaultEnd?: Date
  defaultAllDay?: boolean
}

function toDatetimeLocal(iso: string) {
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm")
}

function toDateInput(iso: string) {
  return format(new Date(iso), 'yyyy-MM-dd')
}

export function EventModal({ open, onClose, event, defaultStart, defaultEnd, defaultAllDay }: Props) {
  const { data: courses = [] } = useCourses()
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()

  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState<string>('none')
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [recurrence, setRecurrence] = useState<string>('none')

  useEffect(() => {
    if (event) {
      setTitle(event.title)
      setCourseId(event.course_id ?? 'none')
      setAllDay(event.all_day)
      setStart(event.all_day ? toDateInput(event.start_time) : toDatetimeLocal(event.start_time))
      setEnd(event.end_time ? (event.all_day ? toDateInput(event.end_time) : toDatetimeLocal(event.end_time)) : '')
      setLocation(event.location ?? '')
      setRecurrence(event.recurrence_rule ?? 'none')
    } else {
      setTitle('')
      setCourseId('none')
      setAllDay(defaultAllDay ?? false)
      setStart(defaultStart
        ? (defaultAllDay ? format(defaultStart, 'yyyy-MM-dd') : format(defaultStart, "yyyy-MM-dd'T'HH:mm"))
        : '')
      setEnd(defaultEnd
        ? (defaultAllDay ? format(defaultEnd, 'yyyy-MM-dd') : format(defaultEnd, "yyyy-MM-dd'T'HH:mm"))
        : '')
      setLocation('')
      setRecurrence('none')
    }
  }, [event, open, defaultStart, defaultEnd, defaultAllDay])

  function buildPayload(): EventInsert {
    const course = courseId === 'none' ? null : courseId
    const startIso = allDay ? new Date(start + 'T00:00:00').toISOString() : new Date(start).toISOString()
    const endIso = end ? (allDay ? new Date(end + 'T00:00:00').toISOString() : new Date(end).toISOString()) : null
    return {
      title: title.trim(),
      course_id: course,
      start_time: startIso,
      end_time: endIso,
      all_day: allDay,
      location: location.trim() || null,
      recurrence_rule: recurrence === 'none' ? null : recurrence,
      color: course ? (courses.find((c) => c.id === course)?.color ?? null) : null,
    }
  }

  async function handleSave() {
    if (!title.trim() || !start) return
    if (event) {
      await updateEvent.mutateAsync({ id: event.id, ...buildPayload() })
    } else {
      await createEvent.mutateAsync(buildPayload())
    }
    onClose()
  }

  async function handleDelete() {
    if (!event) return
    await deleteEvent.mutateAsync(event.id)
    onClose()
  }

  const isPending = createEvent.isPending || updateEvent.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{event ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Course (optional)</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="No course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No course</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allday"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="allday">All day</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{allDay ? 'Date' : 'Start'}</Label>
              <Input
                type={allDay ? 'date' : 'datetime-local'}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-1.5">
                <Label>End</Label>
                <Input
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Location (optional)</Label>
            <Input
              placeholder="e.g. Room 101"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Repeat</Label>
            <Select value={recurrence} onValueChange={setRecurrence}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="FREQ=DAILY">Daily</SelectItem>
                <SelectItem value="FREQ=WEEKLY">Weekly</SelectItem>
                <SelectItem value="FREQ=MONTHLY">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {event && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleteEvent.isPending}>
              Delete
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
