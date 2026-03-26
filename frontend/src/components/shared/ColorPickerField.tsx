import { useState } from 'react'
import { BlockPicker } from 'react-color'

export const PRESET_COLORS = [
  '#9B0F06', '#b45309', '#FAE251', '#047857',
  '#636CCB', '#E491C9',
]

interface ColorPickerFieldProps {
  color: string
  onChange: (color: string) => void
  swatchSize?: 'sm' | 'md'
}

export function ColorPickerField({ color, onChange, swatchSize = 'md' }: ColorPickerFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customColors, setCustomColors] = useState<string[]>(() =>
    PRESET_COLORS.includes(color) ? [] : [color]
  )

  const sizeClass = swatchSize === 'sm' ? 'size-6' : 'size-7'

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`${sizeClass} rounded-full`}
          style={{
            backgroundColor: c,
            outline: color === c ? `2px solid ${c}` : 'none',
            outlineOffset: '2px',
          }}
          onClick={() => { onChange(c); setPickerOpen(false) }}
        />
      ))}
      {customColors.map((c) => (
        <button
          key={c}
          type="button"
          className={`${sizeClass} rounded-full`}
          style={{
            backgroundColor: c,
            outline: color === c ? `2px solid ${c}` : 'none',
            outlineOffset: '2px',
          }}
          onClick={() => { onChange(c); setPickerOpen(false) }}
        />
      ))}
      <div className="relative flex items-center">
        <button
          type="button"
          className={`${sizeClass} rounded-full border-2 border-dashed border-muted-foreground/40 hover:border-muted-foreground transition-colors`}
          title="Custom color"
          onClick={() => setPickerOpen((o) => !o)}
        />
        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPickerOpen(false)} />
            <div className="absolute top-9 left-0 z-50">
              <BlockPicker
                color={color}
                onChangeComplete={(c) => {
                  onChange(c.hex)
                  setPickerOpen(false)
                  setCustomColors((prev) =>
                    prev.includes(c.hex) ? prev : [...prev, c.hex]
                  )
                }}
                triangle="hide"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
