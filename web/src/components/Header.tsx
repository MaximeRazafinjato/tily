import type { ReactNode } from 'react'
import { EditableName } from './EditableName'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { InlineNameEditor } from './InlineNameEditor'
import { Command } from '../keyboard/commands'
import { useShortcutText, useShortcutTip, withShortcut } from '../keyboard/shortcutLabels'
import { LeaderHints } from './LeaderHints'
import { UpdateButton } from './UpdateButton'

interface HeaderProps {
  workspaceName: string | null
  renaming: boolean
  sidebarCollapsed: boolean
  leaderActive: boolean
  navigation: ReactNode
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onStartRename: () => void
  onCommitRename: (name: string) => void
  onCancelRename: () => void
}

export function Header({ workspaceName, renaming, sidebarCollapsed, leaderActive, navigation, onToggleSidebar, onOpenSettings, onStartRename, onCommitRename, onCancelRename }: HeaderProps) {
  const sidebarShortcut = useShortcutText(Command.ToggleSidebar)
  const settingsTip = useShortcutTip('Paramètres', Command.Settings)
  const sidebarLabel = sidebarCollapsed ? 'Afficher les workspaces' : 'Masquer les workspaces'
  return (
    <header className="relative flex h-[42px] shrink-0 items-center gap-4 border-b border-tily-line bg-tily-panel px-3 text-tily-ink">
      <button
        type="button"
        aria-label={sidebarLabel}
        className="flex h-[26px] cursor-pointer items-center rounded border border-tily-line px-2 text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink"
        data-tip={withShortcut(sidebarLabel, sidebarShortcut)}
        onClick={onToggleSidebar}
      >
        <Icon name={IconName.Menu} size={14} />
      </button>
      <div className="flex min-w-0 items-baseline gap-4">
        <span className="text-[17px] font-semibold text-tily-green">Tily</span>
        {!navigation &&
          (workspaceName === null ? (
            <span className="text-[16px] text-tily-muted">Aucun workspace</span>
          ) : renaming ? (
            <InlineNameEditor value={workspaceName} label="Nom du workspace" className="w-64 text-[16px]" onCommit={onCommitRename} onCancel={onCancelRename} />
          ) : (
            <EditableName name={workspaceName} className="text-[16px]" onClick={onStartRename} />
          ))}
      </div>
      {navigation && <div className={leaderActive ? 'hidden' : 'contents'}>{navigation}</div>}
      {leaderActive && <LeaderHints />}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <UpdateButton />
        <button
          type="button"
          className="flex h-[26px] cursor-pointer items-center gap-1.5 rounded border border-tily-line px-2 text-tily-muted hover:bg-tily-green-hover hover:text-tily-ink"
          data-tip={settingsTip}
          onClick={onOpenSettings}
        >
          <Icon name={IconName.Settings} className="translate-y-px" />
          <span className="text-xs">Paramètres</span>
        </button>
      </div>
    </header>
  )
}
