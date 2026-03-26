import type { SelectorOption } from '@/lib/journalPrompts'

interface Props {
  label: string
  options: SelectorOption[]
  value: string
  onChange: (value: string) => void
}

export function MoodEnergySelector({ label, options, value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? '' : opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                active ? opt.activeColor : `${opt.color} bg-transparent hover:bg-muted/40`
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
