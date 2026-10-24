export enum SearchOption {
  CaseSensitive = 'caseSensitive',
  WholeWord = 'wholeWord',
  Regex = 'regex',
}

export type SearchOptions = Record<SearchOption, boolean>

export interface TextMatch {
  start: number
  length: number
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  [SearchOption.CaseSensitive]: false,
  [SearchOption.WholeWord]: false,
  [SearchOption.Regex]: false,
}

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g
const WORD_SEPARATORS = '[ ~!@#$%^&*()+`\\-=[\\]{}|\\\\;:"\',./<>?]'

const escapeRegex = (text: string): string => text.replace(REGEX_SPECIAL_CHARACTERS, '\\$&')

const compile = (source: string, flags = ''): RegExp | null => {
  try {
    return new RegExp(source, flags)
  } catch {
    return null
  }
}

export const searchPattern = (query: string, options: SearchOptions): RegExp | null => {
  const source = options[SearchOption.Regex] ? query : escapeRegex(query)
  if (!compile(source)) {
    return null
  }
  const bounded = options[SearchOption.WholeWord] ? `(?<=^|${WORD_SEPARATORS})(?:${source})(?=$|${WORD_SEPARATORS})` : source
  return compile(bounded, options[SearchOption.CaseSensitive] ? '' : 'i')
}

export const firstMatch = (text: string, pattern: RegExp): TextMatch | null => {
  const found = pattern.exec(text)
  return found && found[0].length > 0 ? { start: found.index, length: found[0].length } : null
}
