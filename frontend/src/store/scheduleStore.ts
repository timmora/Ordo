import { create } from 'zustand'
import type { ScheduleChange } from '@/types/database'

interface ScheduleStore {
  pendingChanges: ScheduleChange[] | null
  setPendingChanges: (changes: ScheduleChange[]) => void
  clearChanges: () => void
}

export const useScheduleStore = create<ScheduleStore>((set) => ({
  pendingChanges: null,
  setPendingChanges: (changes) => set({ pendingChanges: changes }),
  clearChanges: () => set({ pendingChanges: null }),
}))
