interface Props {
  focusMinutes: number
  tasksCompleted: number
  tasksTotal: number
  streak: number
}

export function DayStatsBanner({ focusMinutes, tasksCompleted, tasksTotal, streak }: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-lg bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">Focus time</p>
        <p className="text-lg font-semibold">{focusMinutes}m</p>
      </div>
      <div className="rounded-lg bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">Tasks done</p>
        <p className="text-lg font-semibold">{tasksCompleted}/{tasksTotal}</p>
      </div>
      <div className="rounded-lg bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">Day streak</p>
        <p className="text-lg font-semibold">{streak > 0 ? `${streak}d` : '\u2014'}</p>
      </div>
    </div>
  )
}
