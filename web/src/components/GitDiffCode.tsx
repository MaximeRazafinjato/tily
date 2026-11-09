interface GitDiffCodeProps {
  text: string
  html: string | undefined
}

const CODE_CLASSES = 'pr-[16px] whitespace-pre'
const HIGHLIGHTED_CLASSES = `${CODE_CLASSES} text-tily-terminal-ink`

export function GitDiffCode({ text, html }: GitDiffCodeProps) {
  return html === undefined ? <span className={CODE_CLASSES}>{text}</span> : <span className={HIGHLIGHTED_CLASSES} dangerouslySetInnerHTML={{ __html: html }} />
}
