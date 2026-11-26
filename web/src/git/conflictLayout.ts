import { GitMergeChunkKind, type GitConflictFile, type GitConflictSides } from '../bridge/gitMessages'

export enum ConflictSide {
  Ours = 'ours',
  Theirs = 'theirs',
}

export interface ConflictChunk {
  kind: GitMergeChunkKind
  ours: string[]
  theirs: string[]
  conflict: number | null
}

export interface ConflictLayout {
  chunks: ConflictChunk[]
  conflictCount: number
  oursText: string
  theirsText: string
  resultText: string
  oursBounds: number[]
  theirsBounds: number[]
  resultBounds: number[]
}

export const linesText = (lines: string[]): string => lines.map((line) => `${line}\n`).join('')

const boundsOf = (texts: string[]): number[] => {
  const bounds = [0]
  for (const text of texts) {
    bounds.push(bounds[bounds.length - 1] + text.length)
  }
  return bounds
}

export const conflictLayout = (file: GitConflictFile): ConflictLayout => {
  let conflictCount = 0
  const chunks = file.chunks.map((chunk) => ({ kind: chunk.kind, ours: chunk.ours, theirs: chunk.theirs, conflict: chunk.kind === GitMergeChunkKind.Conflict ? conflictCount++ : null }))
  const ours = chunks.map((chunk) => linesText(chunk.ours))
  const theirs = chunks.map((chunk) => linesText(chunk.theirs))
  const result = file.chunks.map((chunk) => linesText(chunk.result ?? []))
  return {
    chunks,
    conflictCount,
    oursText: ours.join(''),
    theirsText: theirs.join(''),
    resultText: result.join(''),
    oursBounds: boundsOf(ours),
    theirsBounds: boundsOf(theirs),
    resultBounds: boundsOf(result),
  }
}

export const sideLines = (chunk: ConflictChunk, side: ConflictSide): string[] => (side === ConflictSide.Ours ? chunk.ours : chunk.theirs)

export const resultContent = (text: string, finalNewline: boolean): string => (finalNewline || !text.endsWith('\n') ? text : text.slice(0, -1))

const SIDE_ROLES: Record<ConflictSide, string> = {
  [ConflictSide.Ours]: 'courante',
  [ConflictSide.Theirs]: 'entrante',
}

const sideName = (side: ConflictSide, sides: GitConflictSides): string | null | undefined => (side === ConflictSide.Ours ? sides.ours : sides.theirs)

export const sideTitle = (side: ConflictSide, sides: GitConflictSides): string => {
  const name = sideName(side, sides)
  const role = `${SIDE_ROLES[side].charAt(0).toUpperCase()}${SIDE_ROLES[side].slice(1)}`
  return name ? `${role} · ${name}` : role
}

export const keepLabel = (side: ConflictSide, sides: GitConflictSides): string => {
  const name = sideName(side, sides)
  return name ? `Garder « ${name} » (${SIDE_ROLES[side]})` : `Garder la version ${SIDE_ROLES[side]}`
}
