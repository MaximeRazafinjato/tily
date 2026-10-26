import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'
import { SETTINGS_GRID, SETTINGS_ROW } from './settingsStyles'

interface SettingsPanelProps {
  title: string
  tip?: string
  grid?: boolean
  children: ReactNode
}

export function SettingsPanel({ title, tip, grid = true, children }: SettingsPanelProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className={SETTINGS_ROW}>
        <h3 className="text-[13px] font-semibold text-tily-ink">{title}</h3>
        {tip && <InfoTip text={tip} />}
      </div>
      <div className={grid ? SETTINGS_GRID : 'flex flex-col gap-2'}>{children}</div>
    </section>
  )
}
