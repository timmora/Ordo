import { create } from 'zustand'
import type { Task } from '@/types/database'

interface TaskStore {
  tasks: Task[]
  setTasks: (tasks: Task[]) => void
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  removeTask: (id: string) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (task) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === task.id ? task : t)) })),
  removeTask: (id) =>
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
}))
