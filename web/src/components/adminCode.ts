const ADMIN_CODE = 'adminadmin'
const ADMIN_CODE_WINDOW_MS = 2000
const TEXT_ENTRY_SELECTOR = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select, [contenteditable]'

export interface TypedKey {
  key: string
  at: number
}

const typedInTextEntry = (target: EventTarget | null): boolean => target instanceof Element && target.closest(TEXT_ENTRY_SELECTOR) !== null

export const countsForAdminCode = (event: KeyboardEvent): boolean => event.key.length === 1 && !event.repeat && !event.ctrlKey && !event.altKey && !event.metaKey && !typedInTextEntry(event.target)

export const withTypedKey = (typed: TypedKey[], key: string, at: number): TypedKey[] => [...typed, { key: key.toLowerCase(), at }].slice(-ADMIN_CODE.length)

export const adminCodeTyped = (typed: TypedKey[]): boolean =>
  typed.map((entry) => entry.key).join('') === ADMIN_CODE && typed[typed.length - 1].at - typed[0].at <= ADMIN_CODE_WINDOW_MS
