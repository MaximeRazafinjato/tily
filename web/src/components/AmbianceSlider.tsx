import type { ChangeEvent } from 'react'

interface AmbianceSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  onChange: (value: number) => void
}

export function AmbianceSlider({ label, value, min, max, step = 1, unit, onChange }: AmbianceSliderProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(Number(event.target.value))
  return (
    <span className="flex items-center gap-2">
      <input type="range" aria-label={label} min={min} max={max} step={step} value={value} className="min-w-0 flex-1 accent-tily-green" onChange={handleChange} />
      <output className="w-14 shrink-0 text-right text-[12px] text-tily-ink tabular-nums">{`${value}${unit}`}</output>
    </span>
  )
}
