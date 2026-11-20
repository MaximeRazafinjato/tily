import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { bracketMatching, HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { properties } from '@codemirror/legacy-modes/mode/properties'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view'
import { tags } from '@lezer/highlight'

const MARKDOWN_LANGUAGE = 'markdown'

const LANGUAGES: Record<string, () => Extension> = {
  json: () => json(),
  yaml: () => yaml(),
  xml: () => xml(),
  html: () => html(),
  ini: () => StreamLanguage.define(properties),
  [MARKDOWN_LANGUAGE]: () => markdown(),
}

const SELECTION = 'color-mix(in srgb, var(--color-tily-green) 32%, transparent)'

export const editorTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--color-tily-ink)', fontSize: '12.5px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.5' },
    '.cm-content': { caretColor: 'var(--color-tily-focus)', paddingBlock: '12px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-tily-focus)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': { backgroundColor: SELECTION },
    '.cm-gutters': { backgroundColor: 'var(--color-tily-panel)', color: 'var(--color-tily-muted)', border: 'none' },
    '.cm-lineNumbers .cm-gutterElement': { paddingInline: '12px 8px' },
    '.cm-activeLine': { backgroundColor: 'var(--color-tily-green-hover)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--color-tily-green-hover)', color: 'var(--color-tily-ink-soft)' },
    '.cm-selectionMatch': { backgroundColor: 'var(--color-tily-green-soft)' },
    '.cm-searchMatch': { backgroundColor: 'color-mix(in srgb, var(--color-tily-warning) 30%, transparent)' },
    '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'color-mix(in srgb, var(--color-tily-warning) 55%, transparent)' },
    '&.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--color-tily-green-soft)', outline: '1px solid var(--color-tily-green)' },
    '.cm-panels': { backgroundColor: 'var(--color-tily-panel)', color: 'var(--color-tily-ink)' },
    '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--color-tily-line)' },
    '.cm-search': { padding: '4px 8px', fontSize: '12px' },
    '.cm-textfield': { boxSizing: 'border-box', height: '24px', margin: '2px 4px 2px 0', padding: '0 6px', verticalAlign: 'middle', fontSize: '12px', backgroundColor: 'var(--color-tily-paper)', border: '1px solid var(--color-tily-line)', borderRadius: '4px', color: 'var(--color-tily-ink)' },
    '.cm-button': { boxSizing: 'border-box', height: '24px', margin: '2px 4px 2px 0', padding: '0 8px', verticalAlign: 'middle', fontSize: '12px', backgroundImage: 'none', backgroundColor: 'var(--color-tily-paper)', border: '1px solid var(--color-tily-line)', borderRadius: '4px', color: 'var(--color-tily-ink)' },
    '.cm-search label': { display: 'inline-flex', alignItems: 'center', gap: '5px', height: '24px', margin: '2px 10px 2px 4px', verticalAlign: 'middle', fontSize: '12px', color: 'var(--color-tily-ink-soft)' },
    '.cm-search input[type=checkbox]': { margin: '0', accentColor: 'var(--color-tily-green)' },
  },
  { dark: true },
)

export const editorHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier, tags.bool, tags.null], color: 'var(--color-tily-syntax-keyword)' },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--color-tily-syntax-string)' },
  { tag: [tags.number, tags.atom], color: 'var(--color-tily-syntax-number)' },
  { tag: [tags.heading, tags.tagName, tags.typeName, tags.className], color: 'var(--color-tily-syntax-title)' },
  { tag: tags.heading, fontWeight: '600' },
  { tag: [tags.propertyName, tags.attributeName, tags.definition(tags.propertyName), tags.meta], color: 'var(--color-tily-syntax-attr)' },
  { tag: [tags.link, tags.url], color: 'var(--color-tily-syntax-attr)', textDecoration: 'underline' },
  { tag: [tags.comment, tags.quote], color: 'var(--color-tily-syntax-comment)', fontStyle: 'italic' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
])

export const FRENCH_PHRASES = EditorState.phrases.of({
  Find: 'Rechercher',
  Replace: 'Remplacer',
  next: 'suivant',
  previous: 'précédent',
  all: 'tout',
  'match case': 'respecter la casse',
  'by word': 'mot entier',
  regexp: 'expression régulière',
  replace: 'remplacer',
  'replace all': 'tout remplacer',
  close: 'fermer',
  'current match': 'occurrence courante',
  'on line': 'à la ligne',
  'replaced match on line $': 'occurrence remplacée à la ligne $',
  'replaced $ matches': '$ occurrences remplacées',
  'Go to line': 'Aller à la ligne',
  go: 'aller',
  'Control character': 'Caractère de contrôle',
})

export const languageExtensions = (language: string | null | undefined): Extension[] => (language && LANGUAGES[language] ? [LANGUAGES[language]()] : [])

interface EditorHandlers {
  onChange: (text: string) => void
  onSave: () => void
}

export const editorExtensions = (language: string | undefined, { onChange, onSave }: EditorHandlers): Extension[] => [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  drawSelection(),
  dropCursor(),
  bracketMatching(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  EditorView.lineWrapping,
  syntaxHighlighting(editorHighlightStyle),
  editorTheme,
  FRENCH_PHRASES,
  keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => {
      onSave()
      return true
    } }, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      onChange(update.state.doc.toString())
    }
  }),
  ...languageExtensions(language),
]
