import { create } from 'zustand'
import type { Course } from '@/types/database'

interface CourseStore {
  courses: Course[]
  setCourses: (courses: Course[]) => void
  addCourse: (course: Course) => void
  updateCourse: (course: Course) => void
  removeCourse: (id: string) => void
}

export const useCourseStore = create<CourseStore>((set) => ({
  courses: [],
  setCourses: (courses) => set({ courses }),
  addCourse: (course) => set((s) => ({ courses: [...s.courses, course] })),
  updateCourse: (course) =>
    set((s) => ({ courses: s.courses.map((c) => (c.id === course.id ? course : c)) })),
  removeCourse: (id) =>
    set((s) => ({ courses: s.courses.filter((c) => c.id !== id) })),
}))
