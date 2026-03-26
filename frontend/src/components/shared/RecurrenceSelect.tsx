import { ChevronDownIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const RECURRENCE_OPTIONS: Record<string, string> = {
  none: 'Does not repeat',
  'FREQ=DAILY': 'Daily',
  'FREQ=WEEKLY': 'Weekly',
  'FREQ=MONTHLY': 'Monthly',
}

interface RecurrenceSelectProps {
  value: string
  onChange: (value: string) => void
}

export function RecurrenceSelect({ value, onChange }: RecurrenceSelectProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal">
          {RECURRENCE_OPTIONS[value] ?? 'Does not repeat'}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        <DropdownMenuGroup>
          {Object.entries(RECURRENCE_OPTIONS)
            .filter(([key]) => key !== value)
            .map(([key, label]) => (
              <DropdownMenuItem key={key} onSelect={() => onChange(key)}>
                {label}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
