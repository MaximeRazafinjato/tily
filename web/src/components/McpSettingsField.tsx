import type { McpServerInfo } from '../bridge/mcpMessages'
import { installMcpServer, removeMcpServer } from '../mcp/mcpRequests'
import { SettingsField } from './SettingsField'
import { SETTINGS_PRIMARY, SETTINGS_SECONDARY } from './settingsStyles'

interface McpSettingsFieldProps {
  mcp: McpServerInfo
}

const sameFile = (left: string | undefined, right: string): boolean => left?.toLowerCase() === right.toLowerCase()

const describe = (mcp: McpServerInfo): { text: string; tone: string } => {
  if (!mcp.installed) {
    return { text: 'Désactivé', tone: 'text-tily-warning' }
  }
  if (mcp.error) {
    return { text: `Déclaré, mais ${mcp.error}`, tone: 'text-tily-error' }
  }
  return { text: 'Activé', tone: 'text-tily-green' }
}

export function McpSettingsField({ mcp }: McpSettingsFieldProps) {
  const { text, tone } = describe(mcp)
  const otherCopy = mcp.installed && !sameFile(mcp.command, mcp.executable)

  return (
    <SettingsField
      label="Serveur MCP"
      tip={`Permet à Claude Code, lancé dans un pane, de lire cette instance de Tily (disposition, texte des terminaux, commandes) et de la piloter : onglets, splits, commandes, worktrees. Agir sur un terminal qu’il n’a pas créé demande votre accord. Canal local réservé à votre compte Windows, jamais le réseau. Exécutable : ${mcp.executable}`}
    >
      <span className="flex items-center gap-3">
        <span className={`min-w-0 flex-1 text-[12px] ${tone}`}>{text}</span>
        {mcp.installed && (
          <button type="button" className={SETTINGS_SECONDARY} data-tip={`Retirer le serveur « tily » de ${mcp.configFile}`} onClick={removeMcpServer}>
            Désactiver
          </button>
        )}
        {(!mcp.installed || otherCopy) && mcp.available && (
          <button type="button" className={SETTINGS_PRIMARY} data-tip={`Déclarer le serveur « tily » dans ${mcp.configFile}`} onClick={installMcpServer}>
            {otherCopy ? 'Activer pour cette copie' : 'Activer'}
          </button>
        )}
      </span>
      {!mcp.available && <span className="text-[11px] text-tily-warning">{`tily-mcp.exe est introuvable à côté de Tily : ${mcp.executable}`}</span>}
      {otherCopy && <span className="text-[11px] text-tily-warning">{`Déclaré pour une autre copie de Tily : ${mcp.command ?? ''}.`}</span>}
    </SettingsField>
  )
}
