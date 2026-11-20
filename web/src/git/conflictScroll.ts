import type { EditorView } from '@codemirror/view'

export interface ScrollPane {
  view: EditorView
  offsets: () => number[]
}

export const blockOffsets = (heights: number[]): number[] => {
  const offsets = [0]
  for (const height of heights) {
    offsets.push(offsets[offsets.length - 1] + height)
  }
  return offsets
}

const mapOffset = (position: number, from: number[], to: number[]): number => {
  const last = from.length - 1
  if (position <= from[0]) {
    return position
  }
  if (position >= from[last]) {
    return to[last] + position - from[last]
  }
  let index = 0
  while (index < last - 1 && from[index + 1] <= position) {
    index++
  }
  const span = from[index + 1] - from[index]
  const ratio = span > 0 ? (position - from[index]) / span : 0
  return to[index] + ratio * (to[index + 1] - to[index])
}

const centerOf = (view: EditorView): number => view.scrollDOM.scrollTop + view.scrollDOM.clientHeight / 2 - view.documentPadding.top

export const syncScroll = (panes: ScrollPane[]): (() => void) => {
  let leader: EditorView | null = null
  let release = 0
  const listeners = panes.map((source) => {
    const listener = () => {
      if (leader && leader !== source.view) {
        return
      }
      leader = source.view
      cancelAnimationFrame(release)
      release = requestAnimationFrame(() => {
        leader = null
      })
      const center = centerOf(source.view)
      const from = source.offsets()
      for (const target of panes) {
        if (target === source) {
          continue
        }
        const { scrollDOM, documentPadding } = target.view
        const top = Math.round(mapOffset(center, from, target.offsets()) + documentPadding.top - scrollDOM.clientHeight / 2)
        if (Math.abs(scrollDOM.scrollTop - top) >= 1) {
          scrollDOM.scrollTop = top
        }
      }
    }
    source.view.scrollDOM.addEventListener('scroll', listener)
    return listener
  })
  return () => {
    cancelAnimationFrame(release)
    panes.forEach((pane, index) => pane.view.scrollDOM.removeEventListener('scroll', listeners[index]))
  }
}
