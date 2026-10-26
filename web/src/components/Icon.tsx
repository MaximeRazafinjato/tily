import type { ReactNode } from 'react'
import { IconName } from './iconName'

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

const DEFAULT_SIZE = 12

const SHAPES: Record<IconName, ReactNode> = {
  [IconName.Agent]: <path d="M6 1.6 7 5l3.4 1L7 7l-1 3.4L5 7 1.6 6 5 5Z" />,
  [IconName.Branch]: (
    <>
      <circle cx="3" cy="2.5" r="1.2" />
      <circle cx="3" cy="9.5" r="1.2" />
      <circle cx="9" cy="4" r="1.2" />
      <path d="M3 3.7v4.6M9 5.2c0 2-6 1.5-6 3.5" />
    </>
  ),
  [IconName.Browser]: <path d="M5 2.2H2.6a.8.8 0 0 0-.8.8v6.4a.8.8 0 0 0 .8.8H9a.8.8 0 0 0 .8-.8V7M7.2 1.8h3v3M10.2 1.8 5.6 6.4" />,
  [IconName.Menu]: <path d="M2 3h8M2 6h8M2 9h8" />,
  [IconName.MergeRequest]: (
    <>
      <circle cx="3" cy="2.5" r="1.2" />
      <circle cx="3" cy="9.5" r="1.2" />
      <circle cx="9" cy="9.5" r="1.2" />
      <path d="M3 3.7v4.6M9 8.3V5a1.5 1.5 0 0 0-1.5-1.5H5.6M7 2.1 5.6 3.5 7 4.9" />
    </>
  ),
  [IconName.Check]: <path d="M2.5 6.3 5 8.8l4.5-5.3" />,
  [IconName.Search]: (
    <>
      <circle cx="4.95" cy="4.95" r="3.2" />
      <path d="M7.35 7.35 10.25 10.25" />
    </>
  ),
  [IconName.Chevron]: <path d="M4.5 2.5 8 6l-3.5 3.5" />,
  [IconName.Close]: <path d="M3 3l6 6M9 3 3 9" />,
  [IconName.CollapseAll]: <path d="M3.5 1.8 6 4.3l2.5-2.5M3.5 10.2 6 7.7l2.5 2.5" />,
  [IconName.Copy]: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" />
      <path d="M8 4V2.5A1 1 0 0 0 7 1.5H2.5a1 1 0 0 0-1 1V7a1 1 0 0 0 1 1H4" />
    </>
  ),
  [IconName.Columns]: (
    <>
      <rect x="1.5" y="2" width="9" height="8" rx="1" />
      <path d="M4.5 2v8M7.5 2v8" />
    </>
  ),
  [IconName.Discard]: (
    <>
      <path d="M2.3 2.8v2.6h2.6" />
      <path d="M2.6 5.2a3.6 3.6 0 1 1 .7 3.4" />
    </>
  ),
  [IconName.Editor]: <path d="M4 3 1.5 6 4 9M8 3l2.5 3L8 9" />,
  [IconName.Expand]: <path d="M7.2 1.8h3v3M10.2 1.8 7 5M4.8 10.2h-3v-3M1.8 10.2 5 7" />,
  [IconName.Explorer]: (
    <>
      <rect x="1.5" y="2" width="9" height="8" rx="1" />
      <path d="M7.3 2v8" />
    </>
  ),
  [IconName.Fetch]: (
    <>
      <path d="M3.2 8.6H3a2.1 2.1 0 0 1-.3-4.2 3.2 3.2 0 0 1 6.1-.9 2.3 2.3 0 0 1 .6 4.5" />
      <path d="M6 5.4v5.1M4.4 9 6 10.6 7.6 9" />
    </>
  ),
  [IconName.File]: (
    <>
      <path d="M3 1.5h3.8L9.5 4.2v5.8a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" />
      <path d="M6.8 1.5v2.7h2.7" />
    </>
  ),
  [IconName.Folder]: <path d="M1.5 9.2V2.8a.8.8 0 0 1 .8-.8h2.5l1 1.1h3.9a.8.8 0 0 1 .8.8v5.3a.8.8 0 0 1-.8.8H2.3a.8.8 0 0 1-.8-.8Z" />,
  [IconName.Graph]: (
    <>
      <circle cx="3" cy="2.5" r="1.1" />
      <circle cx="3" cy="9.5" r="1.1" />
      <circle cx="9" cy="6" r="1.1" />
      <path d="M3 3.6v4.8M3 4.2c0 1.5 4.9.3 4.9 1.8M3 7.8c0-1.5 4.9-.3 4.9-1.8" />
    </>
  ),
  [IconName.Info]: (
    <>
      <circle cx="6" cy="6" r="4.7" />
      <path d="M6 5.5v2.9M6 3.7v.1" />
    </>
  ),
  [IconName.Local]: (
    <>
      <rect x="2.3" y="2.5" width="7.4" height="5" rx=".7" />
      <path d="M1 9.5h10" />
    </>
  ),
  [IconName.Minus]: <path d="M2.2 6h7.6" />,
  [IconName.More]: (
    <>
      <circle cx="2.6" cy="6" r=".9" fill="currentColor" stroke="none" />
      <circle cx="6" cy="6" r=".9" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="6" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  [IconName.NewFile]: (
    <>
      <path d="M6 10.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5h3.3L9 4.2V6" />
      <path d="M6.3 1.5v2.7H9M9 7.6v3M7.5 9.1h3" />
    </>
  ),
  [IconName.NewFolder]: (
    <>
      <path d="M5.8 10H2.3a.8.8 0 0 1-.8-.8V2.8a.8.8 0 0 1 .8-.8h2.5l1 1.1h3.9a.8.8 0 0 1 .8.8v1.8" />
      <path d="M9 7v3.2M7.4 8.6h3.2" />
    </>
  ),
  [IconName.Pencil]: <path d="M7.9 2.1 9.9 4.1 4.3 9.7 1.8 10.2 2.3 7.7ZM6.9 3.1 8.9 5.1" />,
  [IconName.Note]: (
    <>
      <path d="M3 1.5h6a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V2a.5.5 0 0 1 .5-.5Z" />
      <path d="M4.3 4h3.4M4.3 6h3.4M4.3 8h2" />
    </>
  ),
  [IconName.Plus]: <path d="M6 2.2v7.6M2.2 6h7.6" />,
  [IconName.Project]: (
    <>
      <path d="M1.5 8.5V2.8a.8.8 0 0 1 .8-.8h2.4l1 1.1h3.7a.8.8 0 0 1 .8.8v1.1" />
      <path d="M1.5 8.5h3.3" />
      <circle cx="7.9" cy="7.4" r="1.8" />
      <path d="m9.2 8.7 1.3 1.3" />
    </>
  ),
  [IconName.Pull]: <path d="M6 1.5v7M3.2 5.7 6 8.5l2.8-2.8M2.5 10.5h7" />,
  [IconName.Push]: <path d="M6 8.5v-7M3.2 4.3 6 1.5l2.8 2.8M2.5 10.5h7" />,
  [IconName.Refresh]: (
    <>
      <path d="M10 6a4 4 0 1 1-1.2-2.85" />
      <path d="M9.3 1.6v2H7.3" />
    </>
  ),
  [IconName.Remote]: <path d="M3.3 9.5H3a2.2 2.2 0 0 1-.3-4.4 3.3 3.3 0 0 1 6.3-.9 2.4 2.4 0 0 1 .2 4.8Z" />,
  [IconName.RemoteOff]: (
    <>
      <path d="M3.3 9.5H3a2.2 2.2 0 0 1-.3-4.4 3.3 3.3 0 0 1 6.3-.9 2.4 2.4 0 0 1 .2 4.8Z" />
      <path d="M1.5 1.5l9 9" />
    </>
  ),
  [IconName.Settings]: (
    <>
      <circle cx="6" cy="6" r="3.2" />
      <circle cx="6" cy="6" r="1.2" />
      <path d="M6 1.2v1.6M6 9.2v1.6M1.2 6h1.6M9.2 6h1.6M2.6 2.6l1.1 1.1M8.3 8.3l1.1 1.1M2.6 9.4l1.1-1.1M8.3 3.7l1.1-1.1" />
    </>
  ),
  [IconName.Sidebar]: (
    <>
      <rect x="1.5" y="2" width="9" height="8" rx="1" />
      <path d="M4.7 2v8" />
    </>
  ),
  [IconName.Star]: <path d="M6 1.57 7.18 4.85 10.66 4.96 7.9 7.09 8.88 10.43 6 8.47 3.12 10.43 4.1 7.09 1.34 4.96 4.82 4.85Z" />,
  [IconName.Stash]: (
    <>
      <path d="M1.5 4.5h9v5.2a.8.8 0 0 1-.8.8H2.3a.8.8 0 0 1-.8-.8Z" />
      <path d="M1 2h10v2.5H1ZM4.6 6.8h2.8" />
    </>
  ),
  [IconName.Switch]: <path d="M2 4h7.5M7.6 2.1 9.5 4 7.6 5.9M10 8H2.5M4.4 6.1 2.5 8l1.9 1.9" />,
  [IconName.Tag]: (
    <>
      <path d="M1.5 2.3v3.2l5 5a.8.8 0 0 0 1.1 0l2.9-2.9a.8.8 0 0 0 0-1.1l-5-5H2.3a.8.8 0 0 0-.8.8Z" />
      <circle cx="4" cy="4" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  [IconName.Undo]: <path d="M4 2.4 1.8 4.6 4 6.8M2 4.6h5.2a2.8 2.8 0 0 1 0 5.6H4.6" />,
  [IconName.Worktree]: (
    <>
      <path d="M6 1.3 3.2 5.2h1.6L2.6 8.4h6.8L7.2 5.2h1.6Z" />
      <path d="M6 8.4v2.4" />
    </>
  ),
}

export function Icon({ name, size = DEFAULT_SIZE, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {SHAPES[name]}
    </svg>
  )
}
