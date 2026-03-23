import { useEffect, useRef, useState } from 'react'
import { useTasks } from '@/hooks/useTasks'
import { useSubtasks } from '@/hooks/useSubtasks'
import { useFocusSessions, useFocusSessionsByTask, useCreateFocusSession } from '@/hooks/useFocusSessions'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDownIcon } from 'lucide-react'
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

type Mode = 'focus' | 'break'

const DEFAULT_DURATIONS: Record<Mode, number> = {
  focus: 25,
  break: 5,
}

const MODE_LABELS: Record<Mode, string> = {
  focus: 'Focus',
  break: 'Break',
}

const MODE_COLORS: Record<Mode, string> = {
  focus: 'text-emerald-700',
  break: 'text-amber-700',
}

const MODE_BG: Record<Mode, string> = {
  focus: 'bg-emerald-700',
  break: 'bg-amber-700',
}

const PREFS_KEY = 'ordo_focus_durations'

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
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string>('none')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [timerVisible, setTimerVisible] = useState(true)
  const [draftDurations, setDraftDurations] = useState<Record<Mode, number>>(durations)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)
  // Refs to avoid stale closures in timer callbacks
  const modeRef = useRef(mode)
  const selectedTaskIdRef = useRef(selectedTaskId)
  const selectedSubtaskIdRef = useRef(selectedSubtaskId)
  const durationsRef = useRef(durations)
  modeRef.current = mode
  selectedTaskIdRef.current = selectedTaskId
  selectedSubtaskIdRef.current = selectedSubtaskId
  durationsRef.current = durations

  const totalSeconds = durations[mode] * 60
  const elapsed = totalSeconds - secondsLeft
  const progressPct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0

  function logSession(durationSeconds: number) {
    if (durationSeconds < 5) return // don't log trivial sessions under 5s
    createSession.mutate({
      task_id: selectedTaskIdRef.current === 'none' ? null : selectedTaskIdRef.current,
      subtask_id: selectedSubtaskIdRef.current === 'none' ? null : selectedSubtaskIdRef.current,
      mode: modeRef.current,
      duration_seconds: durationSeconds,
    })
    startTimeRef.current = null
  }

  // When mode changes, log partial session then reset
  function switchMode(newMode: Mode) {
    if (newMode === mode) return
    if (running && startTimeRef.current) {
      const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000)
      logSession(elapsedSec)
    }
    setRunning(false)
    setTimerVisible(false)
    setTimeout(() => {
      setMode(newMode)
      setSecondsLeft(durations[newMode] * 60)
      setTimerVisible(true)
    }, 150)
  }

  // Tick
  useEffect(() => {
    if (running) {
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now()
      }
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!)
            setRunning(false)
            // Save full session
            logSession(durationsRef.current[modeRef.current] * 60)
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

  // Log partial session on unmount (e.g., navigating away from Focus tab)
  useEffect(() => {
    return () => {
      if (startTimeRef.current) {
        const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000)
        if (elapsedSec >= 5) {
          createSession.mutate({
            task_id: selectedTaskIdRef.current === 'none' ? null : selectedTaskIdRef.current,
            subtask_id: selectedSubtaskIdRef.current === 'none' ? null : selectedSubtaskIdRef.current,
            mode: modeRef.current,
            duration_seconds: elapsedSec,
          })
        }
        startTimeRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleReset() {
    if (running && startTimeRef.current) {
      const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000)
      logSession(elapsedSec)
    }
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
  const activeTaskId = selectedTaskId === 'none' ? undefined : selectedTaskId
  const { data: subtasks = [] } = useSubtasks(activeTaskId)
  const { subtaskMinutesMap } = useFocusSessionsByTask(activeTaskId)
  const pendingSubtasks = subtasks.filter((s) => s.status !== 'complete')

  // Selected subtask info
  const selectedSubtask = selectedSubtaskId !== 'none'
    ? subtasks.find((s) => s.id === selectedSubtaskId)
    : undefined
  const focusedMinutes = selectedSubtask ? (subtaskMinutesMap.get(selectedSubtask.id) ?? 0) : 0
  const remainingMinutes = selectedSubtask ? Math.max(0, selectedSubtask.estimated_minutes - focusedMinutes) : 0
  const subtaskProgressPct = selectedSubtask
    ? Math.min(100, Math.round((focusedMinutes / selectedSubtask.estimated_minutes) * 100))
    : 0

  return (
    <div className="max-w-lg mx-auto py-6 space-y-8">
      {/* Mode selector */}
      <div className="flex justify-center gap-2">
        {(['focus', 'break'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`px-6 py-2 rounded-full text-base font-medium transition-all duration-150 ${
              mode === m
                ? m === 'focus'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-amber-700 text-white'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            }`}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Timer display */}
      <div className="text-center space-y-4">
        <div className={`text-8xl font-serif font-bold tabular-nums transition-opacity duration-150 ${MODE_COLORS[mode]} ${timerVisible ? 'opacity-100' : 'opacity-0'}`}>
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
          variant="outline"
          onClick={() => {
            if (running && startTimeRef.current) {
              // Pausing — log partial session
              const elapsedSec = Math.round((Date.now() - startTimeRef.current) / 1000)
              logSession(elapsedSec)
            }
            setRunning((r) => !r)
          }}
          className={`w-16 h-16 rounded-full p-0 border-2 border-border transition-all duration-200 ${
            running
              ? 'scale-95 bg-muted/60 text-muted-foreground hover:scale-100 hover:bg-muted/60 hover:text-muted-foreground'
              : 'bg-background text-foreground hover:scale-110'
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
              {(['focus', 'break'] as Mode[]).map((m) => (
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

      {/* Subtask progress — shown when a subtask is selected */}
      {selectedSubtask && (
        <div className="rounded-lg border bg-card p-3 mx-4 text-left space-y-1.5">
          <p className="text-sm font-medium">{selectedSubtask.title}</p>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                subtaskProgressPct >= 100 ? 'bg-green-500' : 'bg-amber-500'
              }`}
              style={{ width: `${subtaskProgressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {focusedMinutes}m focused of {selectedSubtask.estimated_minutes}m estimated
            </p>
            <p className={`text-xs font-semibold ${remainingMinutes === 0 ? 'text-green-500' : ''}`}>
              {remainingMinutes > 0 ? `${remainingMinutes}m left` : 'Complete'}
            </p>
          </div>
        </div>
      )}

      {/* Task selector */}
      <div className="space-y-2">
        <Label className="text-sm text-muted-foreground">Focusing on</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal min-w-0">
              <span className={`truncate ${selectedTaskId === 'none' ? 'text-muted-foreground' : ''}`}>{selectedTaskId === 'none' ? 'None' : pendingTasks.find((t) => t.id === selectedTaskId)?.title ?? 'None'}</span>
              <ChevronDownIcon className="shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto">
            <DropdownMenuGroup>
              {pendingTasks.filter((t) => t.id !== selectedTaskId).map((t) => (
                <DropdownMenuItem key={t.id} onSelect={() => { setSelectedTaskId(t.id); setSelectedSubtaskId('none') }}>{t.title}</DropdownMenuItem>
              ))}
              {selectedTaskId !== 'none' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => { setSelectedTaskId('none'); setSelectedSubtaskId('none') }}>None</DropdownMenuItem>
                </>
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Subtask selector — shown when a task with subtasks is selected */}
        {selectedTaskId !== 'none' && subtasks.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subtask</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between font-normal min-w-0">
                  <span className={`truncate ${selectedSubtaskId === 'none' ? 'text-muted-foreground' : ''}`}>{selectedSubtaskId === 'none' ? 'None' : subtasks.find((s) => s.id === selectedSubtaskId)?.title ?? 'None'}</span>
                  <ChevronDownIcon className="shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-60 overflow-y-auto">
                <DropdownMenuGroup>
                  {subtasks.filter((s) => s.id !== selectedSubtaskId && s.status !== 'complete').map((s) => {
                    const originalIndex = subtasks.indexOf(s)
                    const unlocked = subtasks.slice(0, originalIndex).every((prev) => prev.status === 'complete')
                    return (
                      <DropdownMenuItem
                        key={s.id}
                        disabled={!unlocked}
                        onSelect={() => setSelectedSubtaskId(s.id)}
                      >
                        {!unlocked ? '\uD83D\uDD12 ' : ''}{s.title}
                      </DropdownMenuItem>
                    )
                  })}
                  {selectedSubtaskId !== 'none' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setSelectedSubtaskId('none')}>None</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Sessions today</p>
          <p className="text-2xl font-semibold">{sessionsToday}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Focus minutes</p>
          <p className="text-2xl font-semibold">{totalFocusMin}</p>
        </div>
      </div>
    </div>
  )
}
