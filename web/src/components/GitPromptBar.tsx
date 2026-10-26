import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { submitPrompt } from '../git/gitRefActions'
import { focusGitPanel } from '../git/gitFocus'
import { GitPromptKind, useGitStore, type GitPrompt } from '../store/gitStore'
import { GIT_INPUT, GIT_PRIMARY, GIT_SECONDARY } from './rightPanelStyles'

interface GitPromptBarProps {
  prompt: GitPrompt
}

const SUBMIT_LABELS: Record<GitPromptKind, string> = {
  [GitPromptKind.NewBranch]: 'Créer',
  [GitPromptKind.RenameBranch]: 'Renommer',
  [GitPromptKind.NewTag]: 'Créer le tag',
  [GitPromptKind.Stash]: 'Stash',
}

const NAME_MAX_LENGTH = 200

export function GitPromptBar({ prompt }: GitPromptBarProps) {
  const [checkout, setCheckout] = useState(prompt.checkout)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    submitPrompt(inputRef.current?.value ?? '', checkout)
    requestAnimationFrame(focusGitPanel)
  }
  const handleCancel = () => {
    useGitStore.getState().setPrompt(null)
    requestAnimationFrame(focusGitPanel)
  }
  const handleCheckoutChange = (event: ChangeEvent<HTMLInputElement>) => setCheckout(event.target.checked)
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) {
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      event.stopPropagation()
      handleSubmit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      handleCancel()
    }
  }

  return (
    <div className="mx-[8px] mb-[6px] flex flex-col gap-[6px] rounded border border-tily-line bg-tily-panel px-[10px] py-[8px]">
      <label className="flex flex-col gap-[4px] text-[11px] text-tily-muted">
        <span className="truncate">{prompt.label}</span>
        <input ref={inputRef} type="text" defaultValue={prompt.initial} maxLength={NAME_MAX_LENGTH} spellCheck={false} className={`${GIT_INPUT}`} onKeyDown={handleKeyDown} />
      </label>
      <div className="flex items-center gap-[6px]">
        {prompt.kind === GitPromptKind.NewBranch ? (
          <label className="flex min-w-0 flex-1 items-center gap-[6px] text-[12px] text-tily-ink-soft">
            <input type="checkbox" checked={checkout} onChange={handleCheckoutChange} />
            <span className="truncate">Checkout après création</span>
          </label>
        ) : (
          <span className="flex-1" />
        )}
        <button type="button" className={GIT_SECONDARY} onClick={handleCancel}>
          Annuler
        </button>
        <button type="button" className={GIT_PRIMARY} onClick={handleSubmit}>
          {SUBMIT_LABELS[prompt.kind]}
        </button>
      </div>
    </div>
  )
}
