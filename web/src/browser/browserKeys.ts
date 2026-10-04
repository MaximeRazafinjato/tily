import type { BrowserKey } from '../bridge/browserMessages'
import { handleForwardedKey } from '../keyboard/shortcuts'
import { restoreBrowserFocus } from './browserLayer'

export const receiveBrowserKey = (key: BrowserKey): void => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  handleForwardedKey(new KeyboardEvent('keydown', { key: key.key, code: key.code, ctrlKey: key.ctrlKey, shiftKey: key.shiftKey, altKey: key.altKey }))
  restoreBrowserFocus()
}
