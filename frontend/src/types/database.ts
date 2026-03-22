export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          schedule: ScheduleBlock[]
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          name: string
          color?: string
          schedule?: ScheduleBlock[]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string
          schedule?: ScheduleBlock[]
          created_at?: string
        }
      }
      events: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          title: string
          start_time: string
          end_time: string | null
          location: string | null
          color: string | null
          all_day: boolean
          recurrence_rule: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          course_id?: string | null
          title: string
          start_time: string
          end_time?: string | null
          location?: string | null
          color?: string | null
          all_day?: boolean
          recurrence_rule?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string | null
          title?: string
          start_time?: string
          end_time?: string | null
          location?: string | null
          color?: string | null
          all_day?: boolean
          recurrence_rule?: string | null
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          title: string
          due_date: string
          estimated_hours: number | null
          priority: 'low' | 'medium' | 'high'
          status: 'todo' | 'in_progress' | 'done'
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          course_id?: string | null
          title: string
          due_date: string
          estimated_hours?: number | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'todo' | 'in_progress' | 'done'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          course_id?: string | null
          title?: string
          due_date?: string
          estimated_hours?: number | null
          priority?: 'low' | 'medium' | 'high'
          status?: 'todo' | 'in_progress' | 'done'
          created_at?: string
        }
      }
    }
  }
}

export interface ScheduleBlock {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
  start: string  // "HH:MM" 24h
  end: string    // "HH:MM" 24h
  location?: string
}

// Convenience row types
export type Course = Database['public']['Tables']['courses']['Row']
export type Event = Database['public']['Tables']['events']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type CourseInsert = Database['public']['Tables']['courses']['Insert']
export type EventInsert = Database['public']['Tables']['events']['Insert']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']

// Subtasks
export interface Subtask {
  id: string
  user_id: string
  task_id: string
  title: string
  order_index: number
  estimated_minutes: number
  scheduled_start: string | null
  scheduled_end: string | null
  status: 'pending' | 'in_progress' | 'complete'
  created_at: string
}

export interface SubtaskInsert {
  task_id: string
  title: string
  order_index: number
  estimated_minutes: number
  scheduled_start?: string | null
  scheduled_end?: string | null
  status?: 'pending' | 'in_progress' | 'complete'
}

export interface SubtaskUpdate {
  title?: string
  order_index?: number
  estimated_minutes?: number
  scheduled_start?: string | null
  scheduled_end?: string | null
  status?: 'pending' | 'in_progress' | 'complete'
}

// AI decomposition response (not persisted)
export interface SubtaskSuggestion {
  title: string
  estimated_minutes: number
}

// Focus sessions
export interface FocusSession {
  id: string
  user_id: string
  task_id: string | null
  subtask_id: string | null
  mode: 'focus' | 'break' | 'short_break' | 'long_break'
  duration_seconds: number
  completed_at: string
}

export interface FocusSessionInsert {
  task_id?: string | null
  subtask_id?: string | null
  mode: 'focus' | 'break'
  duration_seconds: number
  completed_at?: string
}

// Journal entries
export interface JournalPromptResponse {
  prompt: string
  response: string
}

export interface JournalEntry {
  id: string
  user_id: string
  date: string  // YYYY-MM-DD
  responses: JournalPromptResponse[]
  created_at: string
  updated_at: string
}
