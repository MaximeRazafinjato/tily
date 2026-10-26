import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'
import { SETTINGS_FIELD_LABEL } from './settingsStyles'

interface SettingsFieldProps {
  label: string
  tip?: string
  htmlFor?: string
  marker?: ReactNode
  children: ReactNode
}

export function SettingsField({ label, tip, htmlFor, marker, children }: SettingsFieldProps) {
  return (
    <>
      <span className={SETTINGS_FIELD_LABEL}>
        {htmlFor ? <label htmlFor={htmlFor}>{label}</label> : label}
        {marker}
        {tip && <InfoTip text={tip} />}
      </span>
      <div className="flex min-h-[30px] min-w-0 flex-col justify-center gap-1.5">{children}</div>
    </>
  )
}
