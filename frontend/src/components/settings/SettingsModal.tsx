import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings'
import { useTheme, type Theme } from '@/hooks/useTheme'
import { Sun, Moon, Monitor, Clock8 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const { data: settings } = useUserSettings()
  const updateSettings = useUpdateUserSettings()
  const { theme, setTheme } = useTheme()

  const themeOptions: { id: Theme; label: string; icon: React.ReactNode }[] = [
    { id: 'light', label: 'Light', icon: <Sun className="size-4" /> },
    { id: 'dark', label: 'Dark', icon: <Moon className="size-4" /> },
    { id: 'system', label: 'System', icon: <Monitor className="size-4" /> },
  ]

  const [capacity, setCapacity] = useState('6')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('22:00')

  useEffect(() => {
    if (settings) {
      setCapacity(String(settings.daily_capacity_hours))
      setStartTime(settings.schedule_start_time)
      setEndTime(settings.schedule_end_time)
    }
  }, [settings, open])

  async function handleSave() {
    await updateSettings.mutateAsync({
      daily_capacity_hours: parseFloat(capacity) || 6,
      schedule_start_time: startTime,
      schedule_end_time: endTime,
    })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Theme */}
          <div className="space-y-1.5">
            <Label>Theme</Label>
            <div className="flex rounded-md border overflow-hidden">
              {themeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={`flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 text-sm transition-colors ${
                    theme === opt.id
                      ? 'bg-foreground text-background'
                      : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Daily capacity (hours)</Label>
            <Input
              type="number"
              min="0.5"
              max="16"
              step="0.5"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Max hours of scheduled work per day
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Working hours start</Label>
              <div className="relative">
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="bg-background appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3">
                  <Clock8 className="size-4" />
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Working hours end</Label>
              <div className="relative">
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="bg-background appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
                <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3">
                  <Clock8 className="size-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
