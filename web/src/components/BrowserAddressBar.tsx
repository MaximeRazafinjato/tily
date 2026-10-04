import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react'
import { displayedAddress } from '../model/browser'

interface BrowserAddressBarProps {
  url: string | undefined
  editing: boolean
  onNavigate: (address: string) => void
  onLeave: (returnToPage: boolean) => void
}

export function BrowserAddressBar({ url, editing, onNavigate, onLeave }: BrowserAddressBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState<string | null>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
    }
  }, [editing])

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setDraft(displayedAddress(url))
    event.currentTarget.select()
  }
  const handleChange = (event: FormEvent<HTMLInputElement>) => setDraft(event.currentTarget.value)
  const handleBlur = () => {
    setDraft(null)
    onLeave(false)
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && draft !== null && draft.trim().length > 0) {
      event.preventDefault()
      onNavigate(draft.trim())
      setDraft(null)
      onLeave(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(null)
      onLeave(true)
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      spellCheck={false}
      aria-label="Adresse de la page"
      placeholder="Adresse, par exemple localhost:5173"
      className="h-[18px] min-w-[4em] flex-1 rounded border border-tily-line bg-tily-terminal px-1.5 font-mono text-[11px] text-tily-ink outline-none placeholder:text-tily-muted focus:border-tily-focus"
      value={draft ?? displayedAddress(url)}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
