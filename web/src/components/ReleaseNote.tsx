interface ReleaseNoteProps {
  text: string
}

const CODE_DELIMITER = '`'
const BOLD_DELIMITER = '**'

const renderBold = (text: string, key: number) =>
  text.split(BOLD_DELIMITER).map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${key}-${index}`} className="font-semibold text-tily-ink">
        {part}
      </strong>
    ) : (
      <span key={`${key}-${index}`}>{part}</span>
    ),
  )

export function ReleaseNote({ text }: ReleaseNoteProps) {
  return (
    <>
      {text.split(CODE_DELIMITER).map((part, index) =>
        index % 2 === 1 ? (
          <code key={index} className="rounded bg-tily-paper px-1 font-mono text-[11px] text-tily-green-deep">
            {part}
          </code>
        ) : (
          renderBold(part, index)
        ),
      )}
    </>
  )
}
