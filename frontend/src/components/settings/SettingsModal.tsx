import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useUserSettings, useUpdateUserSettings } from '@/hooks/useUserSettings'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const { data: settings } = useUserSettings()
  const updateSettings = useUpdateUserSettings()

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
          <DialogTitle>Schedule Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Working hours end</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
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
