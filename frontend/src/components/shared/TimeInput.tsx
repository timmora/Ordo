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
      <Input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="bg-background appearance-none pr-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
      />
      <div className="text-muted-foreground pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center pr-3">
        <Clock8Icon className="size-4" />
      </div>
    </div>
  )
}
