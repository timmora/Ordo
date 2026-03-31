import { useMutation } from '@tanstack/react-query'
import { backendFetch } from '@/lib/backendFetch'

interface ParseSyllabusInput {
  fileData: string
  fileName?: string
}

export interface SyllabusScheduleBlock {
  day: string
  start: string
  end: string
  location?: string
}

export interface SyllabusTask {
  title: string
  due_date: string
  due_time?: string
  type: string
  estimated_hours?: number
}

export interface SyllabusParseResult {
  course_name: string
  schedule_blocks: SyllabusScheduleBlock[]
  tasks: SyllabusTask[]
}

export function useParseSyllabus() {
  return useMutation({
    mutationFn: async ({ fileData, fileName }: ParseSyllabusInput): Promise<SyllabusParseResult> => {
      return backendFetch<SyllabusParseResult>('/api/syllabi/parse', {
        method: 'POST',
        body: JSON.stringify({ file_data: fileData, file_name: fileName }),
      })
    },
  })
}
