import type { ShortcutFeedback } from '../keyboard/shortcutDraft'
import { SETTINGS_HINT } from './settingsStyles'

interface ShortcutNoticeProps {
  feedback: ShortcutFeedback
  className?: string
}

export function ShortcutNotice({ feedback: { notice, error }, className = '' }: ShortcutNoticeProps) {
  return (
    <p role="status" className={`${error ? 'text-[11px] text-tily-error' : SETTINGS_HINT} ${className}`}>
      {error ?? notice}
    </p>
  )
}
