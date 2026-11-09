import DOMPurify from 'dompurify'
import { Marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { markedHighlight } from 'marked-highlight'
import { hljs } from './syntaxHighlighter'

const HEADING_PREFIX = 'preview-'
const MAX_HIGHLIGHTED_CHARS = 512 * 1024
const FORBIDDEN_TAGS = ['style', 'form', 'base', 'link', 'meta', 'iframe', 'object', 'embed']
const EXTERNAL_SOURCE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i

const markdown = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight: (code, lang) => hljs.highlight(code, { language: hljs.getLanguage(lang) ? lang : 'plaintext' }).value,
  }),
  gfmHeadingId({ prefix: HEADING_PREFIX }),
  { gfm: true },
)

let imageBase = ''

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  const source = node.tagName === 'IMG' ? node.getAttribute('src') : null
  if (source && !EXTERNAL_SOURCE.test(source) && imageBase) {
    node.setAttribute('src', new URL(source, imageBase).href)
  }
})

export const renderMarkdown = (content: string, baseUrl: string): string => {
  imageBase = baseUrl
  try {
    return DOMPurify.sanitize(markdown.parse(content, { async: false }), { FORBID_TAGS: FORBIDDEN_TAGS })
  } finally {
    imageBase = ''
  }
}

export const highlightText = (content: string, language: string | undefined): string | null =>
  language && hljs.getLanguage(language) && content.length <= MAX_HIGHLIGHTED_CHARS ? hljs.highlight(content, { language }).value : null

export const anchorTarget = (root: HTMLElement, anchor: string): HTMLElement | null => {
  const escaped = CSS.escape(anchor)
  return root.querySelector<HTMLElement>(`[id="${CSS.escape(HEADING_PREFIX + anchor.toLowerCase())}"], [id="${escaped}"], [name="${escaped}"]`)
}
