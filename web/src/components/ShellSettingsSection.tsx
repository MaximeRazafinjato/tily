import type { ChangeEvent, ReactNode } from 'react'
import type { SettingsSnapshot } from '../bridge/messages'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_BROWSE, SETTINGS_INPUT } from './settingsStyles'

interface ShellSettingsSectionProps {
  title: string
  shellSettings: SettingsSnapshot['shellSettings']
  shells: Record<string, string>
  editor: string
  onShellsChange: (shells: Record<string, string>) => void
  onEditorChange: (editor: string) => void
  onPickShell: (id: string) => void
  onPickEditor: () => void
}

const EDITOR_ID = 'settings-editor'
const AVAILABLE = 'Disponible'
const MISSING = 'Introuvable'

const browseButton = (tip: string, onClick: () => void) => (
  <button type="button" className={SETTINGS_BROWSE} aria-label={tip} data-tip={tip} onClick={onClick}>
    <Icon name={IconName.More} />
  </button>
)

const pathRow = (input: ReactNode, browse: ReactNode) => (
  <span className="flex gap-1">
    {input}
    {browse}
  </span>
)

export function ShellSettingsSection({ title, shellSettings, shells, editor, onShellsChange, onEditorChange, onPickShell, onPickEditor }: ShellSettingsSectionProps) {
  const handleEditorChange = (event: ChangeEvent<HTMLInputElement>) => onEditorChange(event.target.value)

  return (
    <SettingsPanel title={title} tip="Vide : chemin par défaut, affiché en filigrane.">
      {shellSettings.map((shell) => {
        const id = `settings-shell-${shell.id}`
        const handleChange = (event: ChangeEvent<HTMLInputElement>) => onShellsChange({ ...shells, [shell.id]: event.target.value })
        const handlePick = () => onPickShell(shell.id)
        const status = shell.available ? AVAILABLE : MISSING
        const marker = <span className={`size-1.5 shrink-0 rounded-full ${shell.available ? 'bg-tily-green' : 'bg-tily-warning'}`} role="img" aria-label={status} data-tip={status} />
        return (
          <SettingsField key={shell.id} label={shell.name} htmlFor={id} marker={marker}>
            {pathRow(<input id={id} type="text" className={SETTINGS_INPUT} value={shells[shell.id] ?? ''} placeholder={shell.defaultExecutable} spellCheck={false} onChange={handleChange} />, browseButton(`Choisir l’exécutable de ${shell.name}`, handlePick))}
            {!shell.available && <span className="text-[11px] text-tily-warning">Introuvable : le chemin est enregistré, mais le shell reste indisponible.</span>}
          </SettingsField>
        )
      })}
      <SettingsField label="Éditeur" tip="Commande d’ouverture d’un dossier." htmlFor={EDITOR_ID}>
        {pathRow(<input id={EDITOR_ID} type="text" className={SETTINGS_INPUT} value={editor} placeholder="code.cmd" spellCheck={false} onChange={handleEditorChange} />, browseButton('Choisir l’exécutable de l’éditeur', onPickEditor))}
      </SettingsField>
    </SettingsPanel>
  )
}
