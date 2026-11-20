import { invertedEffects, isolateHistory } from '@codemirror/commands'
import { StateEffect, StateField, type ChangeDesc, type EditorState, type TransactionSpec } from '@codemirror/state'
import { linesText, type ConflictChunk } from './conflictLayout'
import { pickedLines, samePicks, type ConflictPick } from './conflictPicks'

export interface ResultBlocks {
  bounds: number[]
  resolved: boolean[]
  picks: ConflictPick[][]
}

export interface PickRequest {
  index: number
  picks: ConflictPick[]
}

export type BlockResolution = Pick<ResultBlocks, 'resolved' | 'picks'>

const pickEffect = StateEffect.define<PickRequest>()
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

const resolve = (value: ResultBlocks, touched: Set<number>, requests: PickRequest[]): BlockResolution => {
  const picked = new Map(requests.map((request) => [request.index, request.picks]))
  const changed = picked.size > 0 || [...touched].some((index) => !value.resolved[index])
  if (!changed) {
    return value
  }
  const picks = value.picks.map((current, index) => picked.get(index) ?? current)
  const resolved = value.resolved.map((done, index) => (picked.has(index) ? picks[index].length > 0 : done || touched.has(index)))
  return { resolved, picks }
}

export const resultBlocksField = (chunks: ConflictChunk[], bounds: number[]) =>
  StateField.define<ResultBlocks>({
    create: () => ({ bounds, resolved: chunks.map((chunk) => chunk.conflict === null), picks: chunks.map(() => []) }),
    update: (value, transaction) => {
      if (!transaction.docChanged && transaction.effects.length === 0) {
        return value
      }
      const mapped = transaction.docChanged ? mapBounds(value.bounds, chunks, transaction.changes) : value.bounds
      const restore = transaction.effects.find((effect) => effect.is(restoreEffect))
      if (restore?.is(restoreEffect)) {
        return { bounds: mapped, ...restore.value }
      }
      const requests = transaction.effects.flatMap((effect) => (effect.is(pickEffect) ? [effect.value] : []))
      const touched = transaction.docChanged ? touchedBlocks(value.bounds, chunks, transaction.changes) : new Set<number>()
      const resolution = resolve(value, touched, requests)
      return mapped === value.bounds && resolution === value ? value : { bounds: mapped, resolved: resolution.resolved, picks: resolution.picks }
    },
  })

export const resultHistory = (field: StateField<ResultBlocks>) =>
  invertedEffects.of((transaction) => {
    const before = transaction.startState.field(field, false)
    const after = transaction.state.field(field, false)
    return before && after && (before.resolved !== after.resolved || before.picks !== after.picks) ? [restoreEffect.of({ resolved: before.resolved, picks: before.picks })] : []
  })

export const pickBlocks = (state: EditorState, field: StateField<ResultBlocks>, chunks: ConflictChunk[], requests: PickRequest[]): TransactionSpec | null => {
  const { bounds, picks } = state.field(field)
  const changed = requests.filter((request) => chunks[request.index]?.conflict !== null && !samePicks(picks[request.index], request.picks))
  if (changed.length === 0) {
    return null
  }
  return {
    changes: changed.map(({ index, picks: next }) => ({ from: bounds[index], to: bounds[index + 1], insert: linesText(pickedLines(chunks[index], next)) })),
    effects: changed.map((request) => pickEffect.of(request)),
    annotations: isolateHistory.of('full'),
    userEvent: 'input.conflict',
  }
}

export const unresolvedCount = (blocks: ResultBlocks): number => blocks.resolved.filter((done) => !done).length
