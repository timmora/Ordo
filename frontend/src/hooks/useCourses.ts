import { useSupabaseQuery, useSupabaseInsert, useSupabaseUpdate, useSupabaseDelete } from './useSupabaseCrud'
import type { Course, CourseInsert } from '@/types/database'

export const useCourses = () => useSupabaseQuery<Course>('courses', ['courses'], 'name')
export const useCreateCourse = () => useSupabaseInsert<CourseInsert, Course>('courses', [['courses']])
export const useUpdateCourse = () => useSupabaseUpdate<Course>('courses', [['courses']])
export const useDeleteCourse = () => useSupabaseDelete('courses', [['courses'], ['events'], ['tasks']])
