import { useEffect, useMemo, useState } from 'react'
import type { GitDiff } from '../bridge/gitMessages'
import { highlightDiffRows, loadDiffHighlighter, loadedDiffHighlighter } from '../git/gitDiffHighlight'
import type { DiffRow } from '../git/gitDiffRows'

const keepPlainText = () => undefined

export const useDiffHighlight = (diff: GitDiff | null, rows: DiffRow[]): (string | undefined)[] | null => {
  const [highlighter, setHighlighter] = useState(loadedDiffHighlighter)

  useEffect(() => {
    if (!highlighter) {
      loadDiffHighlighter().then(setHighlighter, keepPlainText)
    }
  }, [highlighter])

  return useMemo(() => (diff && highlighter ? highlightDiffRows(highlighter, diff.path, rows) : null), [diff, highlighter, rows])
}
