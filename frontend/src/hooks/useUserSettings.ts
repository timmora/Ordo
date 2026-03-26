import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserSettings, UserSettingsUpdate } from '@/types/database'

const DEFAULTS: Omit<UserSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  daily_capacity_hours: 6,
  schedule_start_time: '08:00',
  schedule_end_time: '22:00',
}

export function useUserSettings() {
  return useQuery({
    queryKey: ['user-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (data) return data as UserSettings

      // Create defaults if no row exists
      const { data: created, error: createErr } = await supabase
        .from('user_settings')
        .insert({
          daily_capacity_hours: DEFAULTS.daily_capacity_hours,
          schedule_start_time: DEFAULTS.schedule_start_time,
          schedule_end_time: DEFAULTS.schedule_end_time,
        })
        .select()
        .single()
      if (createErr) throw createErr
      return created as UserSettings
    },
  })
}

export function useUpdateUserSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (updates: UserSettingsUpdate) => {
      // Get current settings id
      const current = qc.getQueryData<UserSettings>(['user-settings'])
      if (!current) throw new Error('Settings not loaded')

      const { data, error } = await supabase
        .from('user_settings')
        .update(updates)
        .eq('id', current.id)
        .select()
        .single()
      if (error) throw error
      return data as UserSettings
    },
    onSuccess: (data) => {
      qc.setQueryData(['user-settings'], data)
    },
  })
}
