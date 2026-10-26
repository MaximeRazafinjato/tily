import type { SettingsSnapshot } from '../bridge/messages'
import { McpSettingsField } from './McpSettingsField'
import { SettingsField } from './SettingsField'
import { SettingsPanel } from './SettingsPanel'
import { SETTINGS_PRIMARY, SETTINGS_SECONDARY } from './settingsStyles'

interface AgentSettingsSectionProps {
  title: string
  agents: SettingsSnapshot['agents']
  mcp: SettingsSnapshot['mcp']
  onInstallHooks: () => void
  onRemoveHooks: () => void
}

export function AgentSettingsSection({ title, agents, mcp, onInstallHooks, onRemoveHooks }: AgentSettingsSectionProps) {
  return (
    <SettingsPanel title={title}>
      <SettingsField
        label="Hooks Claude Code"
        tip={`Claude Code signale ses états (en cours, en attente, terminé, en erreur) par des hooks qui exécutent ${agents.script}. Sans hooks, un processus claude ou codex est affiché « État inconnu ». Les états sont écrits dans ${agents.stateDirectory} et purgés à chaque nouveau terminal.`}
      >
        <span className="flex items-center gap-3">
          <span className={`min-w-0 flex-1 text-[12px] ${agents.hooksInstalled ? 'text-tily-green' : 'text-tily-warning'}`}>{agents.hooksInstalled ? 'Installés' : 'Non installés'}</span>
          {agents.hooksInstalled ? (
            <button type="button" className={SETTINGS_SECONDARY} data-tip={`Retirer les hooks Tily de ${agents.settingsFile}`} onClick={onRemoveHooks}>
              Retirer
            </button>
          ) : (
            <button type="button" className={SETTINGS_PRIMARY} data-tip={`Ajouter les hooks Tily dans ${agents.settingsFile}`} onClick={onInstallHooks}>
              Installer
            </button>
          )}
        </span>
      </SettingsField>
      <McpSettingsField mcp={mcp} />
    </SettingsPanel>
  )
}
