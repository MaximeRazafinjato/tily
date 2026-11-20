import { StateEffect, type Range, type Text } from '@codemirror/state'
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view'
import { highlightLanguageOf, loadDiffHighlighter, MAX_HIGHLIGHTED_CHARS } from './gitDiffHighlight'

type Highlighter = Awaited<ReturnType<typeof loadDiffHighlighter>>

const REFRESH_DELAY_MS = 150
const HTML_TOKENS = /<span class="([^"]*)">|<\/span>|&(?:amp|lt|gt|quot|#x27);|[^<&]+/g

const refreshEffect = StateEffect.define<null>()

const marksOf = (html: string): DecorationSet => {
  const ranges: Range<Decoration>[] = []
  const open: { className: string; from: number }[] = []
  let position = 0
  for (const [token, className] of html.matchAll(HTML_TOKENS)) {
    if (className !== undefined) {
      open.push({ className, from: position })
    } else if (token === '</span>') {
      const span = open.pop()
      if (span && span.from < position) {
        ranges.push(Decoration.mark({ class: span.className }).range(span.from, position))
      }
    } else {
      position += token.startsWith('&') ? 1 : token.length
    }
  }
  return Decoration.set(ranges, true)
}

const highlight = (highlighter: Highlighter, language: string, doc: Text): DecorationSet =>
  doc.length > MAX_HIGHLIGHTED_CHARS ? Decoration.none : marksOf(highlighter.hljs.highlight(doc.toString(), { language }).value)

export const conflictHighlight = (path: string) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none
      highlighter: Highlighter | null = null
      timer = 0
      destroyed = false

      constructor(readonly view: EditorView) {
        loadDiffHighlighter().then(
          (highlighter) => {
            this.highlighter = highlighter
            this.refresh()
          },
          () => undefined,
        )
      }

      update(update: ViewUpdate) {
        if (update.docChanged) {
          this.decorations = this.decorations.map(update.changes)
          window.clearTimeout(this.timer)
          this.timer = window.setTimeout(() => this.refresh(), REFRESH_DELAY_MS)
        }
      }

      refresh() {
        const language = this.highlighter && highlightLanguageOf(this.highlighter, path)
        if (this.destroyed || !this.highlighter || !language) {
          return
        }
        this.decorations = highlight(this.highlighter, language, this.view.state.doc)
        this.view.dispatch({ effects: refreshEffect.of(null) })
      }

      destroy() {
        this.destroyed = true
        window.clearTimeout(this.timer)
      }
    },
    { decorations: (plugin) => plugin.decorations },
  )
