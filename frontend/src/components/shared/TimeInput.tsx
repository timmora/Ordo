import { Clock8Icon } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface TimeInputProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
}

export function TimeInput({ value, onChange, onBlur }: TimeInputProps) {
  return (
    <div className="relative">
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3 peer-disabled:opacity-50">
        <Clock8Icon className="size-4" />
      </div>
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="peer bg-background appearance-none pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
    </div>
  )
}
