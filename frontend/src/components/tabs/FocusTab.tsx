import { useEffect, useRef, useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useFocusSessions, useCreateFocusSession } from '@/hooks/useFocusSessions'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Play, Pause, RotateCcw, Settings } from 'lucide-react'

type Mode = 'focus' | 'short_break' | 'long_break'

const DEFAULT_DURATIONS: Record<Mode, number> = {
  focus: 25,
  short_break: 5,
  long_break: 15,
}

const MODE_LABELS: Record<Mode, string> = {
  focus: 'Focus',
  short_break: 'Short Break',
  long_break: 'Long Break',
}

const MODE_COLORS: Record<Mode, string> = {
  focus: 'text-red-500',
  short_break: 'text-green-500',
  long_break: 'text-blue-500',
}

const MODE_BG: Record<Mode, string> = {
  focus: 'bg-red-500',
  short_break: 'bg-green-500',
  long_break: 'bg-blue-500',
}

const PREFS_KEY = 'aporia_focus_durations'

function loadDurations(): Record<Mode, number> {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULT_DURATIONS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULT_DURATIONS }
}

function saveDurations(d: Record<Mode, number>) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(d))
}

const todayStr = () => new Date().toISOString().slice(0, 10)

export function FocusTab() {
  const { data: tasks = [] } = useTasks()
  const { data: sessions = [] } = useFocusSessions(todayStr())
  const createSession = useCreateFocusSession()

  const [durations, setDurations] = useState<Record<Mode, number>>(loadDurations)
  const [mode, setMode] = useState<Mode>('focus')
  const [secondsLeft, setSecondsLeft] = useState(durations[mode] * 60)
  const [running, setRunning] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string>('none')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [draftDurations, setDraftDurations] = useState<Record<Mode, number>>(durations)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalSeconds = durations[mode] * 60
  const elapsed = totalSeconds - secondsLeft
  const progressPct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0

  // When mode changes, reset timer
  function switchMode(newMode: Mode) {
    setRunning(false)
    setMode(newMode)
    setSecondsLeft(durations[newMode] * 60)
  }

  // Tick
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            // Save session
            createSession.mutate({
              task_id: selectedTaskId === 'none' ? null : selectedTaskId,
              mode,
              duration_seconds: durations[mode] * 60,
            })
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() {
    setRunning(false)
    setSecondsLeft(durations[mode] * 60)
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Stats
  const focusSessions = sessions.filter((s) => s.mode === 'focus')
  const totalFocusMin = Math.round(focusSessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 60)
  const sessionsToday = focusSessions.length

  function saveSettings() {
    setDurations(draftDurations)
    saveDurations(draftDurations)
    setSecondsLeft(draftDurations[mode] * 60)
    setRunning(false)
    setSettingsOpen(false)
  }

  const pendingTasks = tasks.filter((t) => t.status !== 'done')

  return (
    <div className="max-w-lg mx-auto py-6 space-y-8">
      {/* Mode selector */}
      <div className="flex justify-center gap-2">
        {(['focus', 'short_break', 'long_break'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              mode === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer display */}
      <div className="text-center space-y-4">
        <div className={`text-8xl font-mono font-bold tabular-nums ${MODE_COLORS[mode]}`}>
          {formatTime(secondsLeft)}
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mx-4">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${MODE_BG[mode]}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-3">
        <Button
          size="lg"
          variant="outline"
          onClick={handleReset}
          className="w-12 h-12 rounded-full p-0"
        >
          <RotateCcw className="size-5" />
        </Button>
        <Button
          size="lg"
          onClick={() => setRunning((r) => !r)}
          className={`w-16 h-16 rounded-full p-0 text-white ${
            mode === 'focus' ? 'bg-red-500 hover:bg-red-600' :
            mode === 'short_break' ? 'bg-green-500 hover:bg-green-600' :
            'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {running ? <Pause className="size-6" /> : <Play className="size-6 ml-0.5" />}
        </Button>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button
              size="lg"
              variant="outline"
              className="w-12 h-12 rounded-full p-0"
            >
              <Settings className="size-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Timer Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              {(['focus', 'short_break', 'long_break'] as Mode[]).map((m) => (
                <div key={m} className="flex items-center gap-4">
                  <Label className="w-32 text-sm">{MODE_LABELS[m]}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={draftDurations[m]}
                    onChange={(e) =>
                      setDraftDurations((d) => ({ ...d, [m]: Number(e.target.value) }))
                    }
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
              ))}
              <Button onClick={saveSettings} className="w-full">Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Task selector */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Focusing on</Label>
        <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
          <SelectTrigger>
            <SelectValue placeholder="Select a task (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No task selected</SelectItem>
            {pendingTasks.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Sessions today</p>
          <p className="text-2xl font-semibold text-red-500">{sessionsToday}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Focus minutes</p>
          <p className="text-2xl font-semibold text-blue-500">{totalFocusMin}</p>
        </div>
      </div>
    </div>
  )
}
