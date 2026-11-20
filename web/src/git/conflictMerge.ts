import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { searchKeymap } from '@codemirror/search'
import { EditorState, Prec, StateEffect, StateField, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers, type DecorationSet } from '@codemirror/view'
import { syntaxHighlighting } from '@codemirror/language'
import { GitMergeChunkKind, type GitConflictFile } from '../bridge/gitMessages'
import { editorHighlightStyle, editorTheme, FRENCH_PHRASES, languageExtensions } from '../preview/editorSetup'
import { alignmentDecorations, conflictTheme, HEADER_HEIGHT, LINE_HEIGHT, lineCounts, type ConflictHeader, type GapHandlers } from './conflictGaps'
import { conflictLayout, ConflictSide, sideLines, sideTitle, type ConflictChunk } from './conflictLayout'
import { blockCheck, isLinePicked, PickCheck, setBlock, sideCheck, toggleBlock, toggleLines } from './conflictPicks'
import { pickGutter, type SideLine } from './conflictPickGutter'
import { pickBlocks, resultBlocksField, resultHistory, unresolvedCount, type BlockResolution, type PickRequest, type ResultBlocks } from './conflictResult'
import { blockOffsets, syncScroll } from './conflictScroll'

export interface ConflictMergeParents {
  ours: HTMLElement
  result: HTMLElement
  theirs: HTMLElement
}

export type SideChecks = Record<ConflictSide, PickCheck>

export interface ConflictMergeHandlers {
  onStatus: (unresolved: number) => void
  onSides: (checks: SideChecks) => void
  onChange: () => void
  onSave: () => void
}

export interface ConflictMergeController {
  total: number
  content: () => string
  unresolved: () => number
  next: () => void
  previous: () => void
  toggleSide: (side: ConflictSide) => void
  destroy: () => void
}

const sideSyncEffect = StateEffect.define<BlockResolution>()

const SIDE_CHANGES: Record<ConflictSide, GitMergeChunkKind> = {
  [ConflictSide.Ours]: GitMergeChunkKind.Ours,
  [ConflictSide.Theirs]: GitMergeChunkKind.Theirs,
}

