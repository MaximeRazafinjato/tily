import type { ChangeEvent } from 'react'

interface ColorInputProps {
  value: string
  label: string
  selected?: boolean
  onChange: (color: string) => void
}

const INPUT = 'h-6 w-6 shrink-0 cursor-pointer rounded-full border border-tily-line bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0'
const SELECTED = 'outline-2 outline-offset-2 outline-tily-ink'

export function ColorInput({ value, label, selected = false, onChange }: ColorInputProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)
  return <input type="color" value={value} aria-label={label} data-tip={label} className={selected ? `${INPUT} ${SELECTED}` : INPUT} onChange={handleChange} />
}
