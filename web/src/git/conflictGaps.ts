import type { Range, Text } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { ConflictSide } from './conflictLayout'
import { PickCheck } from './conflictPicks'

export const LINE_HEIGHT = 18
export const HEADER_HEIGHT = 24

export interface ConflictHeader {
  conflict: number
  total: number
  resolved: boolean
  side: ConflictSide | null
  check: PickCheck
}

interface GapItem {
  lines: number
  header: ConflictHeader | null
}

export interface GapHandlers {
  toggleBlock: (conflict: number, side: ConflictSide) => void
}

export interface AlignmentInput {
  bounds: number[]
  counts: number[]
  targets: number[]
  headerOf: (index: number) => ConflictHeader | null
  lineClassOf: (index: number, line: number) => string | null
}

const BLOCK_TIPS: Record<ConflictSide, string> = {
  [ConflictSide.Ours]: 'Prendre tout le bloc de la version courante (Ctrl+Alt+←)',
  [ConflictSide.Theirs]: 'Prendre tout le bloc de la version entrante (Ctrl+Alt+→)',
}

const heightOf = (items: GapItem[]): number => items.reduce((height, item) => height + (item.header ? HEADER_HEIGHT : item.lines * LINE_HEIGHT), 0)

const headerTitle = ({ conflict, total }: ConflictHeader): string => `Conflit ${conflict + 1}/${total}`

export const pickBox = (check: PickCheck, label: string): HTMLElement => {
  const box = document.createElement('span')
  box.className = `cm-pick-box cm-pick-${check}`
  box.setAttribute('role', 'checkbox')
  box.setAttribute('aria-checked', check === PickCheck.Mixed ? 'mixed' : String(check === PickCheck.Checked))
  box.setAttribute('aria-label', label)
  box.textContent = check === PickCheck.Checked ? '✓' : check === PickCheck.Mixed ? '–' : ''
  return box
}

const blockToggle = (header: ConflictHeader, side: ConflictSide, handlers: GapHandlers): HTMLElement => {
  const box = pickBox(header.check, BLOCK_TIPS[side])
  box.dataset.tip = BLOCK_TIPS[side]
  box.addEventListener('mousedown', (event) => {
    event.preventDefault()
    handlers.toggleBlock(header.conflict, side)
  })
  return box
}

const headerElement = (header: ConflictHeader, handlers: GapHandlers): HTMLElement => {
  const element = document.createElement('div')
  element.className = `cm-conflict-header${header.resolved ? ' cm-conflict-header-resolved' : ''}`
  const title = document.createElement('span')
  if (header.side === null) {
    title.textContent = `${headerTitle(header)} · ${header.resolved ? 'résolu' : 'à résoudre'}`
    element.append(title)
  } else {
    title.textContent = headerTitle(header)
    element.append(blockToggle(header, header.side, handlers), title)
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

const lineDecorations = (doc: Text, from: number, to: number, classOf: (line: number) => string | null, ranges: Range<Decoration>[]): void => {
  let line = doc.lineAt(from)
  let offset = 0
  while (line.from < to) {
    const className = classOf(offset)
    if (className) {
      ranges.push(Decoration.line({ class: className }).range(line.from))
    }
    if (line.number === doc.lines) {
      return
    }
    line = doc.line(line.number + 1)
    offset++
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
    if (count > 0) {
      lineDecorations(doc, bounds[index], bounds[index + 1], (line) => lineClassOf(index, line), ranges)
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
  '.cm-pick-gutter .cm-gutterElement': { display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: '8px' },
  '.cm-pick-box': {
    boxSizing: 'border-box',
    display: 'inline-flex',
    flexShrink: '0',
    alignItems: 'center',
    justifyContent: 'center',
    width: '13px',
    height: '13px',
    border: '1px solid var(--color-tily-muted)',
    borderRadius: '3px',
    fontFamily: 'var(--font-sans)',
    fontSize: '10px',
    lineHeight: '1',
    color: 'var(--color-tily-panel)',
    cursor: 'pointer',
  },
  '.cm-pick-box:hover': { borderColor: 'var(--color-tily-green-deep)' },
  '.cm-pick-checked, .cm-pick-mixed': { borderColor: 'var(--color-tily-green)', backgroundColor: 'var(--color-tily-green)' },
})
