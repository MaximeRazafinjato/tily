import type { MouseEvent } from 'react'
import { gradientPreview } from '../ambiance/gradientStyle'
import { ColorInput } from './ColorInput'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SETTINGS_ICON_BUTTON } from './settingsStyles'

interface AmbianceGradientEditorProps {
  colors: string[]
  onChange: (colors: string[]) => void
}

const MIN_COLORS = 2
const MAX_COLORS = 12
const ADD = 'Ajouter une couleur'

export function AmbianceGradientEditor({ colors, onChange }: AmbianceGradientEditorProps) {
  const handleBarClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (colors.length >= MAX_COLORS) {
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const index = Math.round(((event.clientX - bounds.left) / bounds.width) * colors.length)
    onChange([...colors.slice(0, index), colors[Math.min(index, colors.length - 1)], ...colors.slice(index)])
  }
  const handleAdd = () => onChange([...colors, colors[colors.length - 1]])

  return (
    <div className="flex flex-col gap-2">
      <button type="button" aria-label="Insérer une couleur à cet endroit" data-tip="Clic : insérer une couleur à cet endroit" className="h-4 w-full rounded border border-tily-line" style={{ backgroundImage: gradientPreview(colors) }} onClick={handleBarClick} />
      <span className="flex flex-wrap items-center gap-2">
        {colors.map((color, index) => {
          const handleColorChange = (next: string) => onChange(colors.map((candidate, position) => (position === index ? next : candidate)))
          const handleRemove = () => onChange(colors.filter((_, position) => position !== index))
          const remove = `Retirer la couleur ${index + 1}`
          return (
            <span key={index} className="flex items-center">
              <ColorInput value={color} label={`Couleur ${index + 1}`} onChange={handleColorChange} />
              {colors.length > MIN_COLORS && (
                <button type="button" className="ml-0.5 flex size-4 items-center justify-center rounded text-tily-muted hover:text-tily-ink" aria-label={remove} data-tip={remove} onClick={handleRemove}>
                  <Icon name={IconName.Close} />
                </button>
              )}
            </span>
          )
        })}
        {colors.length < MAX_COLORS && (
          <button type="button" className={SETTINGS_ICON_BUTTON} aria-label={ADD} data-tip={ADD} onClick={handleAdd}>
            <Icon name={IconName.Plus} />
          </button>
        )}
      </span>
    </div>
  )
}
