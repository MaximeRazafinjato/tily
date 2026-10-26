export const PANEL_HEADER_BUTTON =
  'flex size-[24px] shrink-0 cursor-pointer items-center justify-center rounded-md text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-tily-muted'

export const ROW_ACTION =
  'flex size-[20px] shrink-0 cursor-pointer items-center justify-center rounded text-tily-muted hover:bg-tily-panel hover:text-tily-ink'

const BOXED_BUTTON = 'flex shrink-0 cursor-pointer items-center justify-center rounded-[4px] border'

const STAGE_COLORS = 'border-tily-green bg-tily-green-soft text-tily-green-deep hover:bg-tily-green hover:text-tily-paper'

const UNSTAGE_COLORS = 'border-tily-error bg-tily-diff-removed text-tily-diff-removed-ink hover:bg-tily-error hover:text-tily-paper'

export const DIFF_STAGE_BUTTON = `${BOXED_BUTTON} size-[16px] ${STAGE_COLORS}`

export const DIFF_UNSTAGE_BUTTON = `${BOXED_BUTTON} size-[16px] ${UNSTAGE_COLORS}`

export const ROW_STAGE_BUTTON = `${BOXED_BUTTON} mx-[1px] size-[18px] ${STAGE_COLORS}`

export const ROW_UNSTAGE_BUTTON = `${BOXED_BUTTON} mx-[1px] size-[18px] ${UNSTAGE_COLORS}`

export const SECTION_TITLE = 'text-[11px] font-semibold tracking-[0.06em] text-tily-muted uppercase'

export const SECTION_HEADING = 'text-[11px] font-semibold tracking-[0.06em] text-tily-ink uppercase'

const GIT_BUTTON = 'cursor-pointer rounded border px-3 py-1 text-[12px] aria-disabled:cursor-default aria-disabled:opacity-50'

export const GIT_PRIMARY = `${GIT_BUTTON} border-tily-green text-tily-green-deep hover:bg-tily-green-soft aria-disabled:hover:bg-transparent`

export const GIT_SECONDARY = `${GIT_BUTTON} border-tily-line text-tily-ink hover:bg-tily-green-hover aria-disabled:hover:bg-transparent`

export const GIT_DANGER = `${GIT_BUTTON} border-tily-error text-tily-error hover:bg-tily-green-hover`

export const GIT_INPUT = 'w-full rounded border border-tily-line bg-tily-panel px-2 py-1 text-[12px] text-tily-ink outline-none placeholder:text-tily-muted focus:border-tily-focus'
