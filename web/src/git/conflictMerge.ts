import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { EditorState, Prec, StateEffect, StateField, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, type DecorationSet } from '@codemirror/view'
import { syntaxHighlighting } from '@codemirror/language'
import { GitMergeChunkKind, type GitConflictFile } from '../bridge/gitMessages'
import { editorHighlightStyle, editorTheme, FRENCH_PHRASES, languageExtensions } from '../preview/editorSetup'
import { alignmentDecorations, conflictTheme, lineCounts, type ConflictHeader, type GapHandlers } from './conflictGaps'
import { ConflictColumn, conflictLayout, ConflictSide, sideTitle, type ConflictChunk } from './conflictLayout'
import { resultBlocksField, resultHistory, takeSide, unresolvedCount, type ResultBlocks } from './conflictResult'

export interface ConflictMergeParents {
  ours: HTMLElement
  result: HTMLElement
  theirs: HTMLElement
}

export interface ConflictMergeHandlers {
  onStatus: (unresolved: number) => void
  onChange: () => void
  onSave: () => void
}

export interface ConflictMergeController {
  total: number
  content: () => string
  unresolved: () => number
  next: () => void
  previous: () => void
  destroy: () => void
}

type SideSync = Pick<ResultBlocks, 'resolved' | 'taken'> & { resultCounts: number[] }

const sideSyncEffect = StateEffect.define<SideSync>()

const SIDE_CHANGES: Record<ConflictSide, GitMergeChunkKind> = {
  [ConflictSide.Ours]: GitMergeChunkKind.Ours,
  [ConflictSide.Theirs]: GitMergeChunkKind.Theirs,
}

const sideLineClass = (chunk: ConflictChunk, side: ConflictSide, sync: SideSync, index: number): string | null => {
  if (chunk.conflict !== null) {
    return sync.taken[index].includes(side) ? 'cm-conflict-taken' : sync.resolved[index] ? 'cm-conflict-dropped' : 'cm-conflict-line'
  }
  return chunk.kind === SIDE_CHANGES[side] || chunk.kind === GitMergeChunkKind.Both ? 'cm-change-line' : null
}

const resultLineClass = (chunk: ConflictChunk, blocks: ResultBlocks, index: number): string | null => {
  if (chunk.conflict !== null) {
    return blocks.resolved[index] ? 'cm-resolved-line' : null
  }
  return chunk.kind === GitMergeChunkKind.Common ? null : 'cm-change-line'
}

const chunkAt = (chunks: ConflictChunk[], bounds: number[], position: number): number | null => {
  const index = chunks.findIndex((chunk, candidate) => chunk.conflict !== null && bounds[candidate] <= position && position <= bounds[candidate + 1])
  return index < 0 ? null : index
}