const sideLineClass = (chunk: ConflictChunk, side: ConflictSide, sync: BlockResolution, index: number, line: number): string | null => {
  if (chunk.conflict !== null) {
    return isLinePicked(sync.picks[index], side, line) ? 'cm-conflict-taken' : sync.resolved[index] ? 'cm-conflict-dropped' : 'cm-conflict-line'
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

const sideLineIndex = (chunks: ConflictChunk[], side: ConflictSide): (SideLine | null)[] => [
  null,
  ...chunks.flatMap((chunk, index) => sideLines(chunk, side).map((_, line) => (chunk.conflict === null ? null : { index, line }))),
]

export const createConflictMerge = (parents: ConflictMergeParents, file: GitConflictFile, handlers: ConflictMergeHandlers): ConflictMergeController => {
  const layout = conflictLayout(file)
  const { chunks, conflictCount } = layout
  const sideCounts: Record<ConflictSide, number[]> = {
    [ConflictSide.Ours]: chunks.map((chunk) => chunk.ours.length),
    [ConflictSide.Theirs]: chunks.map((chunk) => chunk.theirs.length),
  }
  const sideBounds: Record<ConflictSide, number[]> = { [ConflictSide.Ours]: layout.oursBounds, [ConflictSide.Theirs]: layout.theirsBounds }
  const lineIndex: Record<ConflictSide, (SideLine | null)[]> = { [ConflictSide.Ours]: sideLineIndex(chunks, ConflictSide.Ours), [ConflictSide.Theirs]: sideLineIndex(chunks, ConflictSide.Theirs) }
  const targets = chunks.map((_, index) => Math.max(sideCounts[ConflictSide.Ours][index], sideCounts[ConflictSide.Theirs][index]))
  const conflictIndexes = chunks.flatMap((chunk, index) => (chunk.conflict === null ? [] : [index]))
  const field = resultBlocksField(chunks, layout.resultBounds)
  const views: EditorView[] = []
  const gapHandlers: GapHandlers = { toggleBlock: (conflict, side) => toggleBlockAt(chunks.findIndex((chunk) => chunk.conflict === conflict), side) }

  const header = (index: number, sync: BlockResolution, side: ConflictSide | null): ConflictHeader | null => {
    const chunk = chunks[index]
    if (chunk.conflict === null) {
      return null
    }
    return { conflict: chunk.conflict, total: conflictCount, resolved: sync.resolved[index], side, check: side === null ? PickCheck.Unchecked : blockCheck(chunk, sync.picks[index], side) }
  }

  const headerHeight = (index: number): number => (chunks[index].conflict === null ? 0 : HEADER_HEIGHT)
  const sideOffsets = blockOffsets(targets.map((count, index) => headerHeight(index) + count * LINE_HEIGHT))

  const result = (): EditorView => views[1]

  const resultOffsets = (): number[] => {
    const { state } = result()
    return blockOffsets(lineCounts(state.doc, state.field(field).bounds).map((count, index) => headerHeight(index) + count * LINE_HEIGHT))
  }

  const picksOf = (index: number) => result().state.field(field).picks[index]

  const pick = (requests: PickRequest[]): void => {
    const spec = requests.length === 0 ? null : pickBlocks(result().state, field, chunks, requests)
    if (spec) {
      result().dispatch(spec)
    }
  }

  function toggleBlockAt(index: number, side: ConflictSide): void {
    if (index >= 0 && chunks[index].conflict !== null) {
      pick([{ index, picks: toggleBlock(chunks[index], picksOf(index), side) }])
    }
  }

  const toggleLine = ({ index, line }: SideLine, side: ConflictSide): void => pick([{ index, picks: toggleLines(picksOf(index), side, [line]) }])

  const toggleSelection = (view: EditorView, side: ConflictSide): boolean => {
    const { doc, selection } = view.state
    const { from, to } = selection.main
    const last = doc.lineAt(to)
    const lastNumber = to > from && last.from === to ? last.number - 1 : last.number
    const byBlock = new Map<number, number[]>()
    for (let number = doc.lineAt(from).number; number <= lastNumber; number++) {
      const target = lineIndex[side][number]
      if (target) {
        byBlock.set(target.index, [...(byBlock.get(target.index) ?? []), target.line])
      }
    }
    pick([...byBlock].map(([index, lines]) => ({ index, picks: toggleLines(picksOf(index), side, lines) })))
    return true
  }

  const sideChecks = (blocks: BlockResolution): SideChecks => ({
    [ConflictSide.Ours]: sideCheck(conflictIndexes.map((index) => blockCheck(chunks[index], blocks.picks[index], ConflictSide.Ours))),
    [ConflictSide.Theirs]: sideCheck(conflictIndexes.map((index) => blockCheck(chunks[index], blocks.picks[index], ConflictSide.Theirs))),
  })

  const toggleSide = (side: ConflictSide): void => {
    const blocks = result().state.field(field)
    const checked = sideChecks(blocks)[side] !== PickCheck.Checked
    pick(conflictIndexes.map((index) => ({ index, picks: setBlock(chunks[index], blocks.picks[index], side, checked) })))
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

  const toggleCurrent = (view: EditorView, side: ConflictSide): boolean => {
    const position = view.state.selection.main.head
    const bounds = view === result() ? view.state.field(field).bounds : sideBounds[view === views[0] ? ConflictSide.Ours : ConflictSide.Theirs]
    const index = chunkAt(chunks, bounds, position)
    if (index !== null) {
      toggleBlockAt(index, side)
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
        { key: 'Ctrl-Alt-ArrowLeft', preventDefault: true, run: (view) => toggleCurrent(view, ConflictSide.Ours) },
        { key: 'Ctrl-Alt-ArrowRight', preventDefault: true, run: (view) => toggleCurrent(view, ConflictSide.Theirs) },
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
      EditorView.decorations.compute(['doc', field], (state) => {
        const blocks = state.field(field)
        const counts = lineCounts(state.doc, blocks.bounds)
        return alignmentDecorations(state.doc, { bounds: blocks.bounds, counts, targets: counts, headerOf: (index) => header(index, blocks, null), lineClassOf: (index) => resultLineClass(chunks[index], blocks, index) }, gapHandlers)
      }),
      shared('Résultat de la résolution'),
      EditorView.updateListener.of((update) => {
        const before = update.startState.field(field)
        const after = update.state.field(field)
        if (before.resolved !== after.resolved || before.picks !== after.picks) {
          const sync: BlockResolution = { resolved: after.resolved, picks: after.picks }
          views[0]?.dispatch({ effects: sideSyncEffect.of(sync) })
          views[2]?.dispatch({ effects: sideSyncEffect.of(sync) })
          handlers.onStatus(unresolvedCount(after))
          handlers.onSides(sideChecks(after))
        }
        if (update.docChanged) {
          handlers.onChange()
        }
      }),
    ],
  })

  const initial = resultState.field(field)
  const syncField = StateField.define<BlockResolution>({
    create: () => ({ resolved: initial.resolved, picks: initial.picks }),
    update: (value, transaction) => transaction.effects.reduce((current, effect) => (effect.is(sideSyncEffect) ? effect.value : current), value),
  })

  const sideDecorations = (state: EditorState, side: ConflictSide): DecorationSet => {
    const sync = state.field(syncField)
    return alignmentDecorations(
      state.doc,
      { bounds: sideBounds[side], counts: sideCounts[side], targets, headerOf: (index) => header(index, sync, side), lineClassOf: (index, line) => sideLineClass(chunks[index], side, sync, index, line) },
      gapHandlers,
    )
  }

  const sideState = (side: ConflictSide, doc: string) =>
    EditorState.create({
      doc,
      extensions: [
        syncField,
        EditorView.decorations.compute([syncField], (state) => sideDecorations(state, side)),
        EditorState.readOnly.of(true),
        pickGutter({
          lineAt: (lineNumber) => lineIndex[side][lineNumber] ?? null,
          isPicked: (state, { index, line }) => isLinePicked(state.field(syncField).picks[index], side, line),
          changed: (update) => update.startState.field(syncField) !== update.state.field(syncField),
          toggle: (target) => toggleLine(target, side),
        }),
        Prec.high(keymap.of([{ key: 'Space', preventDefault: true, run: (view) => toggleSelection(view, side) }])),
        shared(sideTitle(side, file.sides)),
      ],
    })

  views.push(
    new EditorView({ parent: parents.ours, state: sideState(ConflictSide.Ours, layout.oursText) }),
    new EditorView({ parent: parents.result, state: resultState }),
    new EditorView({ parent: parents.theirs, state: sideState(ConflictSide.Theirs, layout.theirsText) }),
  )

  const stopScroll = syncScroll([
    { view: views[0], offsets: () => sideOffsets },
    { view: views[1], offsets: resultOffsets },
    { view: views[2], offsets: () => sideOffsets },
  ])

  handlers.onStatus(unresolvedCount(initial))
  handlers.onSides(sideChecks(initial))
  goTo(conflictIndexes[0], false)

  return {
    total: conflictCount,
    content: () => result().state.doc.toString(),
    unresolved: () => unresolvedCount(result().state.field(field)),
    next,
    previous,
    toggleSide,
    destroy: () => {
      stopScroll()
      views.forEach((view) => view.destroy())
    },
  }
}
