import { ConflictSide, sideLines, type ConflictChunk } from './conflictLayout'

export interface ConflictPick {
  side: ConflictSide
  lines: number[]
}

export enum PickCheck {
  Unchecked = 'unchecked',
  Mixed = 'mixed',
  Checked = 'checked',
}

const sideLength = (chunk: ConflictChunk, side: ConflictSide): number => sideLines(chunk, side).length

const linesOf = (picks: ConflictPick[], side: ConflictSide): number[] | null => picks.find((pick) => pick.side === side)?.lines ?? null

const withSideLines = (picks: ConflictPick[], side: ConflictSide, lines: number[] | null): ConflictPick[] => {
  if (lines === null) {
    return picks.filter((pick) => pick.side !== side)
  }
  const sorted = [...new Set(lines)].sort((first, second) => first - second)
  return picks.some((pick) => pick.side === side) ? picks.map((pick) => (pick.side === side ? { side, lines: sorted } : pick)) : [...picks, { side, lines: sorted }]
}

const allLines = (chunk: ConflictChunk, side: ConflictSide): number[] => sideLines(chunk, side).map((_, line) => line)

export const pickedLines = (chunk: ConflictChunk, picks: ConflictPick[]): string[] => picks.flatMap(({ side, lines }) => lines.map((line) => sideLines(chunk, side)[line]))

export const isLinePicked = (picks: ConflictPick[], side: ConflictSide, line: number): boolean => linesOf(picks, side)?.includes(line) ?? false

export const blockCheck = (chunk: ConflictChunk, picks: ConflictPick[], side: ConflictSide): PickCheck => {
  const lines = linesOf(picks, side)
  if (lines === null) {
    return PickCheck.Unchecked
  }
  return lines.length === sideLength(chunk, side) ? PickCheck.Checked : PickCheck.Mixed
}

export const toggleBlock = (chunk: ConflictChunk, picks: ConflictPick[], side: ConflictSide): ConflictPick[] =>
  withSideLines(picks, side, blockCheck(chunk, picks, side) === PickCheck.Checked ? null : allLines(chunk, side))

export const toggleLines = (picks: ConflictPick[], side: ConflictSide, lines: number[]): ConflictPick[] => {
  const current = linesOf(picks, side) ?? []
  if (lines.every((line) => current.includes(line))) {
    const remaining = current.filter((line) => !lines.includes(line))
    return withSideLines(picks, side, remaining.length > 0 ? remaining : null)
  }
  return withSideLines(picks, side, [...current, ...lines])
}

export const setBlock = (chunk: ConflictChunk, picks: ConflictPick[], side: ConflictSide, checked: boolean): ConflictPick[] => withSideLines(picks, side, checked ? allLines(chunk, side) : null)

export const sideCheck = (checks: PickCheck[]): PickCheck => {
  if (checks.length > 0 && checks.every((check) => check === PickCheck.Checked)) {
    return PickCheck.Checked
  }
  return checks.every((check) => check === PickCheck.Unchecked) ? PickCheck.Unchecked : PickCheck.Mixed
}

export const samePicks = (first: ConflictPick[], second: ConflictPick[]): boolean =>
  first.length === second.length && first.every((pick, index) => pick.side === second[index].side && pick.lines.length === second[index].lines.length && pick.lines.every((line, position) => line === second[index].lines[position]))
