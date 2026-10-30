import type { CSSProperties } from 'react'

const HIGHLIGHT_ALPHA = '4d'

export const HIGHLIGHT_SHAPE = 'rounded-[3px] px-1 -mx-1'

export const HIGHLIGHTED_NAME = `flex min-w-0 ${HIGHLIGHT_SHAPE}`

export const highlightStyle = (color: string | undefined): CSSProperties | undefined => (color ? { backgroundColor: `${color}${HIGHLIGHT_ALPHA}` } : undefined)
