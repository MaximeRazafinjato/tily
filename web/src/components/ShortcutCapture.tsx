import { useState, type KeyboardEvent } from 'react'
import { formatChord, isModifierKey } from '../keyboard/keyChords'
import { Icon } from './Icon'
import { IconName } from './iconName'

interface ShortcutCaptureProps {
  chord: string
  label: string
  read: (event: globalThis.KeyboardEvent) => string | null
  onCapture: (chord: string) => void
  onClear?: () => void
}

const CANCEL_KEY = 'Escape'
const TAB_KEY = 'Tab'
const CAPTURE = 'min-w-0 flex-1 cursor-pointer truncate rounded border px-2 py-1 text-left text-[12px] outline-none'
const IDLE = `${CAPTURE} border-tily-line bg-tily-paper text-tily-ink hover:bg-tily-green-hover focus:border-tily-focus`
const ACTIVE = `${CAPTURE} border-tily-focus bg-tily-green-soft text-tily-green-deep`
const CLEAR = 'flex size-4 shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-green-hover hover:text-tily-error'

const isPlain = (event: KeyboardEvent<HTMLButtonElement>): boolean => !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey

export function ShortcutCapture({ chord, label, read, onCapture, onClear }: ShortcutCaptureProps) {
  const [capturing, setCapturing] = useState(false)
  const handleClick = () => setCapturing(true)
  const handleBlur = () => setCapturing(false)
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!capturing || event.nativeEvent.isComposing || (event.key === TAB_KEY && isPlain(event))) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (isModifierKey(event.nativeEvent)) {
      return
    }
    setCapturing(false)
    if (event.key === CANCEL_KEY && isPlain(event)) {
      return
    }
    const captured = read(event.nativeEvent)
    if (captured) {
      onCapture(captured)
    }
  }

  return (
    <span className="flex min-w-0 items-center gap-0.5">
      <button type="button" className={capturing ? ACTIVE : IDLE} aria-label={label} data-tip={capturing ? 'Échap annule' : label} onClick={handleClick} onBlur={handleBlur} onKeyDown={handleKeyDown}>
        {capturing ? 'Appuyez…' : chord ? formatChord(chord) : <span className="text-tily-muted">Aucun</span>}
      </button>
      {onClear && chord && !capturing ? (
        <button type="button" className={CLEAR} aria-label={`Retirer : ${label}`} data-tip="Retirer ce raccourci" onClick={onClear}>
          <Icon name={IconName.Close} size={10} />
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}
    </span>
  )
}
