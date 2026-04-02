import { useMemo } from 'react'
import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from './useSupabaseCrud'
import type { Course, CourseInsert } from '@/types/database'

export const useCourses = () => useSupabaseQuery<Course>('courses', ['courses'], 'name')

/** Pre-built lookup map: course id -> Course. Avoids duplicating this useMemo in every tab. */
export function useCourseMap() {
  const { data: courses = [] } = useCourses()
  return useMemo(
    () => Object.fromEntries(courses.map((c) => [c.id, c])) as Record<string, Course>,
    [courses],
  )
}

export const useCreateCourse = () => useSupabaseInsert<CourseInsert, Course>('courses', [['courses']])
export const useUpdateCourse = () => useSupabaseUpdate<Course>('courses', [['courses']])
export const useDeleteCourse = () => useSupabaseDelete('courses', [['courses'], ['events'], ['tasks']])
