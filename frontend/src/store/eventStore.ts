import { create } from 'zustand'
import type { Event } from '@/types/database'

interface EventStore {
  events: Event[]
  setEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  updateEvent: (event: Event) => void
  removeEvent: (id: string) => void
}

export const useEventStore = create<EventStore>((set) => ({
  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((s) => ({ events: [...s.events, event] })),
  updateEvent: (event) =>
    set((s) => ({ events: s.events.map((e) => (e.id === event.id ? event : e)) })),
  removeEvent: (id) =>
    set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
}))
