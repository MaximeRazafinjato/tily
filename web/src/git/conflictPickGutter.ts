import type { EditorState } from '@codemirror/state'
import { gutter, GutterMarker, type BlockInfo, type EditorView, type ViewUpdate } from '@codemirror/view'
import { pickBox } from './conflictGaps'
import { PickCheck } from './conflictPicks'

export interface SideLine {
  index: number
  line: number
}

export interface PickGutterInput {
  lineAt: (lineNumber: number) => SideLine | null
  isPicked: (state: EditorState, target: SideLine) => boolean
  changed: (update: ViewUpdate) => boolean
  toggle: (target: SideLine) => void
}

const LINE_TIP = 'Prendre cette ligne (Espace)'

class PickMarker extends GutterMarker {
  constructor(readonly check: PickCheck) {
    super()
  }

  eq(other: PickMarker): boolean {
    return other.check === this.check
  }

  toDOM(): Node {
    const box = pickBox(this.check, LINE_TIP)
    box.dataset.tip = LINE_TIP
    return box
  }
}

const CHECKED = new PickMarker(PickCheck.Checked)
const UNCHECKED = new PickMarker(PickCheck.Unchecked)

export const pickGutter = ({ lineAt, isPicked, changed, toggle }: PickGutterInput) => {
  const targetOf = (view: EditorView, block: BlockInfo): SideLine | null => lineAt(view.state.doc.lineAt(block.from).number)
  return gutter({
    class: 'cm-pick-gutter',
    lineMarker: (view, block) => {
      const target = targetOf(view, block)
      if (!target) {
        return null
      }
      return isPicked(view.state, target) ? CHECKED : UNCHECKED
    },
    lineMarkerChange: changed,
    initialSpacer: () => UNCHECKED,
    domEventHandlers: {
      mousedown: (view, block) => {
        const target = targetOf(view, block)
        if (!target) {
          return false
        }
        toggle(target)
        return true
      },
    },
  })
}
