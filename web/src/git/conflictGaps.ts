import type { Range, Text } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { ConflictColumn, ConflictSide } from './conflictLayout'

export const LINE_HEIGHT = 18
export const HEADER_HEIGHT = 24

export interface ConflictHeader {
  conflict: number
  total: number
  column: ConflictColumn
  resolved: boolean
  taken: boolean
}

interface GapItem {
  lines: number
  header: ConflictHeader | null
}

export interface GapHandlers {
  take: (conflict: number, side: ConflictSide) => void
}

export interface AlignmentInput {
  bounds: number[]
  counts: number[]
  targets: number[]
  headerOf: (index: number) => ConflictHeader | null
  lineClassOf: (index: number) => string | null
}

const TAKE_LABEL = 'Prendre'
const TAKEN_LABEL = 'Pris'

const TAKE_TIPS: Record<ConflictSide, string> = {
  [ConflictSide.Ours]: 'Prendre la version courante (Ctrl+Alt+←)',
  [ConflictSide.Theirs]: 'Prendre la version entrante (Ctrl+Alt+→)',
}

const heightOf = (items: GapItem[]): number => items.reduce((height, item) => height + (item.header ? HEADER_HEIGHT : item.lines * LINE_HEIGHT), 0)

const headerTitle = ({ conflict, total }: ConflictHeader): string => `Conflit ${conflict + 1}/${total}`

const takeButton = (header: ConflictHeader, side: ConflictSide, handlers: GapHandlers): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.tabIndex = -1
  button.className = 'cm-conflict-take'
  button.textContent = header.taken ? TAKEN_LABEL : TAKE_LABEL
  button.setAttribute('aria-label', TAKE_TIPS[side])
  button.dataset.tip = TAKE_TIPS[side]
  button.disabled = header.taken
  button.addEventListener('click', () => handlers.take(header.conflict, side))
  return button
}

const headerElement = (header: ConflictHeader, handlers: GapHandlers): HTMLElement => {
  const element = document.createElement('div')
  element.className = `cm-conflict-header${header.resolved ? ' cm-conflict-header-resolved' : ''}`
  const title = document.createElement('span')
  title.textContent = header.column === ConflictColumn.Result ? `${headerTitle(header)} · ${header.resolved ? 'résolu' : 'à résoudre'}` : headerTitle(header)
  if (header.column === ConflictColumn.Theirs) {
    element.append(takeButton(header, ConflictSide.Theirs, handlers), title)
  } else if (header.column === ConflictColumn.Ours) {
    element.append(title, takeButton(header, ConflictSide.Ours, handlers))
  } else {
    element.append(title)
  }
  return element
}

class GapWidget extends WidgetType {
  constructor(
    readonly items: GapItem[],
    readonly key: string,
    readonly handlers: GapHandlers,
  ) {
    super()
  }

  eq(other: GapWidget): boolean {
    return other.key === this.key
  }

  get estimatedHeight(): number {
    return heightOf(this.items)
  }

  toDOM(): HTMLElement {
    const element = document.createElement('div')
    element.className = 'cm-conflict-gap'
    element.style.height = `${heightOf(this.items)}px`
    for (const item of this.items) {
      if (item.header) {
        element.append(headerElement(item.header, this.handlers))
      } else {
        const pad = document.createElement('div')
        pad.className = 'cm-conflict-pad'
        pad.style.height = `${item.lines * LINE_HEIGHT}px`
        element.append(pad)
      }
    }
    return element
  }

  ignoreEvent(): boolean {
    return true
  }
}

const lineDecorations = (doc: Text, from: number, to: number, className: string, ranges: Range<Decoration>[]): void => {
  const decoration = Decoration.line({ class: className })
  let line = doc.lineAt(from)
  while (line.from < to) {
    ranges.push(decoration.range(line.from))
    if (line.number === doc.lines) {
      return
    }
    line = doc.line(line.number + 1)
  }
}

export const alignmentDecorations = (doc: Text, { bounds, counts, targets, headerOf, lineClassOf }: AlignmentInput, handlers: GapHandlers): DecorationSet => {
  const ranges: Range<Decoration>[] = []
  const gaps = new Map<number, GapItem[]>()
  const push = (position: number, item: GapItem) => gaps.set(position, [...(gaps.get(position) ?? []), item])
  counts.forEach((count, index) => {
    const header = headerOf(index)
    if (header) {
      push(bounds[index], { lines: 0, header })
    }
    if (targets[index] > count) {
      push(bounds[index + 1], { lines: targets[index] - count, header: null })
    }
    const className = lineClassOf(index)
    if (className && count > 0) {
      lineDecorations(doc, bounds[index], bounds[index + 1], className, ranges)
    }
  })
  for (const [position, items] of gaps) {
    ranges.push(Decoration.widget({ widget: new GapWidget(items, JSON.stringify(items), handlers), block: true, side: -1 }).range(Math.min(position, doc.length)))
  }
  return Decoration.set(ranges, true)
}

export const lineCounts = (doc: Text, bounds: number[]): number[] =>
  bounds.slice(0, -1).map((from, index) => doc.lineAt(Math.min(bounds[index + 1], doc.length)).number - doc.lineAt(Math.min(from, doc.length)).number)

export const conflictTheme = EditorView.theme({
  '&.cm-editor .cm-scroller': { lineHeight: `${LINE_HEIGHT}px` },
  '.cm-change-line': { backgroundColor: 'var(--color-tily-merge-change)' },
  '.cm-conflict-line': { backgroundColor: 'var(--color-tily-merge-conflict)' },
  '.cm-conflict-taken': { backgroundColor: 'var(--color-tily-merge-resolved)' },
  '.cm-conflict-dropped': { opacity: '0.55' },
  '.cm-resolved-line': { backgroundColor: 'var(--color-tily-merge-resolved)' },
  '.cm-conflict-gap': { boxSizing: 'border-box' },
  '.cm-conflict-pad': { backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 6px, var(--color-tily-green-hover) 6px 7px)' },
  '.cm-conflict-header': {
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: `${HEADER_HEIGHT}px`,
    padding: '0 8px',
    fontFamily: 'var(--font-sans)',
    fontSize: '11px',
    color: 'var(--color-tily-merge-conflict-ink)',
    backgroundColor: 'var(--color-tily-merge-header)',
    borderTop: '1px solid var(--color-tily-line)',
  },
  '.cm-conflict-header-resolved': { color: 'var(--color-tily-green-deep)' },
  '.cm-conflict-take': {
    height: '18px',
    padding: '0 8px',
    border: '1px solid var(--color-tily-line)',
    borderRadius: '4px',
    backgroundColor: 'var(--color-tily-paper)',
    color: 'var(--color-tily-ink)',
    fontSize: '11px',
    cursor: 'pointer',
  },
  '.cm-conflict-take:hover:not(:disabled)': { borderColor: 'var(--color-tily-green)', color: 'var(--color-tily-green-deep)' },
  '.cm-conflict-take:disabled': { cursor: 'default', opacity: '0.6' },
})
