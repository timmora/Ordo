import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CourseInsert, Course, ScheduleBlock } from '@/types/database'

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as Course[]
    },
  })
}

export function useCreateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CourseInsert) => {
      const { data, error } = await supabase
        .from('courses')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Course
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}

export function useUpdateCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Course> & { id: string }) => {
      const { data, error } = await supabase
        .from('courses')
        .update(patch as { name?: string; color?: string; schedule?: ScheduleBlock[] })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Course
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['courses'] }),
  })
}

export function useDeleteCourse() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}
