import { invertedEffects, isolateHistory } from '@codemirror/commands'
import { StateEffect, StateField, type ChangeDesc, type EditorState, type TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { ConflictSide, linesText, sideLines, type ConflictChunk } from './conflictLayout'

export interface ResultBlocks {
  bounds: number[]
  resolved: boolean[]
  taken: ConflictSide[][]
}

interface TakeRequest {
  index: number
  side: ConflictSide
}

type BlockResolution = Pick<ResultBlocks, 'resolved' | 'taken'>

const takeEffect = StateEffect.define<TakeRequest>()
const restoreEffect = StateEffect.define<BlockResolution>()

const mapBounds = (bounds: number[], chunks: ConflictChunk[], changes: ChangeDesc): number[] =>
  bounds.map((position, index) => {
    if (index === 0) {
      return 0
    }
    if (index === bounds.length - 1) {
      return changes.mapPos(position, 1)
    }
    const assoc = chunks[index].conflict === null && chunks[index - 1].conflict !== null ? 1 : -1
    return changes.mapPos(position, assoc)
  })

const touchedBlocks = (bounds: number[], chunks: ConflictChunk[], changes: ChangeDesc): Set<number> => {
  const touched = new Set<number>()
  changes.iterChangedRanges((fromA, toA) => {
    chunks.forEach((chunk, index) => {
      if (chunk.conflict !== null && fromA <= bounds[index + 1] && toA >= bounds[index]) {
        touched.add(index)
      }
    })
  })
  return touched
}

const resolve = (value: ResultBlocks, touched: Set<number>, takes: TakeRequest[]): BlockResolution => {
  const changed = takes.length > 0 || [...touched].some((index) => !value.resolved[index])
  if (!changed) {
    return value
  }
  const taken = value.taken.map((sides, index) => {
    const added = takes.filter((take) => take.index === index).map((take) => take.side)
    return added.length > 0 ? [...sides, ...added] : sides
  })
  const resolved = value.resolved.map((done, index) => done || touched.has(index) || taken[index].length > 0)
  return { resolved, taken }
}

export const resultBlocksField = (chunks: ConflictChunk[], bounds: number[]) =>
  StateField.define<ResultBlocks>({
    create: () => ({ bounds, resolved: chunks.map((chunk) => chunk.conflict === null), taken: chunks.map(() => []) }),
    update: (value, transaction) => {
      if (!transaction.docChanged && transaction.effects.length === 0) {
        return value
      }
      const mapped = transaction.docChanged ? mapBounds(value.bounds, chunks, transaction.changes) : value.bounds
      const restore = transaction.effects.find((effect) => effect.is(restoreEffect))
      if (restore?.is(restoreEffect)) {
        return { bounds: mapped, ...restore.value }
      }
      const takes = transaction.effects.flatMap((effect) => (effect.is(takeEffect) ? [effect.value] : []))
      const touched = transaction.docChanged ? touchedBlocks(value.bounds, chunks, transaction.changes) : new Set<number>()
      const resolution = resolve(value, touched, takes)
      return mapped === value.bounds && resolution === value ? value : { bounds: mapped, resolved: resolution.resolved, taken: resolution.taken }
    },
  })

export const resultHistory = (field: StateField<ResultBlocks>) =>
  invertedEffects.of((transaction) => {
    const before = transaction.startState.field(field, false)
    const after = transaction.state.field(field, false)
    return before && after && (before.resolved !== after.resolved || before.taken !== after.taken) ? [restoreEffect.of({ resolved: before.resolved, taken: before.taken })] : []
  })

export const takeSide = (state: EditorState, field: StateField<ResultBlocks>, chunks: ConflictChunk[], index: number, side: ConflictSide): TransactionSpec | null => {
  const { bounds, resolved, taken } = state.field(field)
  if (chunks[index]?.conflict === null || taken[index].includes(side)) {
    return null
  }
  const from = resolved[index] ? bounds[index + 1] : bounds[index]
  return {
    changes: { from, to: bounds[index + 1], insert: linesText(sideLines(chunks[index], side)) },
    effects: [takeEffect.of({ index, side }), EditorView.scrollIntoView(bounds[index], { y: 'nearest' })],
    selection: { anchor: bounds[index] },
    annotations: isolateHistory.of('full'),
    userEvent: 'input.conflict',
  }
}

export const unresolvedCount = (blocks: ResultBlocks): number => blocks.resolved.filter((done) => !done).length
