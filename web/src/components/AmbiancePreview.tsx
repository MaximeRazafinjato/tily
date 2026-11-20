import type { CSSProperties } from 'react'
import type { AmbianceSettings } from '../bridge/appearanceMessages'
import { ambianceBackgroundShown, ambianceTerminalShown } from '../ambiance/ambianceActions'
import { AmbianceLayer } from './AmbianceLayer'

interface AmbiancePreviewProps {
  ambiance: AmbianceSettings
}

const WIDTH = 1280
const HEIGHT = 720
const SCALE = 0.4
const TERMINAL_LINES = ['PS C:\\Files\\Projects\\tily> git status', 'Sur la branche feat/ambiance', 'rien à valider, la copie de travail est propre', 'PS C:\\Files\\Projects\\tily> claude']
const WORKSPACES = ['tily', 'oif-mc', 'notes']

const surface = (token: string, veil: number | null): CSSProperties => ({
  backgroundColor: veil === null ? `var(--color-tily-${token})` : `color-mix(in srgb, var(--color-tily-${token}) ${veil}%, transparent)`,
})

function PreviewPane({ ambiance, active }: { ambiance: AmbianceSettings; active: boolean }) {
  const terminal = ambianceTerminalShown(ambiance)
  const accent = ambiance.animatedAccent && ambiance.enabled ? ambiance.gradient.colors[0] : 'var(--color-tily-green)'
  const cursor = terminal && ambiance.terminal.presetColors ? ambiance.gradient.colors[0] : 'var(--color-tily-terminal-ink)'
  const fontFamily = terminal && ambiance.terminal.fontFamily ? `"${ambiance.terminal.fontFamily}", var(--font-mono)` : 'var(--font-mono)'
  return (
    <div className="grid min-h-0 flex-1 grid-rows-[24px_1fr] overflow-hidden rounded-md border" style={{ borderColor: active ? accent : 'var(--color-tily-line)', ...(terminal ? {} : surface('terminal', null)) }}>
      <div className="flex items-center px-2 text-[12px] text-tily-muted">pwsh · tily</div>
      <div className="flex flex-col gap-1 p-2 text-[14px] text-tily-terminal-ink" style={{ fontFamily, ...surface('terminal', terminal ? ambiance.terminal.veil : null) }}>
        {TERMINAL_LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
        <span className="h-[16px] w-[9px]" style={{ backgroundColor: cursor }} />
      </div>
    </div>
  )
}

export function AmbiancePreview({ ambiance }: AmbiancePreviewProps) {
  const background = ambianceBackgroundShown(ambiance)
  const veil = background ? ambiance.interfaceVeil : null
  const accent = ambiance.animatedAccent && ambiance.enabled ? ambiance.gradient.colors[0] : 'var(--color-tily-green)'
  return (
    <div aria-label="Aperçu de l’ambiance" role="img" className="relative col-span-2 overflow-hidden rounded-md border border-tily-line" style={{ width: WIDTH * SCALE, height: HEIGHT * SCALE }}>
      <div className="pointer-events-none absolute top-0 left-0 isolate flex origin-top-left flex-col bg-tily-paper text-tily-ink" style={{ width: WIDTH, height: HEIGHT, transform: `scale(${SCALE})` }}>
        {background && <AmbianceLayer ambiance={ambiance} scope="tily-ambient-preview" className="absolute inset-0 -z-10 overflow-hidden" />}
        <div className="flex h-[34px] shrink-0 items-center border-b border-tily-line px-3 text-[13px] font-semibold" style={surface('panel', veil)}>
          Tily
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex w-[220px] shrink-0 flex-col gap-2 p-3 text-[13px]" style={surface('paper', veil)}>
            {WORKSPACES.map((workspace, index) => (
              <span key={workspace} style={index === 0 ? { color: accent } : undefined}>
                {workspace}
              </span>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-[32px] items-end gap-1 px-2 text-[12px]">
              <span className="rounded-t-md border border-b-0 border-tily-line px-4 py-1" style={{ color: accent, ...surface('panel', background ? Math.max(ambiance.interfaceVeil, 50) : null) }}>
                tily
              </span>
              <span className="px-4 py-1 text-tily-muted">notes</span>
            </div>
            <div className="flex min-h-0 flex-1 gap-1 border-t border-tily-line p-1" style={surface('panel', veil)}>
              <PreviewPane ambiance={ambiance} active />
              <PreviewPane ambiance={ambiance} active={false} />
            </div>
          </div>
        </div>
        <div className="flex h-[24px] shrink-0 items-center border-t border-tily-line px-3 text-[11px] text-tily-muted" style={surface('paper', veil)}>
          Session restaurée
        </div>
      </div>
    </div>
  )
}
