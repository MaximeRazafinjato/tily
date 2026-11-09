export enum NoteHistoryCommand {
  Undo = 'undo',
  Redo = 'redo',
}

export interface NoteRestore {
  value: string
  selectionStart: number
  selectionEnd: number
}

interface NoteHistoryKey {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

interface NoteStep {
  start: number
  removed: string
  inserted: string
}

interface NoteHistory {
  value: string
  undo: NoteStep[]
  redo: NoteStep[]
  typing: boolean
}

const HISTORY_DEPTH = 200
const TYPING_INPUTS = new Set(['insertText', 'insertLineBreak', 'insertCompositionText', 'deleteContentBackward', 'deleteContentForward', 'deleteWordBackward', 'deleteWordForward'])

const histories = new Map<string, NoteHistory>()

const commonPrefixLength = (before: string, after: string, limit: number): number => {
  let length = 0
  while (length < limit && before[length] === after[length]) {
    length += 1
  }
  return length
}

const commonSuffixLength = (before: string, after: string, limit: number): number => {
  let length = 0
  while (length < limit && before[before.length - 1 - length] === after[after.length - 1 - length]) {
    length += 1
  }
  return length
}

const changeOf = (before: string, after: string, caret: number): NoteStep => {
  const suffix = commonSuffixLength(before, after, Math.min(before.length, after.length, after.length - caret))
  const prefix = commonPrefixLength(before, after, Math.min(before.length, after.length) - suffix)
  return { start: prefix, removed: before.slice(prefix, before.length - suffix), inserted: after.slice(prefix, after.length - suffix) }
}

const touches = (last: NoteStep, next: NoteStep): boolean => {
  const lastEnd = last.start + last.inserted.length
  return next.start <= lastEnd && lastEnd <= next.start + next.removed.length
}

const merged = (last: NoteStep, next: NoteStep, between: string, after: string): NoteStep => {
  const lastEnd = last.start + last.inserted.length
  const start = Math.min(last.start, next.start)
  const end = Math.max(lastEnd, next.start + next.removed.length)
  return {
    start,
    removed: between.slice(start, last.start) + last.removed + between.slice(lastEnd, end),
    inserted: after.slice(start, end - next.removed.length + next.inserted.length),
  }
}

const historyFor = (workspaceId: string, value: string): NoteHistory => {
  const known = histories.get(workspaceId)
  if (known && known.value === value) {
    return known
  }
  const fresh: NoteHistory = { value, undo: [], redo: [], typing: false }
  histories.set(workspaceId, fresh)
  return fresh
}

export const noteHistoryCommandOf = ({ key, ctrlKey, shiftKey, altKey, metaKey }: NoteHistoryKey): NoteHistoryCommand | undefined => {
  if (!ctrlKey || altKey || metaKey) {
    return undefined
  }
  const letter = key.toLowerCase()
  if (letter === 'z') {
    return shiftKey ? NoteHistoryCommand.Redo : NoteHistoryCommand.Undo
  }
  return letter === 'y' && !shiftKey ? NoteHistoryCommand.Redo : undefined
}

export const recordNoteEdit = (workspaceId: string, before: string, after: string, caret: number, inputType: string): void => {
  if (before === after) {
    return
  }
  const history = historyFor(workspaceId, before)
  const change = changeOf(before, after, caret)
  const typing = TYPING_INPUTS.has(inputType)
  const last = history.undo.at(-1)
  history.value = after
  history.redo = []
  if (typing && history.typing && last && touches(last, change)) {
    const step = merged(last, change, before, after)
    history.undo.pop()
    if (step.removed !== step.inserted) {
      history.undo.push(step)
    }
    history.typing = step.removed !== step.inserted
    return
  }
  history.undo.push(change)
  if (history.undo.length > HISTORY_DEPTH) {
    history.undo.shift()
  }
  history.typing = typing
}

export const closeNoteTyping = (workspaceId: string): void => {
  const history = histories.get(workspaceId)
  if (history) {
    history.typing = false
  }
}

export const undoNoteEdit = (workspaceId: string, current: string): NoteRestore | undefined => {
  const history = histories.get(workspaceId)
  const step = history?.value === current ? history.undo.pop() : undefined
  if (!history || !step) {
    return undefined
  }
  const value = current.slice(0, step.start) + step.removed + current.slice(step.start + step.inserted.length)
  history.redo.push(step)
  history.value = value
  history.typing = false
  return { value, selectionStart: step.start, selectionEnd: step.start + step.removed.length }
}

export const redoNoteEdit = (workspaceId: string, current: string): NoteRestore | undefined => {
  const history = histories.get(workspaceId)
  const step = history?.value === current ? history.redo.pop() : undefined
  if (!history || !step) {
    return undefined
  }
  const value = current.slice(0, step.start) + step.inserted + current.slice(step.start + step.removed.length)
  const caret = step.start + step.inserted.length
  history.undo.push(step)
  history.value = value
  history.typing = false
  return { value, selectionStart: caret, selectionEnd: caret }
}

export const forgetMissingNoteHistories = (liveWorkspaceIds: Set<string>): void => {
  for (const workspaceId of histories.keys()) {
    if (!liveWorkspaceIds.has(workspaceId)) {
      histories.delete(workspaceId)
    }
  }
}