export const createConflictMerge = (parents: ConflictMergeParents, file: GitConflictFile, handlers: ConflictMergeHandlers): ConflictMergeController => {
  const layout = conflictLayout(file)
  const { chunks, conflictCount } = layout
  const sideCounts: Record<ConflictSide, number[]> = {
    [ConflictSide.Ours]: chunks.map((chunk) => chunk.ours.length),
    [ConflictSide.Theirs]: chunks.map((chunk) => chunk.theirs.length),
  }
  const sideBounds: Record<ConflictSide, number[]> = { [ConflictSide.Ours]: layout.oursBounds, [ConflictSide.Theirs]: layout.theirsBounds }
  const targetsOf = (resultCounts: number[]) => resultCounts.map((count, index) => Math.max(count, sideCounts[ConflictSide.Ours][index], sideCounts[ConflictSide.Theirs][index]))
  const field = resultBlocksField(chunks, layout.resultBounds)
  const views: EditorView[] = []
  const gapHandlers: GapHandlers = { take: (conflict, side) => take(chunks.findIndex((chunk) => chunk.conflict === conflict), side) }

  const header = (index: number, column: ConflictColumn, sync: Pick<ResultBlocks, 'resolved' | 'taken'>, side: ConflictSide | null): ConflictHeader | null => {
    const { conflict } = chunks[index]
    return conflict === null ? null : { conflict, total: conflictCount, column, resolved: sync.resolved[index], taken: side !== null && sync.taken[index].includes(side) }
  }

  const sideDecorations = (state: EditorState, side: ConflictSide, sync: SideSync): DecorationSet =>
    alignmentDecorations(
      state.doc,
      {
        bounds: sideBounds[side],
        counts: sideCounts[side],
        targets: targetsOf(sync.resultCounts),
        headerOf: (index) => header(index, side === ConflictSide.Ours ? ConflictColumn.Ours : ConflictColumn.Theirs, sync, side),
        lineClassOf: (index) => sideLineClass(chunks[index], side, sync, index),
      },
      gapHandlers,
    )

  const resultDecorations = (state: EditorState): DecorationSet => {
    const blocks = state.field(field)
    const counts = lineCounts(state.doc, blocks.bounds)
    return alignmentDecorations(
      state.doc,
      { bounds: blocks.bounds, counts, targets: targetsOf(counts), headerOf: (index) => header(index, ConflictColumn.Result, blocks, null), lineClassOf: (index) => resultLineClass(chunks[index], blocks, index) },
      gapHandlers,
    )
  }

  const syncOf = (state: EditorState): SideSync => {
    const blocks = state.field(field)
    return { resolved: blocks.resolved, taken: blocks.taken, resultCounts: lineCounts(state.doc, blocks.bounds) }
  }

  const sideField = (side: ConflictSide, initial: SideSync) =>
    StateField.define<DecorationSet>({
      create: (state) => sideDecorations(state, side, initial),
      update: (decorations, transaction) => {
        const sync = transaction.effects.find((effect) => effect.is(sideSyncEffect))
        return sync?.is(sideSyncEffect) ? sideDecorations(transaction.state, side, sync.value) : decorations
      },
      provide: (decorationField) => EditorView.decorations.from(decorationField),
    })

  const result = (): EditorView => views[1]

  function take(index: number, side: ConflictSide): void {
    const spec = index < 0 ? null : takeSide(result().state, field, chunks, index, side)
    if (spec) {
      result().dispatch(spec)
    }
  }

  const goTo = (index: number | undefined, focus = true): void => {
    if (index === undefined) {
      return
    }
    const position = result().state.field(field).bounds[index]
    result().dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'center' }) })
    if (focus) {
      result().focus()
    }
  }

  const conflictIndexes = chunks.flatMap((chunk, index) => (chunk.conflict === null ? [] : [index]))

  const next = (): void => {
    const { bounds } = result().state.field(field)
    const position = result().state.selection.main.head
    goTo(conflictIndexes.find((index) => bounds[index] > position) ?? conflictIndexes[0])
  }

  const previous = (): void => {
    const { bounds } = result().state.field(field)
    const position = result().state.selection.main.head
    goTo(conflictIndexes.findLast((index) => bounds[index] < position) ?? conflictIndexes.at(-1))
  }

  const takeCurrent = (view: EditorView, side: ConflictSide): boolean => {
    const position = view.state.selection.main.head
    const bounds = view === result() ? view.state.field(field).bounds : sideBounds[view === views[0] ? ConflictSide.Ours : ConflictSide.Theirs]
    const index = chunkAt(chunks, bounds, position)
    if (index !== null) {
      take(index, side)
    }
    return true
  }

  const command = (run: () => void) => () => {
    run()
    return true
  }

  const shared = (label: string): Extension[] => [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    drawSelection(),
    highlightActiveLine(),
    syntaxHighlighting(editorHighlightStyle),
    editorTheme,
    conflictTheme,
    FRENCH_PHRASES,
    EditorView.contentAttributes.of({ 'aria-label': label }),
    Prec.high(
      keymap.of([
        { key: 'F7', preventDefault: true, run: command(next) },
        { key: 'Shift-F7', preventDefault: true, run: command(previous) },
        { key: 'Ctrl-Alt-ArrowLeft', preventDefault: true, run: (view) => takeCurrent(view, ConflictSide.Ours) },
        { key: 'Ctrl-Alt-ArrowRight', preventDefault: true, run: (view) => takeCurrent(view, ConflictSide.Theirs) },
        { key: 'Mod-s', preventDefault: true, run: command(handlers.onSave) },
      ]),
    ),
    keymap.of([...defaultKeymap, ...searchKeymap]),
    ...languageExtensions(file.language),
  ]

  const resultState = EditorState.create({
    doc: layout.resultText,
    extensions: [
      field,
      resultHistory(field),
      history(),
      keymap.of(historyKeymap),
      EditorView.decorations.compute(['doc', field], resultDecorations),
      shared('Résultat de la résolution'),
      EditorView.updateListener.of((update) => {
        if (update.startState.field(field) !== update.state.field(field) || update.docChanged) {
          const sync = syncOf(update.state)
          views[0]?.dispatch({ effects: sideSyncEffect.of(sync) })
          views[2]?.dispatch({ effects: sideSyncEffect.of(sync) })
          handlers.onStatus(unresolvedCount(update.state.field(field)))
        }
        if (update.docChanged) {
          handlers.onChange()
        }
      }),
    ],
  })
  const initial = syncOf(resultState)
  const sideState = (side: ConflictSide, doc: string) =>
    EditorState.create({ doc, extensions: [sideField(side, initial), EditorState.readOnly.of(true), shared(sideTitle(side, file.sides))] })

  views.push(
    new EditorView({ parent: parents.ours, state: sideState(ConflictSide.Ours, layout.oursText) }),
    new EditorView({ parent: parents.result, state: resultState }),
    new EditorView({ parent: parents.theirs, state: sideState(ConflictSide.Theirs, layout.theirsText) }),
  )

  let leader: EditorView | null = null
  let release = 0
  const listeners = views.map((source) => {
    const listener = () => {
      if (leader && leader !== source) {
        return
      }
      leader = source
      cancelAnimationFrame(release)
      release = requestAnimationFrame(() => {
        leader = null
      })
      for (const view of views) {
        if (view !== source && view.scrollDOM.scrollTop !== source.scrollDOM.scrollTop) {
          view.scrollDOM.scrollTop = source.scrollDOM.scrollTop
        }
      }
    }
    source.scrollDOM.addEventListener('scroll', listener)
    return listener
  })

  handlers.onStatus(unresolvedCount(resultState.field(field)))
  goTo(conflictIndexes[0], false)

  return {
    total: conflictCount,
    content: () => result().state.doc.toString(),
    unresolved: () => unresolvedCount(result().state.field(field)),
    next,
    previous,
    destroy: () => {
      cancelAnimationFrame(release)
      views.forEach((view, index) => {
        view.scrollDOM.removeEventListener('scroll', listeners[index])
        view.destroy()
      })
    },
  }
}
