import { useCallback, useRef, useState, type KeyboardEvent, type MouseEvent, type SyntheticEvent } from 'react'
import { DEFAULT_SHELL } from '../model/session'
import { useHostStore } from '../store/hostStore'
import type { ActionMenuItem } from './ActionMenu'
import { FloatingMenu } from './FloatingMenu'
import { Icon } from './Icon'
import { IconName } from './iconName'
import { isMenuKey, PANEL_HOVER_BUTTON, type WorkspacePanelActions } from './workspacePanel'

interface WorkspaceNewTabButtonProps {
  workspaceId: string
  name: string
  actions: WorkspacePanelActions
}

interface MenuPosition {
  x: number
  y: number
}

const BROWSER_ITEM = 'browser'

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation()

export function WorkspaceNewTabButton({ workspaceId, name, actions }: WorkspaceNewTabButtonProps) {
  const shells = useHostStore((state) => state.shells)
  const [menu, setMenu] = useState<MenuPosition | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const closingFirst = (run: () => void) => () => {
    setMenu(null)
    run()
  }
  const items: ActionMenuItem[] = [
    ...shells.map((shell) => ({ id: shell.id, label: shell.name, run: closingFirst(() => actions.newTabIn(workspaceId, shell.id)) })),
    { id: BROWSER_ITEM, label: 'Navigateur', run: closingFirst(() => actions.newBrowserIn(workspaceId)) },
  ]

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation()
    actions.newTabIn(workspaceId, DEFAULT_SHELL)
  }
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setMenu({ x: event.clientX, y: event.clientY })
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isMenuKey(event)) {
      event.preventDefault()
      event.stopPropagation()
      const { left, bottom } = event.currentTarget.getBoundingClientRect()
      setMenu({ x: left, y: bottom })
    }
  }
  const handleCloseMenu = useCallback(() => {
    setMenu(null)
    buttonRef.current?.focus()
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        className={`${PANEL_HOVER_BUTTON} aria-expanded:opacity-100`}
        data-tip="Nouvel onglet"
        aria-label={`Nouvel onglet dans ${name}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
      >
        <Icon name={IconName.Plus} size={11} />
      </button>
      {menu && (
        <span onClick={stopPropagation} onDoubleClick={stopPropagation} onContextMenu={stopPropagation} onPointerDown={stopPropagation}>
          <FloatingMenu x={menu.x} y={menu.y} label="Choisir le shell ou un navigateur" items={items} onClose={handleCloseMenu} />
        </span>
      )}
    </>
  )
}
