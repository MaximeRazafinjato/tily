import { useEffect, useState } from 'react'
import { useUpdateStore } from '../store/updateStore'
import { requestReleaseHistory, retryReleaseHistory } from '../update/updateActions'
import { SettingsPanel } from './SettingsPanel'
import { ReleaseHistoryItem } from './ReleaseHistoryItem'
import { SETTINGS_HINT, SETTINGS_SECONDARY } from './settingsStyles'
import { Spinner } from './Spinner'

interface ReleaseNotesSettingsSectionProps {
  title: string
}

const SECTION_TIP = 'Toutes les versions publiées sur GitHub, de la plus récente à la plus ancienne. Tily Beta liste aussi les bêtas.'

export function ReleaseNotesSettingsSection({ title }: ReleaseNotesSettingsSectionProps) {
  const history = useUpdateStore((state) => state.history)
  const loading = useUpdateStore((state) => state.historyLoading)
  const error = useUpdateStore((state) => state.historyError)
  const current = useUpdateStore((state) => state.info?.current)
  const [toggled, setToggled] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    requestReleaseHistory()
  }, [])

  const latest = history?.[0]?.version
  const isExpanded = (version: string): boolean => toggled.has(version) !== (version === latest)
  const handleToggle = (version: string) =>
    setToggled((previous) => {
      const next = new Set(previous)
      if (!next.delete(version)) {
        next.add(version)
      }
      return next
    })

  return (
    <SettingsPanel title={title} tip={SECTION_TIP} grid={false}>
      {loading && (
        <span className={`flex items-center gap-2 ${SETTINGS_HINT}`}>
          <Spinner size={11} className="text-tily-green" />
          Lecture des versions sur GitHub…
        </span>
      )}
      {error && (
        <span className="flex items-center gap-2 text-[12px] text-tily-error">
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" className={SETTINGS_SECONDARY} onClick={retryReleaseHistory}>
            Réessayer
          </button>
        </span>
      )}
      {history && history.length === 0 && <p className={SETTINGS_HINT}>Aucune version publiée.</p>}
      {history && history.length > 0 && (
        <ul className="flex flex-col gap-3">
          {history.map((entry) => (
            <ReleaseHistoryItem key={entry.version} entry={entry} installed={entry.version === current} expanded={isExpanded(entry.version)} onToggle={handleToggle} />
          ))}
        </ul>
      )}
    </SettingsPanel>
  )
}
