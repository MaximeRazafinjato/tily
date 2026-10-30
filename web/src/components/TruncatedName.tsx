import { HIGHLIGHTED_NAME, highlightStyle } from './highlightStyle'

interface TruncatedNameProps {
  name: string
  siblings: string[]
  className?: string
  highlight?: string
}

const SEPARATORS = '-_.'
const WHITESPACE = /\s/

const commonLength = (left: string, right: string): number => {
  let length = 0
  while (length < left.length && length < right.length && left[length] === right[length]) {
    length += 1
  }
  return length
}

const lastSeparatorCut = (name: string, length: number): number => {
  for (let index = length - 1; index >= 0; index -= 1) {
    if (SEPARATORS.includes(name[index])) {
      return index + 1
    }
  }
  return 0
}

const prefixCut = (name: string, other: string): number => {
  const length = commonLength(name, other)
  if (length === name.length) {
    return 0
  }
  if (length === other.length && SEPARATORS.includes(name[length])) {
    return length + 1
  }
  return lastSeparatorCut(name, length)
}

const sharedPrefix = (name: string, siblings: string[]): string => {
  if (WHITESPACE.test(name)) {
    return ''
  }
  const cut = Math.max(0, ...siblings.map((other) => prefixCut(name, other)))
  return cut < name.length ? name.slice(0, cut) : ''
}

export function TruncatedName({ name, siblings, className = '', highlight }: TruncatedNameProps) {
  const prefix = sharedPrefix(name, siblings)
  const parts = (
    <>
      <span className="min-w-[1.2em] truncate">{prefix || name}</span>
      {prefix && <span className="max-w-[calc(100%_-_1.2em)] shrink-0 truncate">{name.slice(prefix.length)}</span>}
    </>
  )
  return (
    <span className={`flex min-w-0 whitespace-nowrap ${className}`}>
      {highlight ? (
        <span className={HIGHLIGHTED_NAME} style={highlightStyle(highlight)}>
          {parts}
        </span>
      ) : (
        parts
      )}
    </span>
  )
}
