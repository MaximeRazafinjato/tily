import { GitDiffLineKind } from '../bridge/gitMessages'
import type { DiffRow } from './gitDiffRows'

type Highlighter = typeof import('../preview/syntaxHighlighter')

const EXTRA_LANGUAGES = new Map([
  ['csproj', 'xml'],
  ['slnx', 'xml'],
  ['props', 'xml'],
  ['targets', 'xml'],
  ['resx', 'xml'],
  ['xaml', 'xml'],
  ['config', 'xml'],
  ['manifest', 'xml'],
  ['nuspec', 'xml'],
  ['editorconfig', 'ini'],
  ['env', 'ini'],
  ['cfg', 'ini'],
  ['conf', 'ini'],
  ['properties', 'ini'],
  ['npmrc', 'ini'],
  ['psm1', 'powershell'],
  ['psd1', 'powershell'],
])

const MAX_HIGHLIGHTED_CHARS = 256 * 1024
const PLAIN_TEXT = 'plaintext'
const OLD_SIDE = new Set([GitDiffLineKind.Context, GitDiffLineKind.Removed])
const NEW_SIDE = new Set([GitDiffLineKind.Context, GitDiffLineKind.Added])
const HTML_PARTS = /(<span[^>]*>|<\/span>|\n)/
const OPENING_SPAN = '<span'
const CLOSING_SPAN = '</span>'

let loaded: Highlighter | null = null
let loading: Promise<Highlighter> | null = null

export const loadedDiffHighlighter = (): Highlighter | null => loaded

export const loadDiffHighlighter = (): Promise<Highlighter> => {
  loading ??= import('../preview/syntaxHighlighter').then(
    (module) => (loaded = module),
    (error: unknown) => {
      loading = null
      throw error
    },
  )
  return loading
}

const languageOf = ({ hljs }: Highlighter, path: string): string | null => {
  const name = path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1).toLowerCase()
  const extension = name.slice(name.lastIndexOf('.') + 1)
  const language = EXTRA_LANGUAGES.get(extension) ?? extension
  const definition = language ? hljs.getLanguage(language) : undefined
  return definition && definition !== hljs.getLanguage(PLAIN_TEXT) ? language : null
}

const htmlLines = (html: string): string[] => {
  const lines: string[] = []
  const open: string[] = []
  let line = ''
  for (const part of html.split(HTML_PARTS)) {
    if (part === '\n') {
      lines.push(line + CLOSING_SPAN.repeat(open.length))
      line = open.join('')
      continue
    }
    if (part === CLOSING_SPAN) {
      open.pop()
    } else if (part.startsWith(OPENING_SPAN)) {
      open.push(part)
    }
    line += part
  }
  lines.push(line)
  return lines
}

const hunkLines = (rows: DiffRow[]): number[][] => {
  const byHunk = new Map<number, number[]>()
  rows.forEach((row, index) => {
    if (!row.line || row.hunk === undefined) {
      return
    }
    const indexes = byHunk.get(row.hunk)
    if (indexes) {
      indexes.push(index)
    } else {
      byHunk.set(row.hunk, [index])
    }
  })
  return [...byHunk.values()]
}

export const highlightDiffRows = (highlighter: Highlighter, path: string, rows: DiffRow[]): (string | undefined)[] | null => {
  const language = languageOf(highlighter, path)
  if (!language || rows.reduce((size, row) => size + row.text.length + 1, 0) > MAX_HIGHLIGHTED_CHARS) {
    return null
  }
  const highlighted: (string | undefined)[] = []
  const paint = (indexes: number[]) => {
    if (indexes.length === 0) {
      return
    }
    const lines = htmlLines(highlighter.hljs.highlight(indexes.map((index) => rows[index].text).join('\n'), { language }).value)
    indexes.forEach((index, position) => {
      highlighted[index] = lines[position]
    })
  }
  for (const indexes of hunkLines(rows)) {
    const side = (kinds: Set<GitDiffLineKind>) => indexes.filter((index) => kinds.has(rows[index].line?.kind ?? GitDiffLineKind.Note))
    if (indexes.some((index) => rows[index].line?.kind === GitDiffLineKind.Removed)) {
      paint(side(OLD_SIDE))
    }
    paint(side(NEW_SIDE))
  }
  return highlighted
}
